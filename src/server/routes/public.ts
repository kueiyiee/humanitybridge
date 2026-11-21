import { Router } from 'express';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import {
  contactMessageSchema,
  partnershipEnquirySchema,
  safeguardingReportSchema,
  volunteerApplicationSchema,
} from '../../../packages/shared/validation';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

async function getConfirmedCampaignTotals(campaignId?: number) {
  const rows = await db
    .select({
      campaignId: schema.donations.campaignId,
      currency: schema.donations.currency,
      total: sql<number>`coalesce(sum(${schema.donations.amount}), 0)`,
    })
    .from(schema.donations)
    .where(
      and(
        eq(schema.donations.status, 'CONFIRMED'),
        campaignId === undefined ? undefined : eq(schema.donations.campaignId, campaignId),
      ),
    )
    .groupBy(schema.donations.campaignId, schema.donations.currency);

  return new Map(
    rows
      .filter((row) => row.campaignId !== null)
      .map((row) => [`${Number(row.campaignId)}:${row.currency.toUpperCase()}`, Number(row.total)]),
  );
}

router.get(
  '/public/overview',
  asyncHandler(async (_req, res) => {
    const [caseStats] = await db
      .select({
        verifiedCases: sql<number>`count(*)`,
        peopleSupported: sql<number>`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`,
      })
      .from(schema.humanitarianCases)
      .where(
        and(
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          eq(schema.humanitarianCases.isPublic, true),
          isNull(schema.humanitarianCases.deletedAt),
        ),
      );

    const [activeCampStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.status, 'ACTIVE'), isNull(schema.campaigns.deletedAt)));

    const [completedCampStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.status, 'COMPLETED'), isNull(schema.campaigns.deletedAt)));

    const [closedCasesStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.humanitarianCases)
      .where(and(eq(schema.humanitarianCases.status, 'CLOSED'), isNull(schema.humanitarianCases.deletedAt)));

    const featuredStories = await db
      .select({
        id: schema.stories.id,
        slug: schema.stories.slug,
        title: schema.stories.title,
        regionName: schema.stories.regionName,
        excerpt: schema.stories.excerpt,
        coverImageUrl: schema.stories.coverImageUrl,
        publishedAt: schema.stories.publishedAt,
        categoryName: schema.storyCategories.name,
        categorySlug: schema.storyCategories.slug,
      })
      .from(schema.stories)
      .innerJoin(schema.storyCategories, eq(schema.stories.categoryId, schema.storyCategories.id))
      .innerJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
      .where(
        and(
          eq(schema.stories.status, 'PUBLISHED'),
          eq(schema.storyConsents.consentStory, true),
          eq(schema.storyConsents.consentMedia, true),
          or(eq(schema.stories.isMinorSubject, false), eq(schema.storyConsents.guardianConsentRecorded, true)),
          isNull(schema.storyConsents.withdrawnAt),
          isNull(schema.stories.deletedAt),
        ),
      )
      .orderBy(desc(schema.stories.publishedAt))
      .limit(3);

    const confirmedTotalsByCampaign = await getConfirmedCampaignTotals();

    const featuredCampaignRows = await db
      .select({
        id: schema.campaigns.id,
        slug: schema.campaigns.slug,
        title: schema.campaigns.title,
        summary: schema.campaigns.summary,
        targetAmount: schema.campaigns.targetAmount,
        currency: schema.campaigns.currency,
        coverImageUrl: schema.campaigns.coverImageUrl,
        status: schema.campaigns.status,
        endDate: schema.campaigns.endDate,
      })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.status, 'ACTIVE'), isNull(schema.campaigns.deletedAt)))
      .orderBy(desc(schema.campaigns.createdAt))
      .limit(3);
    const featuredCampaigns = featuredCampaignRows.map((campaign) => ({
      ...campaign,
      raisedAmount:
        confirmedTotalsByCampaign.get(`${Number(campaign.id)}:${campaign.currency.toUpperCase()}`) || 0,
    }));

    const settingsRows = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.isPublic, true));
    const settings = Object.fromEntries(settingsRows.map((s) => [s.settingKey, s.settingValue]));

    return res.json({
      success: true,
      message: 'Public overview loaded',
      data: {
        statistics: {
          peopleSupported: Number(caseStats?.peopleSupported || 0),
          verifiedCases: Number(caseStats?.verifiedCases || 0),
          activeCampaigns: Number(activeCampStats?.count || 0),
          completedProjects: Number(completedCampStats?.count || 0) + Number(closedCasesStats?.count || 0),
        },
        featuredStories,
        featuredCampaigns,
        settings,
      },
    });
  }),
);

router.get(
  '/meta/taxonomy',
  asyncHandler(async (_req, res) => {
    const [caseCategories, storyCategories, locations, articleCategories] = await Promise.all([
      db.select().from(schema.caseCategories),
      db.select().from(schema.storyCategories),
      db.select().from(schema.communityLocations).where(eq(schema.communityLocations.isActive, true)),
      db.select().from(schema.articleCategories),
    ]);

    return res.json({
      success: true,
      message: 'Taxonomy loaded',
      data: { caseCategories, storyCategories, locations, articleCategories },
    });
  }),
);

router.get(
  '/stories',
  asyncHandler(async (req, res) => {
    const category = String(req.query.category || '').trim();
    const search = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));

    const rows = await db
      .select({
        id: schema.stories.id,
        slug: schema.stories.slug,
        title: schema.stories.title,
        regionName: schema.stories.regionName,
        excerpt: schema.stories.excerpt,
        coverImageUrl: schema.stories.coverImageUrl,
        anonymousPublication: schema.stories.anonymousPublication,
        publishedAt: schema.stories.publishedAt,
        categoryName: schema.storyCategories.name,
        categorySlug: schema.storyCategories.slug,
      })
      .from(schema.stories)
      .innerJoin(schema.storyCategories, eq(schema.stories.categoryId, schema.storyCategories.id))
      .innerJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
      .where(
        and(
          eq(schema.stories.status, 'PUBLISHED'),
          eq(schema.storyConsents.consentStory, true),
          eq(schema.storyConsents.consentMedia, true),
          or(eq(schema.stories.isMinorSubject, false), eq(schema.storyConsents.guardianConsentRecorded, true)),
          isNull(schema.storyConsents.withdrawnAt),
          isNull(schema.stories.deletedAt),
        ),
      )
      .orderBy(desc(schema.stories.publishedAt));

    const filtered = rows.filter((r) => {
      if (category && r.categorySlug !== category) return false;
      if (
        search &&
        !r.title.toLowerCase().includes(search) &&
        !r.excerpt.toLowerCase().includes(search) &&
        !r.regionName.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    const start = (page - 1) * limit;
    return res.json({
      success: true,
      message: 'Published stories',
      data: filtered.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    });
  }),
);

router.get(
  '/stories/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const rows = await db
      .select({
        id: schema.stories.id,
        slug: schema.stories.slug,
        title: schema.stories.title,
        regionName: schema.stories.regionName,
        excerpt: schema.stories.excerpt,
        body: schema.stories.body,
        coverImageUrl: schema.stories.coverImageUrl,
        anonymousPublication: schema.stories.anonymousPublication,
        isMinorSubject: schema.stories.isMinorSubject,
        publishedAt: schema.stories.publishedAt,
        languageCode: schema.stories.languageCode,
        translatedContentJson: schema.stories.translatedContentJson,
        categoryName: schema.storyCategories.name,
        categorySlug: schema.storyCategories.slug,
        authorName: schema.userProfiles.displayName,
        consentMedia: schema.storyConsents.consentMedia,
        consentIdentity: schema.storyConsents.consentIdentity,
      })
      .from(schema.stories)
      .innerJoin(schema.storyCategories, eq(schema.stories.categoryId, schema.storyCategories.id))
      .innerJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
      .leftJoin(schema.userProfiles, eq(schema.stories.authorId, schema.userProfiles.userId))
      .where(
        and(
          eq(schema.stories.slug, slug),
          eq(schema.stories.status, 'PUBLISHED'),
          eq(schema.storyConsents.consentStory, true),
          eq(schema.storyConsents.consentMedia, true),
          or(eq(schema.stories.isMinorSubject, false), eq(schema.storyConsents.guardianConsentRecorded, true)),
          isNull(schema.storyConsents.withdrawnAt),
          isNull(schema.stories.deletedAt),
        ),
      )
      .limit(1);

    const story = rows[0];
    if (!story) throw new AppError(404, 'Story not found');

    return res.json({
      success: true,
      message: 'Story loaded',
      data: {
        ...story,
        authorName: story.anonymousPublication || !story.consentIdentity ? 'Community Contributor (Identity Protected)' : story.authorName,
        coverImageUrl: story.consentMedia ? story.coverImageUrl : null,
      },
    });
  }),
);

// Public humanitarian cases: NEVER expose privateContactName, privateContactPhone, privateLocationNotes, or internalAdminNotes
router.get(
  '/cases',
  asyncHandler(async (req, res) => {
    const category = String(req.query.category || '').trim();
    const region = String(req.query.region || '').trim();
    const urgency = String(req.query.urgency || '').trim();
    const search = String(req.query.q || '').trim().toLowerCase();

    const rows = await db
      .select({
        id: schema.humanitarianCases.id,
        referenceCode: schema.humanitarianCases.referenceCode,
        title: schema.humanitarianCases.title,
        publicSummary: schema.humanitarianCases.publicSummary,
        assistanceNeeded: schema.humanitarianCases.assistanceNeeded,
        affectedCount: schema.humanitarianCases.affectedCount,
        urgencyLevel: schema.humanitarianCases.urgencyLevel,
        estimatedCostUsd: schema.humanitarianCases.estimatedCostUsd,
        status: schema.humanitarianCases.status,
        verifiedAt: schema.humanitarianCases.verifiedAt,
        categoryName: schema.caseCategories.name,
        categorySlug: schema.caseCategories.slug,
        regionName: schema.communityLocations.regionName,
        country: schema.communityLocations.country,
      })
      .from(schema.humanitarianCases)
      .innerJoin(schema.caseCategories, eq(schema.humanitarianCases.categoryId, schema.caseCategories.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(
        and(
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          eq(schema.humanitarianCases.isPublic, true),
          isNull(schema.humanitarianCases.deletedAt),
        ),
      )
      .orderBy(desc(schema.humanitarianCases.verifiedAt));

    const filtered = rows.filter((r) => {
      if (category && r.categorySlug !== category) return false;
      if (region && r.regionName !== region) return false;
      if (urgency && r.urgencyLevel !== urgency) return false;
      if (
        search &&
        !r.title.toLowerCase().includes(search) &&
        !r.referenceCode.toLowerCase().includes(search) &&
        !r.publicSummary.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    return res.json({
      success: true,
      message: 'Verified public cases',
      data: filtered,
    });
  }),
);

router.get(
  '/cases/:reference',
  asyncHandler(async (req, res) => {
    const reference = String(req.params.reference);
    const rows = await db
      .select({
        id: schema.humanitarianCases.id,
        referenceCode: schema.humanitarianCases.referenceCode,
        title: schema.humanitarianCases.title,
        publicSummary: schema.humanitarianCases.publicSummary,
        assistanceNeeded: schema.humanitarianCases.assistanceNeeded,
        affectedCount: schema.humanitarianCases.affectedCount,
        urgencyLevel: schema.humanitarianCases.urgencyLevel,
        estimatedCostUsd: schema.humanitarianCases.estimatedCostUsd,
        status: schema.humanitarianCases.status,
        isChildRelated: schema.humanitarianCases.isChildRelated,
        verifiedAt: schema.humanitarianCases.verifiedAt,
        categoryName: schema.caseCategories.name,
        categorySlug: schema.caseCategories.slug,
        regionName: schema.communityLocations.regionName,
        country: schema.communityLocations.country,
      })
      .from(schema.humanitarianCases)
      .innerJoin(schema.caseCategories, eq(schema.humanitarianCases.categoryId, schema.caseCategories.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(
        and(
          eq(schema.humanitarianCases.referenceCode, reference),
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          eq(schema.humanitarianCases.isPublic, true),
          isNull(schema.humanitarianCases.deletedAt),
        ),
      )
      .limit(1);

    const item = rows[0];
    if (!item) throw new AppError(404, 'Verified humanitarian case not found');

    const [distStats] = await db
      .select({ totalDistributed: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)` })
      .from(schema.assistanceDistributions)
      .where(eq(schema.assistanceDistributions.caseId, item.id));

    const [donationStats] = await db
      .select({ totalDonated: sql<number>`coalesce(sum(${schema.donations.amount}), 0)` })
      .from(schema.donations)
      .where(and(eq(schema.donations.caseId, item.id), eq(schema.donations.status, 'CONFIRMED')));

    return res.json({
      success: true,
      message: 'Verified case loaded',
      data: {
        ...item,
        confirmedDonationsUsd: Number(donationStats?.totalDonated || 0),
        distributedAssistanceUsd: Number(distStats?.totalDistributed || 0),
      },
    });
  }),
);

router.get(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || '').trim();
    const search = String(req.query.q || '').trim().toLowerCase();

    const rows = await db
      .select()
      .from(schema.campaigns)
      .where(isNull(schema.campaigns.deletedAt))
      .orderBy(desc(schema.campaigns.createdAt));

    const publicCampaignRows = rows.filter((c) => {
      if (c.status === 'DRAFT') return false;
      if (status && c.status !== status) return false;
      if (search && !c.title.toLowerCase().includes(search) && !c.summary.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
    const confirmedTotalsByCampaign = await getConfirmedCampaignTotals();
    const publicCampaigns = publicCampaignRows.map((campaign) => ({
      ...campaign,
      raisedAmount:
        confirmedTotalsByCampaign.get(`${Number(campaign.id)}:${campaign.currency.toUpperCase()}`) || 0,
    }));

    return res.json({
      success: true,
      message: 'Campaigns loaded',
      data: publicCampaigns,
    });
  }),
);

router.get(
  '/campaigns/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const rows = await db
      .select()
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.slug, slug), isNull(schema.campaigns.deletedAt)))
      .limit(1);
    const campaign = rows[0];
    if (!campaign || campaign.status === 'DRAFT') {
      throw new AppError(404, 'Campaign not found');
    }
    const confirmedTotalsByCampaign = await getConfirmedCampaignTotals(campaign.id);

    const linkedCases = await db
      .select({
        referenceCode: schema.humanitarianCases.referenceCode,
        title: schema.humanitarianCases.title,
        affectedCount: schema.humanitarianCases.affectedCount,
        urgencyLevel: schema.humanitarianCases.urgencyLevel,
        regionName: schema.communityLocations.regionName,
      })
      .from(schema.campaignCases)
      .innerJoin(schema.humanitarianCases, eq(schema.campaignCases.caseId, schema.humanitarianCases.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(
        and(
          eq(schema.campaignCases.campaignId, campaign.id),
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          eq(schema.humanitarianCases.isPublic, true),
        ),
      );

    const recentConfirmedDonations = await db
      .select({
        donationReference: schema.donations.donationReference,
        amount: schema.donations.amount,
        currency: schema.donations.currency,
        donorName: schema.donations.donorName,
        isAnonymous: schema.donations.isAnonymous,
        confirmedAt: schema.donations.confirmedAt,
      })
      .from(schema.donations)
      .where(and(eq(schema.donations.campaignId, campaign.id), eq(schema.donations.status, 'CONFIRMED')))
      .orderBy(desc(schema.donations.confirmedAt))
      .limit(8);

    return res.json({
      success: true,
      message: 'Campaign loaded',
      data: {
        ...campaign,
        raisedAmount:
          confirmedTotalsByCampaign.get(`${Number(campaign.id)}:${campaign.currency.toUpperCase()}`) || 0,
        linkedCases,
        recentConfirmedDonations: recentConfirmedDonations.map((d) => ({
          ...d,
          donorName: d.isAnonymous ? 'Anonymous Supporter' : d.donorName,
        })),
      },
    });
  }),
);

router.get(
  '/articles',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: schema.articles.id,
        slug: schema.articles.slug,
        title: schema.articles.title,
        summary: schema.articles.summary,
        coverImageUrl: schema.articles.coverImageUrl,
        publishedAt: schema.articles.publishedAt,
        categoryName: schema.articleCategories.name,
        categorySlug: schema.articleCategories.slug,
      })
      .from(schema.articles)
      .innerJoin(schema.articleCategories, eq(schema.articles.categoryId, schema.articleCategories.id))
      .where(eq(schema.articles.status, 'PUBLISHED'))
      .orderBy(desc(schema.articles.publishedAt));

    return res.json({ success: true, message: 'Articles loaded', data: rows });
  }),
);

router.get(
  '/articles/:slug',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: schema.articles.id,
        slug: schema.articles.slug,
        title: schema.articles.title,
        summary: schema.articles.summary,
        body: schema.articles.body,
        coverImageUrl: schema.articles.coverImageUrl,
        publishedAt: schema.articles.publishedAt,
        categoryName: schema.articleCategories.name,
      })
      .from(schema.articles)
      .innerJoin(schema.articleCategories, eq(schema.articles.categoryId, schema.articleCategories.id))
      .where(and(eq(schema.articles.slug, String(req.params.slug)), eq(schema.articles.status, 'PUBLISHED')))
      .limit(1);

    if (!rows[0]) throw new AppError(404, 'Article not found');
    return res.json({ success: true, message: 'Article loaded', data: rows[0] });
  }),
);

router.get(
  '/impact',
  asyncHandler(async (req, res) => {
    const period = String(req.query.period || '12m');
    if (!['30d', '90d', '12m', 'all'].includes(period)) {
      throw new AppError(400, 'Unsupported reporting period');
    }

    const regionalImpact = await db
      .select({
        regionName: schema.communityLocations.regionName,
        country: schema.communityLocations.country,
        verifiedCases: sql<number>`count(${schema.humanitarianCases.id})`,
        peopleSupported: sql<number>`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`,
      })
      .from(schema.communityLocations)
      .leftJoin(
        schema.humanitarianCases,
        and(
          eq(schema.communityLocations.id, schema.humanitarianCases.locationId),
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          eq(schema.humanitarianCases.isPublic, true),
          isNull(schema.humanitarianCases.deletedAt),
        ),
      )
      .groupBy(schema.communityLocations.id);

    const regionalRows = regionalImpact
      .map((row) => ({
        regionName: row.regionName,
        country: row.country,
        verifiedCases: Number(row.verifiedCases || 0),
        peopleSupported: Number(row.peopleSupported || 0),
      }))
      .filter((row) => row.verifiedCases > 0 && row.peopleSupported >= 5)
      .sort((a, b) => b.peopleSupported - a.peopleSupported);

    const categoryBreakdown = await db
      .select({
        categoryName: schema.caseCategories.name,
        caseCount: sql<number>`count(${schema.humanitarianCases.id})`,
        peopleCount: sql<number>`coalesce(sum(${schema.humanitarianCases.affectedCount}), 0)`,
      })
      .from(schema.caseCategories)
      .leftJoin(
        schema.humanitarianCases,
        and(
          eq(schema.caseCategories.id, schema.humanitarianCases.categoryId),
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          eq(schema.humanitarianCases.isPublic, true),
          isNull(schema.humanitarianCases.deletedAt),
        ),
      )
      .groupBy(schema.caseCategories.id);

    const sectorRows = categoryBreakdown
      .map((row) => ({
        categoryName: row.categoryName,
        caseCount: Number(row.caseCount || 0),
        peopleCount: Number(row.peopleCount || 0),
      }))
      .filter((row) => row.caseCount > 0 && row.peopleCount > 0)
      .sort((a, b) => b.peopleCount - a.peopleCount);

    const [confirmedDonations] = await db
      .select({ totalUsd: sql<number>`coalesce(sum(${schema.donations.amount}), 0)`, count: sql<number>`count(*)` })
      .from(schema.donations)
      .where(eq(schema.donations.status, 'CONFIRMED'));

    const [distributedFunds] = await db
      .select({
        totalUsd: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(schema.assistanceDistributions)
      .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
      .where(and(eq(schema.humanitarianCases.status, 'VERIFIED'), eq(schema.humanitarianCases.isPublic, true), isNull(schema.humanitarianCases.deletedAt)));

    const regionalDistributions = await db
      .select({
        locationId: schema.communityLocations.id,
        distributedUsd: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)`,
      })
      .from(schema.assistanceDistributions)
      .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(and(eq(schema.humanitarianCases.status, 'VERIFIED'), eq(schema.humanitarianCases.isPublic, true), isNull(schema.humanitarianCases.deletedAt)))
      .groupBy(schema.communityLocations.id);

    const distributionByLocation = new Map(
      regionalDistributions.map((row) => [Number(row.locationId), Number(row.distributedUsd || 0)]),
    );
    const regionalDistributionRows = await db
      .select({
        id: schema.communityLocations.id,
        regionName: schema.communityLocations.regionName,
        country: schema.communityLocations.country,
      })
      .from(schema.communityLocations);
    const regionalTable = regionalDistributionRows.map((row) => {
      return {
        regionName: row.regionName,
        country: row.country,
        verifiedCases: regionalImpact
          .filter((item) => item.regionName === row.regionName && item.country === row.country)
          .reduce((sum, item) => sum + Number(item.verifiedCases || 0), 0),
        peopleSupported: regionalImpact
          .filter((item) => item.regionName === row.regionName && item.country === row.country)
          .reduce((sum, item) => sum + Number(item.peopleSupported || 0), 0),
        assistanceDistributedUsd: distributionByLocation.get(Number(row.id)) || 0,
        reportingStatus: 'Verified public record',
      };
    }).filter((row) => row.verifiedCases > 0 && row.peopleSupported >= 5);

    const donationTrendRows = await db
      .select({ amount: schema.donations.amount, confirmedAt: schema.donations.confirmedAt })
      .from(schema.donations)
      .where(eq(schema.donations.status, 'CONFIRMED'));
    const distributionTrendRows = await db
      .select({ amountUsd: schema.assistanceDistributions.amountUsd, distributedAt: schema.assistanceDistributions.distributedAt })
      .from(schema.assistanceDistributions)
      .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
      .where(and(eq(schema.humanitarianCases.status, 'VERIFIED'), eq(schema.humanitarianCases.isPublic, true), isNull(schema.humanitarianCases.deletedAt)));

    const now = new Date();
    let startDate: Date | null = null;
    if (period === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (period === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (period === '12m') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 12);
    }

    const bucketKey = (value: Date) => period === '30d' || period === '90d'
      ? value.toISOString().slice(0, 10)
      : `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
    const trend = new Map<string, { period: string; confirmedDonations: number; assistanceDistributed: number }>();

    const addTrend = (dateValue: Date | string | null, amount: number, field: 'confirmedDonations' | 'assistanceDistributed') => {
      if (!dateValue) return;
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (Number.isNaN(date.getTime()) || (startDate && date < startDate)) return;
      const key = bucketKey(date);
      const existing = trend.get(key) || { period: key, confirmedDonations: 0, assistanceDistributed: 0 };
      existing[field] += amount;
      trend.set(key, existing);
    };
    for (const row of donationTrendRows) addTrend(row.confirmedAt, Number(row.amount || 0), 'confirmedDonations');
    for (const row of distributionTrendRows) addTrend(row.distributedAt, Number(row.amountUsd || 0), 'assistanceDistributed');

    const trendSeries = Array.from(trend.values()).sort((a, b) => a.period.localeCompare(b.period));
    const confirmedDonationValue = Number(confirmedDonations?.totalUsd || 0);
    const distributedAssistanceValue = Number(distributedFunds?.totalUsd || 0);

    return res.json({
      success: true,
      message: 'Impact centre telemetry loaded',
      data: {
        regionalImpact: regionalTable,
        categoryBreakdown: sectorRows,
        financialSummary: {
          confirmedDonationsUsd: confirmedDonationValue,
          confirmedDonationCount: Number(confirmedDonations?.count || 0),
          distributedAssistanceUsd: distributedAssistanceValue,
          distributedCount: Number(distributedFunds?.count || 0),
        },
        peopleSupported: regionalTable.reduce((sum, row) => sum + row.peopleSupported, 0),
        activeRegionsCount: regionalTable.length,
        trendSeries,
        reportingPeriod: period,
        reportingStatus: 'Live database reporting',
        lastUpdatedAt: nowUtc(),
        verificationStatus: 'Verified public records',
        privacyThreshold: 5,
      },
    });
  }),
);

router.post(
  '/public/volunteers',
  asyncHandler(async (req, res) => {
    const parsed = volunteerApplicationSchema.parse(req.body);
    await db.insert(schema.volunteerApplications).values({
      ...parsed,
      status: 'PENDING',
      createdAt: nowUtc(),
    });
    return res.status(201).json({
      success: true,
      message: 'Volunteer application received for humanitarian coordinator review.',
      data: null,
    });
  }),
);

router.post(
  '/public/partnerships',
  asyncHandler(async (req, res) => {
    const parsed = partnershipEnquirySchema.parse(req.body);
    await db.insert(schema.partnershipEnquiries).values({
      ...parsed,
      status: 'PENDING',
      createdAt: nowUtc(),
    });
    return res.status(201).json({
      success: true,
      message: 'Partnership enquiry logged. Our governance desk will respond via official channels.',
      data: null,
    });
  }),
);

router.post(
  '/public/contact',
  asyncHandler(async (req, res) => {
    const parsed = contactMessageSchema.parse(req.body);
    await db.insert(schema.contactMessages).values({
      ...parsed,
      status: 'NEW',
      createdAt: nowUtc(),
    });
    return res.status(201).json({
      success: true,
      message: 'Message received. Thank you for reaching out to HumanityBridge.',
      data: null,
    });
  }),
);

router.post(
  '/public/safeguarding',
  asyncHandler(async (req, res) => {
    const parsed = safeguardingReportSchema.parse(req.body);
    await db.insert(schema.safeguardingReports).values({
      subjectType: parsed.subjectType,
      referenceCode: parsed.referenceCode || null,
      severity: parsed.severity,
      description: parsed.description,
      reporterEmail: parsed.reporterEmail || null,
      status: 'OPEN',
      createdAt: nowUtc(),
    });
    return res.status(201).json({
      success: true,
      message: 'Safeguarding concern recorded for restricted administrative review.',
      data: null,
    });
  }),
);

export default router;
