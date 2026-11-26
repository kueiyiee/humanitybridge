import { and, count, desc, eq, exists, isNotNull, isNull, sql } from 'drizzle-orm';
import { db, getDbDiagnostics, nowUtc, schema } from '../../db/index';

export type ImpactReportingPeriod = '30d' | '90d' | '12m' | 'all';

const IMPACT_CACHE_TTL_MS = 15_000;
const MIN_CASES_FOR_COUNTRY_REPORTING = 5;

type TrendPoint = {
  period: string;
  confirmedDonations: number;
  assistanceDistributed: number;
};

let cachedSummary: { expiresAt: number; period: ImpactReportingPeriod; data: ImpactSummary } | null = null;

export interface ImpactSummary {
  verifiedPublicCases: number;
  reportedPeopleAcrossCases: number;
  uniqueBeneficiaries: null;
  uniqueBeneficiariesUnavailableReason: string;
  activeCampaigns: number;
  completedProjects: null;
  completedProjectsUnavailableReason: string;
  countriesCoveredCount: number;
  regionalImpact: Array<{
    country: string;
    verifiedCases: number;
    reportedPeopleAcrossCases: number;
    assistanceDistributedUsd: number;
    reportingStatus: 'Verified public records';
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    caseCount: number;
    peopleCount: number;
  }>;
  financialSummary: {
    confirmedDonationsUsd: number;
    confirmedDonationCount: number;
    distributedAssistanceUsd: number;
    distributedCount: number;
  };
  trendSeries: TrendPoint[];
  reportingPeriod: ImpactReportingPeriod;
  reportingStatus: 'AVAILABLE' | 'EMPTY';
  lastUpdatedAt: string | Date;
  privacyThreshold: number;
}

function eligiblePublicCase() {
  return and(
    eq(schema.humanitarianCases.status, 'VERIFIED'),
    eq(schema.humanitarianCases.isPublic, true),
    eq(schema.humanitarianCases.beneficiaryConsentObtained, true),
    isNotNull(schema.humanitarianCases.verifiedBy),
    isNotNull(schema.humanitarianCases.verifiedAt),
    isNull(schema.humanitarianCases.deletedAt),
    sql`(${schema.humanitarianCases.isChildRelated} = false OR ${schema.humanitarianCases.guardianConsentObtained} = true)`,
    exists(
      db.select({ value: sql<number>`1` })
        .from(schema.caseVerifications)
        .where(and(
          eq(schema.caseVerifications.caseId, schema.humanitarianCases.id),
          eq(schema.caseVerifications.decision, 'VERIFIED'),
          eq(schema.caseVerifications.publishPublicly, true),
        )),
    ),
  );
}

function getPeriodStart(period: ImpactReportingPeriod, now: Date): Date | null {
  const start = new Date(now);
  if (period === '30d') start.setDate(start.getDate() - 30);
  else if (period === '90d') start.setDate(start.getDate() - 90);
  else if (period === '12m') start.setFullYear(start.getFullYear() - 1);
  else return null;
  return start;
}

function getBucketSql(column: typeof schema.donations.confirmedAt, period: ImpactReportingPeriod) {
  const pattern = period === '30d' || period === '90d' ? '%Y-%m-%d' : '%Y-%m';
  return getDbDiagnostics().dialect === 'mysql'
    ? sql<string>`DATE_FORMAT(${column}, ${pattern})`
    : sql<string>`strftime(${pattern}, ${column})`;
}

function getDistributionBucketSql(period: ImpactReportingPeriod) {
  const pattern = period === '30d' || period === '90d' ? '%Y-%m-%d' : '%Y-%m';
  return getDbDiagnostics().dialect === 'mysql'
    ? sql<string>`DATE_FORMAT(${schema.assistanceDistributions.distributedAt}, ${pattern})`
    : sql<string>`strftime(${pattern}, ${schema.assistanceDistributions.distributedAt})`;
}

async function loadImpactSummary(period: ImpactReportingPeriod): Promise<ImpactSummary> {
  const now = new Date();
  const startDate = getPeriodStart(period, now);
  const verifiedCaseFilter = eligiblePublicCase();
  const donationFilter = and(
    eq(schema.donations.status, 'CONFIRMED'),
    eq(schema.donations.currency, 'USD'),
    isNotNull(schema.donations.confirmedAt),
  );
  const distributionFilter = and(
    verifiedCaseFilter,
    eq(schema.assistanceDistributions.currency, 'USD'),
  );

  const [caseTotals, categoryRows, countryRows, donationTotals, distributionTotals, donationTrends, distributionTrends, campaignTotals, countryDistributionRows] =
    await Promise.all([
      db.select({
        count: count(),
        reportedPeople: sql<number>`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`,
      }).from(schema.humanitarianCases).where(verifiedCaseFilter),
      db.select({
        categoryName: schema.caseCategories.name,
        caseCount: count(schema.humanitarianCases.id),
        peopleCount: sql<number>`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`,
      }).from(schema.humanitarianCases)
        .innerJoin(schema.caseCategories, eq(schema.humanitarianCases.categoryId, schema.caseCategories.id))
        .where(verifiedCaseFilter)
        .groupBy(schema.caseCategories.id, schema.caseCategories.name)
        .orderBy(desc(sql`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`)),
      db.select({
        country: schema.communityLocations.country,
        verifiedCases: count(schema.humanitarianCases.id),
        reportedPeopleAcrossCases: sql<number>`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`,
      }).from(schema.humanitarianCases)
        .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
        .where(verifiedCaseFilter)
        .groupBy(schema.communityLocations.country)
        .having(sql`count(distinct ${schema.humanitarianCases.id}) >= ${MIN_CASES_FOR_COUNTRY_REPORTING}`)
        .orderBy(desc(count(schema.humanitarianCases.id))),
      db.select({
        amount: sql<number>`coalesce(sum(${schema.donations.amount}), 0)`,
        count: count(),
      }).from(schema.donations).where(donationFilter),
      db.select({
        amount: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)`,
        count: count(),
      }).from(schema.assistanceDistributions)
        .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
        .where(distributionFilter),
      db.select({
        period: getBucketSql(schema.donations.confirmedAt, period).as('period'),
        amount: sql<number>`coalesce(sum(${schema.donations.amount}), 0)`,
      }).from(schema.donations)
        .where(and(donationFilter, startDate ? sql`${schema.donations.confirmedAt} >= ${startDate}` : undefined))
        .groupBy(sql`period`),
      db.select({
        period: getDistributionBucketSql(period).as('period'),
        amount: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)`,
      }).from(schema.assistanceDistributions)
        .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
      .where(and(distributionFilter, startDate ? sql`${schema.assistanceDistributions.distributedAt} >= ${startDate}` : undefined))
        .groupBy(sql`period`),
      db.select({
        status: schema.campaigns.status,
        count: count(),
      }).from(schema.campaigns)
        .where(isNull(schema.campaigns.deletedAt))
        .groupBy(schema.campaigns.status),
      db.select({
        country: schema.communityLocations.country,
        amount: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)`,
      }).from(schema.assistanceDistributions)
        .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
        .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
        .where(distributionFilter)
        .groupBy(schema.communityLocations.country),
    ]);

  const trends = new Map<string, TrendPoint>();
  const getTrend = (key: string) => {
    let row = trends.get(key);
    if (!row) {
      row = { period: key, confirmedDonations: 0, assistanceDistributed: 0 };
      trends.set(key, row);
    }
    return row;
  };
  for (const row of donationTrends) {
    if (row.period) getTrend(String(row.period)).confirmedDonations = Number(row.amount || 0);
  }
  for (const row of distributionTrends) {
    if (row.period) getTrend(String(row.period)).assistanceDistributed = Number(row.amount || 0);
  }

  const caseCount = Number(caseTotals[0]?.count || 0);
  const reportedPeopleAcrossCases = Number(caseTotals[0]?.reportedPeople || 0);
  const confirmedDonationCount = Number(donationTotals[0]?.count || 0);
  const distributedCount = Number(distributionTotals[0]?.count || 0);
  const activeCampaigns = Number(campaignTotals.find((row) => row.status === 'ACTIVE')?.count || 0);
  const distributionByCountry = new Map(
    countryDistributionRows.map((row) => [row.country, Number(row.amount || 0)]),
  );
  const regionalImpact = countryRows.map((row) => ({
    country: row.country,
    verifiedCases: Number(row.verifiedCases || 0),
    reportedPeopleAcrossCases: Number(row.reportedPeopleAcrossCases || 0),
    assistanceDistributedUsd: distributionByCountry.get(row.country) || 0,
    reportingStatus: 'Verified public records' as const,
  }));
  const categoryBreakdown = categoryRows.map((row) => ({
    categoryName: row.categoryName,
    caseCount: Number(row.caseCount || 0),
    peopleCount: Number(row.peopleCount || 0),
  }));

  return {
    verifiedPublicCases: caseCount,
    reportedPeopleAcrossCases,
    uniqueBeneficiaries: null,
    uniqueBeneficiariesUnavailableReason:
      'The current case records do not contain a stable, privacy-safe beneficiary identifier for deduplication.',
    activeCampaigns,
    completedProjects: null,
    completedProjectsUnavailableReason:
      'The database has no separate projects table; campaigns and closed cases are not treated as completed projects.',
    countriesCoveredCount: regionalImpact.length,
    regionalImpact,
    categoryBreakdown,
    financialSummary: {
      confirmedDonationsUsd: Number(donationTotals[0]?.amount || 0),
      confirmedDonationCount,
      distributedAssistanceUsd: Number(distributionTotals[0]?.amount || 0),
      distributedCount,
    },
    trendSeries: Array.from(trends.values()).sort((a, b) => a.period.localeCompare(b.period)),
    reportingPeriod: period,
    reportingStatus:
      caseCount || activeCampaigns || confirmedDonationCount || distributedCount ? 'AVAILABLE' : 'EMPTY',
    lastUpdatedAt: nowUtc(),
    privacyThreshold: MIN_CASES_FOR_COUNTRY_REPORTING,
  };
}

export async function getImpactSummary(period: ImpactReportingPeriod): Promise<ImpactSummary> {
  if (cachedSummary && cachedSummary.period === period && cachedSummary.expiresAt > Date.now()) {
    return cachedSummary.data;
  }
  const data = await loadImpactSummary(period);
  cachedSummary = { period, data, expiresAt: Date.now() + IMPACT_CACHE_TTL_MS };
  return data;
}

export function invalidateImpactSummaryCache(): void {
  cachedSummary = null;
}
