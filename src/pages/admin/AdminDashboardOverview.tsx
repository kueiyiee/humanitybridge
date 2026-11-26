import {
  Activity,
  ArrowRight,
  BookOpen,
  DollarSign,
  FileCheck2,
  HandHeart,
  Landmark,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardMetricCard } from '../../components/dashboard/DashboardMetricCard';
import type { AdminDashboardData } from './AdminDashboardTypes';

interface AdminDashboardOverviewProps {
  data?: AdminDashboardData;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  onNavigate: (tab: string) => void;
  permissions: string[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

const panelClass = 'hb-admin-panel rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-[#171b1e]/90 sm:p-6';

export function AdminDashboardOverview({
  data,
  isPending,
  isFetching,
  isError,
  error,
  onRetry,
  onNavigate,
  permissions,
}: AdminDashboardOverviewProps) {
  const can = (permission: string) => permissions.includes(permission);
  const metrics = data?.metrics;
  const queues = metrics ? [
    ...(can('admin:cases:review') ? [{ label: 'Case verification', count: metrics.pendingCases, tab: 'cases', description: 'Cases awaiting review or follow-up', icon: <FileCheck2 className="h-4 w-4" /> }] : []),
    ...(can('admin:stories:moderate') ? [{ label: 'Story moderation', count: metrics.storiesAwaitingModeration, tab: 'stories', description: 'Stories awaiting an editorial decision', icon: <BookOpen className="h-4 w-4" /> }] : []),
    ...(can('admin:donations:reconcile') ? [{ label: 'Bank transfer reviews', count: metrics.pendingBankTransfers, tab: 'bank-transfers', description: 'Transfer records awaiting verification', icon: <Landmark className="h-4 w-4" /> }] : []),
    ...(can('admin:assistance:manage') ? [{ label: 'Assistance requests', count: metrics.outstandingAssistanceRequests, tab: 'outreach', description: 'Requests awaiting an administrative decision', icon: <HandHeart className="h-4 w-4" /> }] : []),
    ...(can('admin:safeguarding:manage') ? [{ label: 'Safeguarding reviews', count: metrics.openSafeguardingAlerts, tab: 'safeguarding', description: 'Restricted reports requiring follow-up', icon: <ShieldAlert className="h-4 w-4" /> }] : []),
  ] : [];
  const pendingTotal = queues.reduce((total, item) => total + item.count, 0);

  return (
    <div className="hb-admin-overview space-y-7">
      <header className="hb-admin-hero flex flex-col gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-100/70 p-5 shadow-sm dark:border-slate-800 dark:from-[#171b1e] dark:via-[#171b1e] dark:to-[#20272b] sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--hb-accent-strong)]">Platform administration</p>
          <h1 className="mt-2 font-editorial text-3xl font-semibold tracking-tight text-[var(--hb-text-strong)] dark:text-white sm:text-4xl">
            Executive Overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            A live view of humanitarian operations, pending decisions, and financial accountability.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            disabled={isFetching}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isFetching ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {isPending && (
        <div role="status" className={`${panelClass} text-sm text-slate-600 dark:text-slate-300`}>
          Loading live governance data…
        </div>
      )}
      {isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <span>{error?.message || 'Unable to load governance data.'}</span>
          <button type="button" onClick={onRetry} className="rounded-lg border border-current px-3 py-2 text-xs font-semibold">
            Try again
          </button>
        </div>
      )}
      {!isPending && !isError && !data && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          Governance data was not returned by the server.
        </div>
      )}

      {data && metrics && (
        <>
          <section aria-label="Operational metrics" className="hb-metrics-grid grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {can('admin:users:manage') && <DashboardMetricCard label="Registered users" value={metrics.totalUsers.toLocaleString()} hint={`${metrics.activeUsers.toLocaleString()} active · ${metrics.inactiveUsers.toLocaleString()} inactive · ${metrics.administratorUsers.toLocaleString()} administrators`} icon={<Users className="h-4 w-4" />} tone="neutral" actionLabel="Manage users" onClick={() => onNavigate('users')} />}
            {can('admin:users:manage') && <DashboardMetricCard label="Active coordinators" value={metrics.activeCoordinators.toLocaleString()} icon={<Users className="h-4 w-4" />} tone="success" actionLabel="Manage users" onClick={() => onNavigate('users')} />}
            {can('admin:settings:manage') && <DashboardMetricCard label="Failed sign-ins (24h)" value={metrics.failedLoginAttempts24h.toLocaleString()} icon={<Activity className="h-4 w-4" />} tone={metrics.failedLoginAttempts24h > 0 ? 'attention' : 'neutral'} actionLabel="Review security settings" onClick={() => onNavigate('settings')} />}
            {can('admin:cases:review') && <DashboardMetricCard label="Verified cases" value={metrics.verifiedCases.toLocaleString()} icon={<FileCheck2 className="h-4 w-4" />} tone="success" actionLabel="Review cases" onClick={() => onNavigate('cases')} />}
            {can('admin:campaigns:manage') && <DashboardMetricCard label="Active campaigns" value={metrics.activeCampaigns.toLocaleString()} icon={<Megaphone className="h-4 w-4" />} tone="neutral" actionLabel="View campaigns" onClick={() => onNavigate('campaigns')} />}
            {can('admin:stories:moderate') && <DashboardMetricCard label="Stories to moderate" value={metrics.storiesAwaitingModeration.toLocaleString()} icon={<BookOpen className="h-4 w-4" />} tone="attention" actionLabel="Review stories" onClick={() => onNavigate('stories')} />}
            {can('admin:donations:reconcile') && <DashboardMetricCard label="Transfers to review" value={metrics.pendingBankTransfers.toLocaleString()} icon={<Landmark className="h-4 w-4" />} tone="attention" actionLabel="Review transfers" onClick={() => onNavigate('bank-transfers')} />}
            {can('admin:donations:reconcile') && <DashboardMetricCard label="Confirmed donations" value={formatCurrency(metrics.confirmedDonationsUsd)} hint={`${metrics.confirmedDonationsCount.toLocaleString()} confirmed records`} icon={<DollarSign className="h-4 w-4" />} tone="finance" actionLabel="Open financials" onClick={() => onNavigate('financials')} />}
            {can('admin:donations:reconcile') && <DashboardMetricCard label="Assistance distributed" value={formatCurrency(metrics.totalFundsDistributedUsd)} hint="Recorded distributions" icon={<HandHeart className="h-4 w-4" />} tone="finance" actionLabel="Open financials" onClick={() => onNavigate('financials')} />}
            {can('admin:assistance:manage') && <DashboardMetricCard label="Assistance requests" value={metrics.outstandingAssistanceRequests.toLocaleString()} icon={<Activity className="h-4 w-4" />} tone="attention" actionLabel="Review requests" onClick={() => onNavigate('outreach')} />}
            {can('admin:safeguarding:manage') && <DashboardMetricCard label="Safeguarding reviews" value={metrics.openSafeguardingAlerts.toLocaleString()} hint="Restricted to administrators" icon={<ShieldAlert className="h-4 w-4" />} tone="attention" actionLabel="Open safeguarding" onClick={() => onNavigate('safeguarding')} />}
          </section>

          <section aria-labelledby="admin-queue-heading" className={panelClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="admin-queue-heading" className="font-editorial text-lg font-semibold">Pending governance queue</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Prioritized workspaces for administrative review.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${pendingTotal > 0 ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-cyan-50 text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200'}`}>
                {pendingTotal > 0 ? `${pendingTotal.toLocaleString()} open items` : 'All queues clear'}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {queues.map((queue) => (
                <button
                  key={queue.tab}
                  type="button"
                  onClick={() => onNavigate(queue.tab)}
                  className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)] dark:hover:bg-slate-900/50"
                  aria-label={`Open ${queue.label}: ${queue.count} pending`}
                >
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${queue.count > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`} aria-hidden="true">
                    {queue.icon}
                  </span>
                  <span className={`min-w-10 rounded-lg px-2 py-1 text-center font-mono-tabular text-sm font-bold ${queue.count > 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {queue.count.toLocaleString()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{queue.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{queue.description}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {can('admin:campaigns:manage') && <section aria-labelledby="campaign-progress-heading" className={panelClass}>
              <div className="mb-4">
                <h2 id="campaign-progress-heading" className="font-editorial text-lg font-semibold">Campaign funding progress</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recorded amounts compared with campaign targets (USD).</p>
              </div>
              <div className="h-64">
                {data.campaignPerformance.length === 0 ? (
                  <p className="pt-8 text-sm text-slate-500 dark:text-slate-400">No campaign records to chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.campaignPerformance} margin={{ left: 8, right: 12, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                      <XAxis dataKey="title" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={54} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="raisedAmount" name="Recorded raised" fill="var(--hb-chart-primary)" radius={[5, 5, 0, 0]} animationDuration={850} />
                      <Bar dataKey="targetAmount" name="Target" fill="var(--hb-chart-secondary)" radius={[5, 5, 0, 0]} animationDuration={850} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>}

            {can('admin:cases:review') && <section aria-labelledby="case-status-heading" className={panelClass}>
              <div className="mb-4">
                <h2 id="case-status-heading" className="font-editorial text-lg font-semibold">Humanitarian case status</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current case volume grouped by workflow stage.</p>
              </div>
              <div className="h-64">
                {data.caseStatusBreakdown.length === 0 ? (
                  <p className="pt-8 text-sm text-slate-500 dark:text-slate-400">No case records to chart.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.caseStatusBreakdown} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                      <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Cases" fill="var(--hb-chart-primary)" radius={[5, 5, 0, 0]} animationDuration={850} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>}
          </div>

          {can('admin:audit:read') && <section aria-labelledby="recent-audit-heading" className={panelClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="recent-audit-heading" className="font-editorial text-lg font-semibold">Recent administrative activity</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest recorded governance events.</p>
              </div>
              <button type="button" onClick={() => onNavigate('audit')} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--hb-accent-strong)] hover:underline dark:text-cyan-300">
                Open audit logs <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {data.recentAudit.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No administrative activity recorded yet.</p>
            ) : (
              <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentAudit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.action.replaceAll('_', ' ')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.resourceType}{entry.resourceId ? ` · ${entry.resourceId}` : ''} · {entry.actorRole || 'System'}
                    </span>
                    <time className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400" dateTime={entry.createdAt}>
                      {formatTimestamp(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>}
        </>
      )}
    </div>
  );
}
