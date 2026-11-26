import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  ClipboardList,
  FilePlus2,
  HandHeart,
  LayoutDashboard,
  Landmark,
  MapPin,
  Settings,
} from 'lucide-react';
import { DashboardLayout, type DashboardNavItem } from '../../layouts/DashboardLayout';
import { apiRequest } from '../../services/api';
import { MfaSettingsPanel } from '../../components/security/MfaSettingsPanel';
import { CoordinatorBankTransfersPanel } from './CoordinatorBankTransfersPanel';
import { useAuth } from '../../contexts/AuthContext';
import {
  CoordinatorAssistanceAndReports,
  CoordinatorCaseForm,
  CoordinatorStoryForm,
} from './CoordinatorForms';

interface CoordDashboardData {
  summary: {
    totalSubmittedCases: number;
    pendingVerification: number;
    approvedCases: number;
    rejectedCases: number;
    draftCases: number;
    submittedStories: number;
    publishedStories: number;
    unreadNotifications: number;
  };
  recentCases: Array<{
    id: number;
    referenceCode: string;
    title: string;
    status: string;
    urgencyLevel: string;
    updatedAt: string;
  }>;
  announcements: Array<{ id: number; title: string; body: string; publishedAt: string }>;
}

const NAV_ITEMS: DashboardNavItem[] = [
  { id: 'overview', label: 'Community Overview', icon: <LayoutDashboard className="w-4 h-4" />, group: 'Overview', permission: 'coordinator:dashboard:read' },
  { id: 'register-case', label: 'Register Case', icon: <FilePlus2 className="w-4 h-4" />, group: 'Submissions', permission: 'coordinator:cases:create' },
  { id: 'submit-story', label: 'Submit Story', icon: <BookOpen className="w-4 h-4" />, group: 'Submissions', permission: 'coordinator:stories:submit' },
  { id: 'assistance', label: 'Assistance Requests', icon: <HandHeart className="w-4 h-4" />, group: 'Field work', permission: 'coordinator:assistance:submit' },
  { id: 'bank-transfers', label: 'Bank Transfer Evidence', icon: <Landmark className="w-4 h-4" />, group: 'Field work' },
  { id: 'reports', label: 'Field Reports', icon: <MapPin className="w-4 h-4" />, group: 'Field work', permission: 'coordinator:reports:submit' },
  { id: 'submissions', label: 'My Submissions', icon: <ClipboardList className="w-4 h-4" />, group: 'Submissions', permission: 'coordinator:cases:read_own' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, group: 'Account', permission: 'coordinator:notifications:read' },
  { id: 'settings', label: 'Account Settings', icon: <Settings className="w-4 h-4" />, group: 'Account', permission: 'coordinator:profile:manage' },
];

export function CoordinatorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const { user, refreshSession } = useAuth();
  const qc = useQueryClient();

  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [profileRegion, setProfileRegion] = useState(user?.region || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const { data: dashData } = useQuery({
    queryKey: ['coordinator-dashboard'],
    queryFn: () => apiRequest<CoordDashboardData>('/coordinator/dashboard'),
  });

  const { data: taxData } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: () =>
      apiRequest<{
        caseCategories: Array<{ id: number; name: string }>;
        storyCategories: Array<{ id: number; name: string }>;
        locations: Array<{ id: number; regionName: string; country: string }>;
      }>('/meta/taxonomy'),
  });

  const { data: myCasesData } = useQuery({
    queryKey: ['coordinator-cases'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          referenceCode: string;
          title: string;
          status: string;
          urgencyLevel: string;
          internalAdminNotes: string | null;
          updatedAt: string;
          categoryName: string;
          regionName: string;
        }>
      >('/coordinator/cases'),
  });

  const { data: myStoriesData } = useQuery({
    queryKey: ['coordinator-stories'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          title: string;
          status: string;
          regionName: string;
          updatedAt: string;
          categoryName: string;
        }>
      >('/coordinator/stories'),
  });

  const { data: assistData } = useQuery({
    queryKey: ['coordinator-assistance'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          caseReference: string;
          supportType: string;
          requestedAmountUsd: number;
          status: string;
          adminFeedback: string | null;
          createdAt: string;
        }>
      >('/coordinator/assistance-requests'),
  });

  const { data: reportsData } = useQuery({
    queryKey: ['coordinator-reports'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          visitDate: string;
          regionName: string;
          caseReference: string | null;
          summary: string;
          peopleReached: number;
        }>
      >('/coordinator/reports'),
  });

  const { data: notifData } = useQuery({
    queryKey: ['coordinator-notifications'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          eventType: string;
          title: string;
          message: string;
          isRead: boolean;
          createdAt: string;
        }>
      >('/coordinator/notifications'),
  });

  const { data: sessionsData } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () =>
      apiRequest<Array<{ id: number; ipAddress: string; userAgent: string; isCurrent: boolean; revokedAt: string | null; createdAt: string }>>(
        '/auth/sessions',
      ),
    enabled: activeTab === 'settings',
  });

  const summary = dashData?.data?.summary;
  const myCases = myCasesData?.data || [];
  const myStories = myStoriesData?.data || [];

  const combinedSubmissions = [
    ...myCases.map((c) => ({
      ref: c.referenceCode,
      type: 'Humanitarian Case',
      title: c.title,
      status: c.status,
      updatedAt: c.updatedAt,
      feedback: c.internalAdminNotes || 'Pending administrative review',
    })),
    ...myStories.map((s) => ({
      ref: `STORY-${s.id}`,
      type: 'Community Story',
      title: s.title,
      status: s.status,
      updatedAt: s.updatedAt,
      feedback: 'Editorial & consent review queue',
    })),
  ].filter(
    (item) =>
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ref.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleMarkRead = async (id: number) => {
    await apiRequest(`/coordinator/notifications/${id}/read`, { method: 'PATCH' });
    qc.invalidateQueries({ queryKey: ['coordinator-notifications'] });
    qc.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: profileName, region: profileRegion }),
    });
    setSettingsMsg(res.message);
    await refreshSession();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    setSettingsMsg(res.message);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <DashboardLayout
      title="Community Portal"
      roleLabel="Community Coordinator"
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      notificationCount={dashData?.data?.summary.unreadNotifications ?? 0}
    >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
              Community Overview
            </h1>
            <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">
              Field intake summary for {user?.region || 'your assigned community corridor'}.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Submitted Cases', summary?.totalSubmittedCases ?? 0],
              ['Pending Verification', summary?.pendingVerification ?? 0],
              ['Verified Cases', summary?.approvedCases ?? 0],
              ['Published Stories', summary?.publishedStories ?? 0],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-5"
              >
                <p className="text-xs text-[#748196] dark:text-slate-400">{label}</p>
                <p className="mt-2 font-mono-tabular text-2xl font-semibold">{val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-editorial text-lg font-semibold">Recent Cases</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('register-case')}
                  className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB] hover:underline"
                >
                  + Register New Case
                </button>
              </div>
              {myCases.length === 0 ? (
                <p className="text-xs text-[#748196]">No cases submitted yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {myCases.slice(0, 5).map((c) => (
                    <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-mono-tabular text-xs text-[#123F69] dark:text-[#00BCEB]">{c.referenceCode}</p>
                        <p className="font-medium truncate">{c.title}</p>
                      </div>
                      <span className="text-xs font-semibold shrink-0">{c.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="font-editorial text-lg font-semibold mb-4">Recent Notifications</h2>
              {(notifData?.data || []).length === 0 ? (
                <p className="text-xs text-[#748196]">You are caught up on administrative feedback.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {(notifData?.data || []).slice(0, 5).map((n) => (
                    <li key={n.id} className="py-3">
                      <p className="font-semibold text-xs text-[#0B1F3A] dark:text-white">{n.title}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'register-case' && (
        <CoordinatorCaseForm taxonomy={taxData?.data} onSuccess={() => setActiveTab('submissions')} />
      )}

      {activeTab === 'submit-story' && <CoordinatorStoryForm taxonomy={taxData?.data} />}

      {activeTab === 'assistance' && (
        <div className="space-y-6">
          <CoordinatorAssistanceAndReports myCases={myCases} taxonomy={taxData?.data} mode="assistance" />
          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-editorial text-lg font-semibold">My Assistance Requests</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
                  <tr>
                    <th className="px-5 py-3">Case Ref</th>
                    <th className="px-5 py-3">Support Type</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(assistData?.data || []).map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-mono-tabular text-xs">{r.caseReference}</td>
                      <td className="px-5 py-3">{r.supportType}</td>
                      <td className="px-5 py-3 text-right font-mono-tabular">${r.requestedAmountUsd.toLocaleString()}</td>
                      <td className="px-5 py-3 font-semibold text-xs">{r.status}</td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">{r.adminFeedback || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bank-transfers' && <CoordinatorBankTransfersPanel />}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <CoordinatorAssistanceAndReports myCases={myCases} taxonomy={taxData?.data} mode="report" />
          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-editorial text-lg font-semibold">Submitted Field Activity Reports</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
                  <tr>
                    <th className="px-5 py-3">Visit Date</th>
                    <th className="px-5 py-3">Region</th>
                    <th className="px-5 py-3">Case</th>
                    <th className="px-5 py-3 text-right">People Reached</th>
                    <th className="px-5 py-3">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(reportsData?.data || []).map((rep) => (
                    <tr key={rep.id}>
                      <td className="px-5 py-3 font-mono-tabular text-xs">{rep.visitDate.slice(0, 10)}</td>
                      <td className="px-5 py-3">{rep.regionName}</td>
                      <td className="px-5 py-3 font-mono-tabular text-xs">{rep.caseReference || 'General'}</td>
                      <td className="px-5 py-3 text-right font-mono-tabular">{rep.peopleReached.toLocaleString()}</td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">{rep.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-editorial text-xl font-semibold">My Submissions</h2>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by reference or title..."
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#071324] text-xs w-full sm:w-64"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
                <tr>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Administrative Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {combinedSubmissions.map((s) => (
                  <tr key={`${s.type}-${s.ref}`}>
                    <td className="px-5 py-3 font-mono-tabular text-xs font-semibold">{s.ref}</td>
                    <td className="px-5 py-3 text-xs">{s.type}</td>
                    <td className="px-5 py-3 font-medium">{s.title}</td>
                    <td className="px-5 py-3 text-xs font-semibold">{s.status}</td>
                    <td className="px-5 py-3 font-mono-tabular text-xs">{s.updatedAt.slice(0, 10)}</td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">{s.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="font-editorial text-xl font-semibold">Notifications</h2>
          {(notifData?.data || []).length === 0 ? (
            <p className="text-sm text-[#748196]">No notifications.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {(notifData?.data || []).map((n) => (
                <li key={n.id} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                    <p className="mt-1 text-[11px] font-mono-tabular text-[#748196]">{n.createdAt.slice(0, 16)}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium shrink-0"
                    >
                      Mark Read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleProfileSave}
            className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-editorial text-xl font-semibold">Profile Settings</h2>
            {settingsMsg && <p className="text-xs text-[#16865D]">{settingsMsg}</p>}
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Assigned Region</label>
              <input value={profileRegion} onChange={(e) => setProfileRegion(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
              Save Profile
            </button>
          </form>

          <form
            onSubmit={handlePasswordChange}
            className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-editorial text-xl font-semibold">Change Password</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password (10+ characters)</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold">
              Update Password
            </button>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#748196] mb-2">Active Sessions</h3>
              <ul className="space-y-2 text-xs">
                {(sessionsData?.data || []).slice(0, 4).map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span className="font-mono-tabular truncate max-w-[200px]">
                      {s.ipAddress} {s.isCurrent ? '(Current)' : ''}
                    </span>
                    <span className="text-[#748196]">{s.revokedAt ? 'Revoked' : 'Active'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </form>
          <div className="lg:col-span-2"><MfaSettingsPanel /></div>
        </div>
      )}
    </DashboardLayout>
  );
}
