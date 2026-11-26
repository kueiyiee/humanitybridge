import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight,
  Bell,
  BookOpen,
  DollarSign,
  FileCheck2,
  Handshake,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Database,
  RefreshCw,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { DashboardLayout, type DashboardNavItem } from '../../layouts/DashboardLayout';
import { apiRequest } from '../../services/api';
import { AdminBankTransfersPanel } from './AdminBankTransfersPanel';
import { AdminNotificationsPanel } from './AdminNotificationsPanel';
import {
  AdminCampaignsPanel,
  AdminCasesPanel,
  AdminOutreachAndNewsPanel,
  AdminStoriesPanel,
} from './AdminOperationsPanels';
import {
  AdminFinancialsPanel,
  AdminSafeguardingAndSettingsPanel,
  AdminUsersPanel,
} from './AdminGovernancePanels';

interface AdminDashboardData {
  metrics: {
    totalUsers: number;
    activeCoordinators: number;
    verifiedCases: number;
    pendingCases: number;
    storiesAwaitingModeration: number;
    pendingBankTransfers: number;
    activeCampaigns: number;
    completedCampaigns: number;
    confirmedDonationsCount: number;
    confirmedDonationsUsd: number;
    totalFundsDistributedUsd: number;
    outstandingAssistanceRequests: number;
    openSafeguardingAlerts: number;
  };
  systemHealth: {
    database: string;
    status: string;
    checkedAt: string;
  };
  campaignPerformance: Array<{ title: string; targetAmount: number; raisedAmount: number }>;
  caseStatusBreakdown: Array<{ status: string; count: number }>;
  recentAudit: Array<{
    id: number;
    action: string;
    resourceType: string;
    resourceId: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
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

const ADMIN_NAV: DashboardNavItem[] = [
  { id: 'overview', label: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" />, group: 'Overview', permission: 'admin:dashboard:read' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, group: 'Governance', permission: 'admin:dashboard:read' },
  { id: 'users', label: 'Users & Coordinators', icon: <Users className="w-4 h-4" />, group: 'Operations', permission: 'admin:users:manage' },
  { id: 'cases', label: 'Case Verification', icon: <FileCheck2 className="w-4 h-4" />, group: 'Operations', permission: 'admin:cases:review' },
  { id: 'stories', label: 'Story Moderation', icon: <BookOpen className="w-4 h-4" />, group: 'Operations', permission: 'admin:stories:moderate' },
  { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="w-4 h-4" />, group: 'Operations', permission: 'admin:campaigns:manage' },
  { id: 'outreach', label: 'Outreach & News', icon: <Handshake className="w-4 h-4" />, group: 'Operations', permission: 'admin:news:manage' },
  { id: 'financials', label: 'Donations & Ledger', icon: <DollarSign className="w-4 h-4" />, group: 'Finance', permission: 'admin:donations:reconcile' },
  { id: 'bank-transfers', label: 'Bank Transfers & Receipts', icon: <Landmark className="w-4 h-4" />, group: 'Finance', permission: 'admin:donations:reconcile' },
  { id: 'safeguarding', label: 'Safeguarding & Privacy', icon: <ShieldAlert className="w-4 h-4" />, group: 'Governance', permission: 'admin:safeguarding:manage' },
  { id: 'settings', label: 'Settings & Audit Logs', icon: <Settings className="w-4 h-4" />, group: 'Governance', permission: 'admin:settings:manage' },
];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiRequest<AdminDashboardData>('/admin/dashboard'),
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => apiRequest<Array<{ id: number; isRead: boolean }>>('/admin/notifications'),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const dashboard = data?.data;
  const m = dashboard?.metrics;
  const queues = m
    ? [
        { label: 'Case verification', count: m.pendingCases, tab: 'cases', description: 'Cases awaiting review or follow-up' },
        { label: 'Story moderation', count: m.storiesAwaitingModeration, tab: 'stories', description: 'Stories awaiting an editorial decision' },
        { label: 'Bank transfer reviews', count: m.pendingBankTransfers, tab: 'bank-transfers', description: 'Transfer records awaiting verification' },
        { label: 'Assistance requests', count: m.outstandingAssistanceRequests, tab: 'financials', description: 'Requests awaiting an administrative decision' },
        { label: 'Safeguarding reviews', count: m.openSafeguardingAlerts, tab: 'safeguarding', description: 'Restricted reports requiring follow-up' },
      ]
    : [];

  return (
    <DashboardLayout
      title="Administration Console"
      roleLabel="Platform Administrator"
      navItems={ADMIN_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      notificationCount={notificationsData?.data?.filter((item) => !item.isRead).length ?? 0}
    >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
                Executive Overview
              </h1>
              <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">
                A live view of humanitarian operations, pending decisions, and financial accountability.
              </p>
            </div>
            {dashboard?.systemHealth && (
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>
                  {dashboard.systemHealth.database.toUpperCase()} connected
                  <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                  Updated {formatTimestamp(dashboard.systemHealth.checkedAt)}
                </span>
              </div>
            )}
          </div>

          {isPending && (
            <div role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-[#0D223D] dark:text-slate-300">
              Loading live governance data…
            </div>
          )}
          {isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <span>{error instanceof Error ? error.message : 'Unable to load governance data.'}</span>
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex items-center gap-2 rounded-lg border border-current px-3 py-2 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}
          {!isPending && !isError && !dashboard && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              Governance data was not returned by the server.
            </div>
          )}

          {m && dashboard && (
            <>
              <section aria-label="Operational metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {[
                  { label: 'Registered users', value: m.totalUsers },
                  { label: 'Active coordinators', value: m.activeCoordinators },
                  { label: 'Verified cases', value: m.verifiedCases },
                  { label: 'Active campaigns', value: m.activeCampaigns },
                  { label: 'Stories awaiting moderation', value: m.storiesAwaitingModeration },
                  { label: 'Transfers awaiting review', value: m.pendingBankTransfers },
                  { label: 'Confirmed donations', value: formatCurrency(m.confirmedDonationsUsd), hint: `${m.confirmedDonationsCount} confirmed records` },
                  { label: 'Assistance distributed', value: formatCurrency(m.totalFundsDistributedUsd), hint: 'Recorded distributions' },
                  { label: 'Assistance requests', value: m.outstandingAssistanceRequests },
                  { label: 'Safeguarding reviews', value: m.openSafeguardingAlerts, hint: 'Restricted to administrators' },
                ].map(({ label, value, hint }) => (
                  <article
                    key={label}
                    className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0D223D]"
                  >
                    <h2 className="text-xs leading-5 text-[#748196] dark:text-slate-400">{label}</h2>
                    <p className="mt-2 truncate font-mono-tabular text-xl font-semibold text-[#0B1F3A] dark:text-white">{value}</p>
                    {hint && <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{hint}</p>}
                  </article>
                ))}
              </section>

              <section aria-labelledby="admin-queue-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D223D]">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="admin-queue-heading" className="font-editorial text-lg font-semibold">Pending governance queue</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select an item to open its authorized workspace.</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {queues.map((queue) => (
                    <button
                      key={queue.tab}
                      type="button"
                      onClick={() => setActiveTab(queue.tab)}
                      className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:hover:bg-slate-900/50"
                      aria-label={`Open ${queue.label}: ${queue.count} pending`}
                    >
                      <span className={`min-w-10 rounded-lg px-2 py-1 text-center font-mono-tabular text-sm font-bold ${queue.count > 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {queue.count}
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

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section aria-labelledby="campaign-progress-heading" className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0D223D]">
                  <h2 id="campaign-progress-heading" className="mb-4 font-editorial text-lg font-semibold">Campaign funding progress (USD)</h2>
                  <div className="h-64">
                    {dashboard.campaignPerformance.length === 0 ? (
                      <p className="pt-8 text-sm text-slate-500 dark:text-slate-400">No active campaign records to chart.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.campaignPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                          <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="raisedAmount" name="Recorded raised" fill="var(--hb-brand-primary)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="targetAmount" name="Target" fill="var(--hb-brand-accent)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>

                <section aria-labelledby="case-status-heading" className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0D223D]">
                  <h2 id="case-status-heading" className="mb-4 font-editorial text-lg font-semibold">Humanitarian case status</h2>
                  <div className="h-64">
                    {dashboard.caseStatusBreakdown.length === 0 ? (
                      <p className="pt-8 text-sm text-slate-500 dark:text-slate-400">No case records to chart.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.caseStatusBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                          <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" name="Cases" fill="var(--hb-brand-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </section>
              </div>

              <section aria-labelledby="recent-audit-heading" className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0D223D]">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="recent-audit-heading" className="font-editorial text-lg font-semibold">Recent administrative activity</h2>
                  <button type="button" onClick={() => setActiveTab('settings')} className="text-xs font-semibold text-[#20583a] hover:underline dark:text-cyan-300">
                    Open audit logs
                  </button>
                </div>
                {dashboard.recentAudit.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No administrative activity recorded yet.</p>
                ) : (
                  <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dashboard.recentAudit.map((entry) => (
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
              </section>
            </>
          )}
        </div>
      )}

      {activeTab === 'notifications' && <AdminNotificationsPanel />}
      {activeTab === 'users' && <AdminUsersPanel />}
      {activeTab === 'cases' && <AdminCasesPanel />}
      {activeTab === 'stories' && <AdminStoriesPanel />}
      {activeTab === 'campaigns' && <AdminCampaignsPanel />}
      {activeTab === 'financials' && <AdminFinancialsPanel />}
      {activeTab === 'bank-transfers' && <AdminBankTransfersPanel />}
      {activeTab === 'outreach' && <AdminOutreachAndNewsPanel />}
      {activeTab === 'safeguarding' && <AdminSafeguardingAndSettingsPanel mode="safeguarding" />}
      {activeTab === 'settings' && <AdminSafeguardingAndSettingsPanel mode="settings" />}
    </DashboardLayout>
  );
}
