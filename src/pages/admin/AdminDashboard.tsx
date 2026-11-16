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
  BookOpen,
  DollarSign,
  FileCheck2,
  Handshake,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { DashboardLayout, type DashboardNavItem } from '../../layouts/DashboardLayout';
import { apiRequest } from '../../services/api';
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
    verifiedCases: number;
    pendingCases: number;
    activeCampaigns: number;
    completedCampaigns: number;
    confirmedDonationsCount: number;
    confirmedDonationsUsd: number;
    totalFundsDistributedUsd: number;
    outstandingAssistanceRequests: number;
    openSafeguardingAlerts: number;
  };
  campaignPerformance: Array<{ title: string; targetAmount: number; raisedAmount: number }>;
  caseStatusBreakdown: Array<{ status: string; count: number }>;
  recentAudit: Array<{ id: number; action: string; resourceType: string; createdAt: string }>;
}

const ADMIN_NAV: DashboardNavItem[] = [
  { id: 'overview', label: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', label: 'Users & Coordinators', icon: <Users className="w-4 h-4" /> },
  { id: 'cases', label: 'Case Verification', icon: <FileCheck2 className="w-4 h-4" /> },
  { id: 'stories', label: 'Story Moderation', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { id: 'financials', label: 'Donations & Ledger', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'outreach', label: 'Outreach & News', icon: <Handshake className="w-4 h-4" /> },
  { id: 'safeguarding', label: 'Safeguarding & Privacy', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings & Audit Logs', icon: <Settings className="w-4 h-4" /> },
];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiRequest<AdminDashboardData>('/admin/dashboard'),
  });

  const m = data?.data?.metrics;

  return (
    <DashboardLayout
      title="Administration Console"
      roleLabel="Platform Administrator"
      navItems={ADMIN_NAV}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
              Executive Overview
            </h1>
            <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">
              Live relational platform governance, financial settlement, and safeguarding telemetry.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Registered Accounts', m?.totalUsers ?? 0],
              ['Verified Cases', m?.verifiedCases ?? 0],
              ['Pending Case Reviews', m?.pendingCases ?? 0],
              ['Active Campaigns', m?.activeCampaigns ?? 0],
              ['Confirmed Donations', `$${(m?.confirmedDonationsUsd ?? 0).toLocaleString()}`],
              ['Funds Distributed', `$${(m?.totalFundsDistributedUsd ?? 0).toLocaleString()}`],
              ['Assistance Requests', m?.outstandingAssistanceRequests ?? 0],
              ['Safeguarding Alerts', m?.openSafeguardingAlerts ?? 0],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-5"
              >
                <p className="text-xs text-[#748196] dark:text-slate-400">{label}</p>
                <p className="mt-2 font-mono-tabular text-2xl font-semibold text-[#0B1F3A] dark:text-white">
                  {val}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="font-editorial text-lg font-semibold mb-4">Campaign Funding Progress (USD)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.data?.campaignPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                    <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="raisedAmount" name="Confirmed Raised" fill="#16865D" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="targetAmount" name="Target" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="font-editorial text-lg font-semibold mb-4">Recent Administrative & Security Activity</h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {(data?.data?.recentAudit || []).slice(0, 7).map((a) => (
                  <li key={a.id} className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold">{a.action}</span>
                    <span className="font-mono-tabular text-[#748196]">{a.createdAt.slice(0, 16)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && <AdminUsersPanel />}
      {activeTab === 'cases' && <AdminCasesPanel />}
      {activeTab === 'stories' && <AdminStoriesPanel />}
      {activeTab === 'campaigns' && <AdminCampaignsPanel />}
      {activeTab === 'financials' && <AdminFinancialsPanel />}
      {activeTab === 'outreach' && <AdminOutreachAndNewsPanel />}
      {activeTab === 'safeguarding' && <AdminSafeguardingAndSettingsPanel mode="safeguarding" />}
      {activeTab === 'settings' && <AdminSafeguardingAndSettingsPanel mode="settings" />}
    </DashboardLayout>
  );
}
