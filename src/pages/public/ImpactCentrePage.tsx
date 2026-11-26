import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CircleDollarSign,
  HandHeart,
  MapPinned,
  ShieldCheck,
  Users,
  LockKeyhole,
  FileCheck2,
  Eye,
  ArrowUpRight,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts';
import { apiRequest } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { z } from 'zod';

const impactDataSchema = z.object({
  regionalImpact: z.array(z.object({
    country: z.string(),
    verifiedCases: z.number().nonnegative(),
    reportedPeopleAcrossCases: z.number().nonnegative(),
    assistanceDistributedUsd: z.number().nonnegative(),
    reportingStatus: z.string(),
  })),
  categoryBreakdown: z.array(z.object({
    categoryName: z.string(),
    caseCount: z.number().nonnegative(),
    peopleCount: z.number().nonnegative(),
  })),
  financialSummary: z.object({
    confirmedDonationsUsd: z.number().nonnegative(),
    confirmedDonationCount: z.number().nonnegative(),
    distributedAssistanceUsd: z.number().nonnegative(),
    distributedCount: z.number().nonnegative(),
  }),
  verifiedPublicCases: z.number().nonnegative(),
  reportedPeopleAcrossCases: z.number().nonnegative(),
  uniqueBeneficiaries: z.null(),
  uniqueBeneficiariesUnavailableReason: z.string(),
  activeCampaigns: z.number().nonnegative(),
  completedProjects: z.null(),
  completedProjectsUnavailableReason: z.string(),
  countriesCoveredCount: z.number().nonnegative(),
  trendSeries: z.array(z.object({
    period: z.string(),
    confirmedDonations: z.number().nonnegative(),
    assistanceDistributed: z.number().nonnegative(),
  })),
  reportingPeriod: z.enum(['30d', '90d', '12m', 'all']),
  reportingStatus: z.enum(['AVAILABLE', 'EMPTY']),
  lastUpdatedAt: z.union([z.string(), z.date()]),
  privacyThreshold: z.number().positive(),
});

type ImpactData = z.infer<typeof impactDataSchema>;

const silverPalette = ['#2b2d2f', '#55595c', '#7b8083', '#a4a8aa', '#c7c9ca'];

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function chartDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const [year, month] = value.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  explanation,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  explanation: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_12px_36px_-30px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/75 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {icon}
        </span>
      </div>
      <p className="mt-5 font-editorial text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{value}</p>
      <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{detail}</p>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{explanation}</p>
    </article>
  );
}

export function ImpactCentrePage() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<'30d' | '90d' | '12m' | 'all'>('12m');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'country' | 'verifiedCases' | 'reportedPeopleAcrossCases' | 'assistanceDistributedUsd'>('reportedPeopleAcrossCases');
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['public-impact', period],
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const cancelRequest = () => controller.abort();
      signal.addEventListener('abort', cancelRequest, { once: true });
      try {
        const response = await apiRequest<unknown>(`/public/impact/summary?period=${period}`, {
          signal: controller.signal,
        });
        return { ...response, data: impactDataSchema.parse(response.data) };
      } catch (error) {
        if (controller.signal.aborted && !signal.aborted) {
          throw new Error('The impact report request timed out. Please try again.');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancelRequest);
      }
    },
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const impact = data?.data;
  const chartText = theme === 'dark' ? '#c4c7c9' : '#4b5053';
  const gridStroke = theme === 'dark' ? '#34373a' : '#dfe1e2';

  const tableRows = useMemo(() => {
    if (!impact) return [];
    const filtered = impact.regionalImpact.filter((row) =>
      row.country.toLowerCase().includes(search.trim().toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const av = typeof a[sort] === 'string' ? String(a[sort]).toLowerCase() : Number(a[sort]);
      const bv = typeof b[sort] === 'string' ? String(b[sort]).toLowerCase() : Number(b[sort]);
      if (av < bv) return ascending ? -1 : 1;
      if (av > bv) return ascending ? 1 : -1;
      return 0;
    });
  }, [impact, search, sort, ascending]);

  const pageCount = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const visibleRows = tableRows.slice((page - 1) * pageSize, page * pageSize);

  const setSortColumn = (column: typeof sort) => {
    if (sort === column) setAscending((value) => !value);
    else {
      setSort(column);
      setAscending(false);
    }
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Public accountability</p>
        <h1 className="mt-3 font-editorial text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">Impact Centre</h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
          Measuring meaningful assistance through verified records, responsible reporting and transparent community impact.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Figures are aggregated from published, verified HumanityBridge records. Precise beneficiary locations and confidential personal information are not disclosed.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-600 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="h-2 w-2 rounded-full bg-slate-700 dark:bg-slate-200" aria-hidden="true" />
          {isPending ? 'Retrieving database report' : isError ? 'Reporting data unavailable' :
            impact?.reportingStatus === 'EMPTY' ? 'No verified public records yet' : 'Live database reporting'}
        </span>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>
        <span>{impact ? `Updated ${new Date(impact.lastUpdatedAt).toLocaleString()}` : 'Last successful update unavailable'}</span>
        {impact && impact.reportingStatus !== 'EMPTY' &&
          <span className="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">Verified public records</span>}
        <button type="button" onClick={() => void refetch({ cancelRefetch: true })} disabled={isFetching}
          className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 font-semibold transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {isPending ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading impact metrics">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}
        </div>
      ) : isError || !impact ? (
        <div role="alert" className="mt-8 rounded-xl border border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="font-semibold text-slate-950 dark:text-white">Impact reporting data could not be retrieved.</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">The public site is available; please try requesting the report again.</p>
          <button type="button" onClick={() => void refetch({ cancelRefetch: true })} disabled={isFetching}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">
            {isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : impact.reportingStatus === 'EMPTY' ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900/75">
          <p className="font-editorial text-xl font-semibold text-slate-950 dark:text-white">Verified impact records are not available yet.</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            No published, verified public case, active campaign, confirmed USD donation, or qualifying assistance distribution was found in the reporting database. This report does not substitute sample figures for live records.
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Last checked {new Date(impact.lastUpdatedAt).toLocaleString()}.</p>
        </div>
      ) : (
        <>
          <section aria-label="Headline impact metrics" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={<FileCheck2 className="h-5 w-5" />}
              label="Verified Public Cases"
              value={impact.verifiedPublicCases.toLocaleString()}
              detail="Verified, consent-cleared records"
              explanation="Only active public case approvals are included; rejected, withdrawn, and deleted records are excluded."
            />
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              label="Reported People Across Cases"
              value={impact.reportedPeopleAcrossCases.toLocaleString()}
              detail="Case-reported affected counts; not deduplicated"
              explanation={impact.uniqueBeneficiariesUnavailableReason}
            />
            <MetricCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Active Campaigns"
              value={impact.activeCampaigns.toLocaleString()}
              detail="Currently active and not deleted"
              explanation="Campaign records are counted only while their database status is ACTIVE."
            />
            <MetricCard
              icon={<MapPinned className="h-5 w-5" />}
              label="Countries Covered"
              value={impact.countriesCoveredCount.toLocaleString()}
              detail={`${impact.privacyThreshold}+ verified cases per country`}
              explanation="Sub-country locations are not published; country aggregates below the minimum case threshold are suppressed."
            />
            <MetricCard
              icon={<CircleDollarSign className="h-5 w-5" />}
              label="Confirmed Donations (USD)"
              value={money(impact.financialSummary.confirmedDonationsUsd)}
              detail={`${impact.financialSummary.confirmedDonationCount} confirmed settlements`}
              explanation="Only confirmed USD donation records with a confirmation timestamp contribute; other currencies are not converted or combined."
            />
            <MetricCard
              icon={<HandHeart className="h-5 w-5" />}
              label="Assistance Distributed (USD)"
              value={money(impact.financialSummary.distributedAssistanceUsd)}
              detail={`${impact.financialSummary.distributedCount} completed distribution records`}
              explanation="USD distributions linked to consent-cleared verified public cases are included."
            />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/75 sm:p-6">
              <h2 className="font-editorial text-xl font-semibold text-slate-950 dark:text-white">Reported Case Reach by Country</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Case-reported affected counts (not deduplicated); countries require at least {impact.privacyThreshold} verified public cases.</p>
              {impact.regionalImpact.length ? (
                <div className="mt-5 h-80" role="img" aria-label="Horizontal bar chart of case-reported reach by country">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={impact.regionalImpact} layout="vertical" margin={{ top: 5, right: 12, bottom: 5, left: 0 }}>
                      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fill: chartText, fontSize: 11 }} axisLine={{ stroke: gridStroke }} />
                      <YAxis type="category" dataKey="country" width={118} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: theme === 'dark' ? '#202326' : '#f1f2f2' }} contentStyle={{ background: theme === 'dark' ? '#1b1d20' : '#fff', border: `1px solid ${gridStroke}`, borderRadius: 8, color: chartText }} />
                      <Bar dataKey="reportedPeopleAcrossCases" name="Reported people across cases" fill={theme === 'dark' ? '#bfc2c4' : '#303438'} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="mt-5 flex h-80 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No country currently meets the privacy threshold.</div>}
            </article>

            <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/75 sm:p-6">
              <h2 className="font-editorial text-xl font-semibold text-slate-950 dark:text-white">Assistance Sector Distribution</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Case-reported affected counts by category; people are not deduplicated across cases.</p>
              {impact.categoryBreakdown.length ? (
                <div className="mt-5 grid min-h-80 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="relative h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={impact.categoryBreakdown} dataKey="peopleCount" nameKey="categoryName" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
                          {impact.categoryBreakdown.map((_, index) => <Cell key={index} fill={silverPalette[index % silverPalette.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: theme === 'dark' ? '#1b1d20' : '#fff', border: `1px solid ${gridStroke}`, borderRadius: 8, color: chartText }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-white">{impact.categoryBreakdown.reduce((sum, row) => sum + row.peopleCount, 0).toLocaleString()}</span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Reported reach</span>
                    </div>
                  </div>
                  <ul className="space-y-2" aria-label="Assistance sector legend">
                    {impact.categoryBreakdown.slice(0, 5).map((row, index) => (
                      <li key={row.categoryName} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: silverPalette[index % silverPalette.length] }} /> <span className="truncate">{row.categoryName}</span></span>
                        <strong className="font-mono-tabular text-slate-900 dark:text-slate-100">{row.peopleCount.toLocaleString()}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <div className="mt-5 flex h-80 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No qualifying sector records are available.</div>}
            </article>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/75 sm:p-6">
              <h2 className="font-editorial text-xl font-semibold text-slate-950 dark:text-white">Financial Accountability Overview</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Confirmed USD donations and verified USD distributions.</p>
              {impact.financialSummary.confirmedDonationsUsd > 0 || impact.financialSummary.distributedAssistanceUsd > 0 ? (
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { label: 'Confirmed donations', value: impact.financialSummary.confirmedDonationsUsd },
                    { label: 'Assistance distributed', value: impact.financialSummary.distributedAssistanceUsd },
                  ]}>
                    <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: chartText, fontSize: 11 }} axisLine={{ stroke: gridStroke }} />
                    <YAxis tick={{ fill: chartText, fontSize: 11 }} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} axisLine={false} />
                    <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: theme === 'dark' ? '#1b1d20' : '#fff', border: `1px solid ${gridStroke}`, borderRadius: 8, color: chartText }} />
                    <Bar dataKey="value" name="USD" fill={theme === 'dark' ? '#aeb3b6' : '#3e4346'} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              ) : <div className="mt-5 flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No confirmed USD financial records are available.</div>}
            </article>

            <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/75 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-editorial text-xl font-semibold text-slate-950 dark:text-white">Impact Activity Over Time</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Confirmed USD donations and verified USD distributions.</p>
                </div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="sr-only">Reporting period</span>
                  <select value={period} onChange={(event) => { setPeriod(event.target.value as typeof period); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="12m">Last 12 months</option>
                    <option value="all">All available records</option>
                  </select>
                </label>
              </div>
              {impact.trendSeries.length ? (
                <div className="mt-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={impact.trendSeries}>
                      <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" tickFormatter={chartDate} tick={{ fill: chartText, fontSize: 10 }} axisLine={{ stroke: gridStroke }} />
                      <YAxis tick={{ fill: chartText, fontSize: 10 }} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} axisLine={false} />
                      <Tooltip labelFormatter={(label) => chartDate(String(label ?? ''))} formatter={(value, name) => [money(Number(value)), name === 'confirmedDonations' ? 'Confirmed donations' : 'Assistance distributed']} contentStyle={{ background: theme === 'dark' ? '#1b1d20' : '#fff', border: `1px solid ${gridStroke}`, borderRadius: 8, color: chartText }} />
                      <Line type="monotone" dataKey="confirmedDonations" name="Confirmed donations" stroke={theme === 'dark' ? '#d2d4d5' : '#202326'} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="assistanceDistributed" name="Assistance distributed" stroke="#8b9093" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="mt-5 flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No trend records fall within this reporting period.</div>}
            </article>
          </section>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div>
                <h2 className="font-editorial text-lg font-semibold text-slate-950 dark:text-white">Aggregated Regional Breakdown</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Privacy-filtered, approved public regional records.</p>
              </div>
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search countries</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search country" className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
            </div>
            {visibleRows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                      <tr>
                        {[
                          ['country', 'Country'],
                          ['verifiedCases', 'Verified Cases'],
                          ['reportedPeopleAcrossCases', 'Reported Reach*'],
                          ['assistanceDistributedUsd', 'Assistance Distributed'],
                        ].map(([key, label]) => (
                          <th key={key} scope="col" className="px-5 py-3 font-semibold">
                            <button type="button" onClick={() => setSortColumn(key as typeof sort)} className="inline-flex items-center gap-1" aria-label={`Sort by ${label}`}>{label}<ArrowUpRight className="h-3 w-3" /></button>
                          </th>
                        ))}
                        <th scope="col" className="px-5 py-3 font-semibold">Reporting Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleRows.map((row) => (
                        <tr key={row.country}>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{row.country}</td>
                          <td className="px-5 py-4 font-mono-tabular text-slate-700 dark:text-slate-300">{row.verifiedCases.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">{row.reportedPeopleAcrossCases.toLocaleString()}</td>
                          <td className="px-5 py-4 font-mono-tabular text-slate-700 dark:text-slate-300">{money(row.assistanceDistributedUsd)}</td>
                          <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"><ShieldCheck className="h-3 w-3" />Verified public</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <span>{tableRows.length} countr{tableRows.length === 1 ? 'y' : 'ies'}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button>
                    <span>Page {page} of {pageCount}</span>
                    <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                {search ? 'No countries match this search.' : `No country has ${impact.privacyThreshold} or more verified public cases.`}
              </div>
            )}
          </section>

          <section className="mt-12 border-t border-slate-200 pt-10 dark:border-slate-800">
            <h2 className="font-editorial text-3xl font-semibold text-slate-950 dark:text-white">How We Measure Impact</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Published figures follow the platform's existing record, review and reporting processes.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                ['01', 'Record', 'Assistance activities and financial transactions are recorded in the platform.', FileCheck2],
                ['02', 'Review', 'Cases are reviewed and distributions are linked to applicable public records.', Eye],
                ['03', 'Confirm', 'Only confirmed donations and verified, public assistance records contribute.', ShieldCheck],
                ['04', 'Report', 'Approved aggregates are published without confidential beneficiary data.', LockKeyhole],
              ].map(([number, title, copy, Icon]) => (
                <article key={String(title)} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800 dark:bg-slate-900/55">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-400">{String(number)}</span><Icon className="h-5 w-5 text-slate-600 dark:text-slate-300" /></div>
                  <h3 className="mt-4 font-semibold text-slate-950 dark:text-white">{String(title)}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{String(copy)}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 grid gap-4 text-xs leading-6 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <p><strong className="text-slate-900 dark:text-white">Confirmed donation:</strong> a database record with confirmed status.</p>
              <p><strong className="text-slate-900 dark:text-white">Distributed assistance:</strong> a distribution record linked to a verified, public humanitarian case.</p>
              <p><strong className="text-slate-900 dark:text-white">Reported reach:</strong> sum of case-reported affected counts; it is not a deduplicated beneficiary count. No stable privacy-safe beneficiary identifier exists in the current schema, so unique beneficiaries are unavailable.</p>
              <p><strong className="text-slate-900 dark:text-white">Geographic coverage:</strong> country-level aggregates only, with at least {impact.privacyThreshold} distinct verified public cases per country; sub-country locations are suppressed.</p>
              <p><strong className="text-slate-900 dark:text-white">Projects and programmes:</strong> not reported because the current database has no separate projects or programme records.</p>
            </div>
          </section>

          <section className="mt-10 rounded-xl border border-slate-200 bg-slate-950 p-6 text-white dark:border-slate-700 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Accountability Beyond Numbers</p>
            <h2 className="mt-3 font-editorial text-2xl font-semibold">Human responsibility, clearly reported</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [CircleDollarSign, 'Verified Financial Records', 'Published totals exclude unconfirmed transactions.'],
                [LockKeyhole, 'Responsible Beneficiary Data Protection', 'Private names, contacts and exact locations remain restricted.'],
                [Eye, 'Human Review and Oversight', 'Public case figures depend on approved platform records.'],
                [BarChart3, 'Transparent Impact Reporting', 'Charts and tables use the same published, aggregated data.'],
              ].map(([Icon, title, copy]) => (
                <div key={String(title)} className="border-l border-slate-700 pl-4">
                  <Icon className="h-5 w-5 text-slate-300" />
                  <h3 className="mt-3 text-sm font-semibold">{String(title)}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{String(copy)}</p>
                </div>
              ))}
            </div>
            <Link to="/policies/transparency" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/10">
              Read Donation Transparency <ArrowUpRight className="h-4 w-4" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
