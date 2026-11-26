import React, { Suspense, lazy, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  DollarSign,
  FileCheck2,
  Files,
  Handshake,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { DashboardLayout, type DashboardNavItem } from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../services/api';
import { ROLE_DISPLAY_NAMES } from '../../../packages/shared/types';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import type { AdminDashboardData } from './AdminDashboardTypes';
import { AdminBankTransfersPanel } from './AdminBankTransfersPanel';
const AdminDocumentCentre = lazy(() =>
  import('./AdminDocumentCentre').then((module) => ({ default: module.AdminDocumentCentre })),
);
import { AdminNotificationsPanel } from './AdminNotificationsPanel';
import { ContentStudioPanel } from './ContentStudioPanel';
import {
  AdminCampaignsPanel,
  AdminCasesPanel,
  AdminOutreachAndNewsPanel,
  AdminStoriesPanel,
} from './AdminOperationsPanels';
import {
  AdminFinancialsPanel,
  AdminAuditPanel,
  AdminSafeguardingAndSettingsPanel,
  AdminUsersPanel,
} from './AdminGovernancePanels';

const ADMIN_NAV: DashboardNavItem[] = [
  { id: 'overview', label: 'Executive Overview', icon: <LayoutDashboard className="w-4 h-4" />, group: 'Overview', permission: 'admin:dashboard:read' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, group: 'Governance', permission: 'admin:dashboard:read' },
  { id: 'users', label: 'Users & Coordinators', icon: <Users className="w-4 h-4" />, group: 'Operations', permission: 'admin:users:manage' },
  { id: 'cases', label: 'Case Verification', icon: <FileCheck2 className="w-4 h-4" />, group: 'Operations', permission: 'admin:cases:review' },
  { id: 'stories', label: 'Story Moderation', icon: <BookOpen className="w-4 h-4" />, group: 'Operations', permission: 'admin:stories:moderate' },
  { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="w-4 h-4" />, group: 'Operations', permission: 'admin:campaigns:manage' },
  { id: 'outreach', label: 'Outreach & News', icon: <Handshake className="w-4 h-4" />, group: 'Operations', permission: 'admin:outreach:manage' },
  { id: 'content-studio', label: 'Content Studio', icon: <BookOpen className="w-4 h-4" />, group: 'Operations', permission: 'admin:news:manage' },
  { id: 'financials', label: 'Donations & Ledger', icon: <DollarSign className="w-4 h-4" />, group: 'Finance', permission: 'admin:donations:reconcile' },
  { id: 'bank-transfers', label: 'Bank Transfers & Receipts', icon: <Landmark className="w-4 h-4" />, group: 'Finance', permission: 'admin:donations:reconcile' },
  { id: 'safeguarding', label: 'Safeguarding & Privacy', icon: <ShieldAlert className="w-4 h-4" />, group: 'Governance', permission: 'admin:safeguarding:manage' },
  { id: 'documents', label: 'Document Centre', icon: <Files className="w-4 h-4" />, group: 'Governance', permission: 'admin:documents:manage' },
  { id: 'audit', label: 'Audit Trail', icon: <ShieldAlert className="w-4 h-4" />, group: 'Governance', permission: 'admin:audit:read' },
  { id: 'settings', label: 'Settings & Audit Logs', icon: <Settings className="w-4 h-4" />, group: 'Governance', permission: 'admin:settings:manage' },
];

function formatHealthTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function AdminDashboard() {
  const { user, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const navigateToTab = (tab: string) => {
    const item = ADMIN_NAV.find((candidate) => candidate.id === tab);
    if (item?.permission && permissions.includes(item.permission)) setActiveTab(tab);
  };

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
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
  const systemHealth = dashboard?.systemHealth;
  const systemHealthy = systemHealth
    ? systemHealth.api === 'available' &&
      systemHealth.databaseStatus === 'connected' &&
      systemHealth.privateStorageStatus === 'available' &&
      systemHealth.publicMediaStatus === 'available'
    : false;
  const healthChecks = systemHealth
    ? [
        { label: 'API', value: systemHealth.api },
        { label: `Database (${systemHealth.database.toUpperCase()})`, value: systemHealth.databaseStatus },
        { label: 'Private storage', value: systemHealth.privateStorageStatus },
        { label: 'Public media', value: systemHealth.publicMediaStatus },
      ]
    : [];
  return (
    <DashboardLayout
      title="Administration Console"
      roleLabel={user ? ROLE_DISPLAY_NAMES[user.role] : 'Administrator'}
      navItems={ADMIN_NAV}
      activeTab={activeTab}
      onSelectTab={navigateToTab}
      notificationCount={notificationsData?.data?.filter((item) => !item.isRead).length ?? 0}
      footerStatus={systemHealth && (
        <details className={`hb-system-status ${systemHealthy ? 'is-healthy' : 'has-issues'}`}>
          <summary aria-label={`System status: ${systemHealthy ? 'all services operational' : 'service attention required'}`}>
            <span className="hb-system-status-indicator" aria-hidden="true" />
            <span className="hb-system-status-summary">
              <strong>Platform status</strong>
              <small>{systemHealthy ? 'All services operational' : 'Service attention required'}</small>
            </span>
          </summary>
          <div className="hb-system-status-details">
            {healthChecks.map((check) => (
              <div key={check.label}>
                <span>{check.label}</span>
                <strong>{check.value}</strong>
              </div>
            ))}
            <time dateTime={systemHealth.checkedAt}>Updated {formatHealthTimestamp(systemHealth.checkedAt)}</time>
          </div>
        </details>
      )}
      variant="admin"
    >
      {activeTab === 'overview' && (
        <AdminDashboardOverview
          data={dashboard}
          isPending={isPending}
          isFetching={isFetching}
          isError={isError}
          error={error}
          onRetry={() => void refetch()}
          onNavigate={navigateToTab}
          permissions={permissions}
        />
      )}

      {activeTab === 'notifications' && <AdminNotificationsPanel />}
      {activeTab === 'users' && <AdminUsersPanel />}
      {activeTab === 'cases' && <AdminCasesPanel />}
      {activeTab === 'stories' && <AdminStoriesPanel />}
      {activeTab === 'campaigns' && <AdminCampaignsPanel />}
      {activeTab === 'financials' && <AdminFinancialsPanel />}
      {activeTab === 'bank-transfers' && <AdminBankTransfersPanel />}
      {activeTab === 'outreach' && <AdminOutreachAndNewsPanel />}
      {activeTab === 'content-studio' && <ContentStudioPanel />}
      {activeTab === 'safeguarding' && <AdminSafeguardingAndSettingsPanel mode="safeguarding" />}
      {activeTab === 'documents' && (
        <Suspense fallback={<div className="py-12 text-center text-sm text-slate-500">Loading Document Centre…</div>}>
          <AdminDocumentCentre />
        </Suspense>
      )}
      {activeTab === 'audit' && <AdminAuditPanel />}
      {activeTab === 'settings' && <AdminSafeguardingAndSettingsPanel mode="settings" />}
    </DashboardLayout>
  );
}
