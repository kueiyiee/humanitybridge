import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw, ShieldAlert } from 'lucide-react';
import { MfaSettingsPanel } from '../../components/security/MfaSettingsPanel';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../services/api';
import { ALL_DASHBOARD_ROLES, DASHBOARD_ROLES, ROLE_DISPLAY_NAMES } from '../../../packages/shared/types';

function formatGovernanceDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function AdminUsersPanel() {
  const { permissions } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>(DASHBOARD_ROLES.COMMUNITY_COORDINATOR);
  const [msg, setMsg] = useState<string | null>(null);
  const canAssignRoles = permissions.includes('admin:users:roles');
  const roleOptions = ALL_DASHBOARD_ROLES.filter((role) => role !== DASHBOARD_ROLES.PLATFORM_ADMIN);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          email: string;
          role: string;
          status: string;
          emailVerified: boolean;
          mfaEnabled: boolean;
          createdAt: string;
          lastLoginAt: string | null;
          displayName: string | null;
          region: string | null;
          organization: string | null;
        }>
      >('/admin/users'),
  });

  const { data: selectedUser, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['admin-user-profile', selectedUserId],
    queryFn: () => apiRequest<{
      user: {
        id: number; displayName: string | null; email: string; role: string; status: string;
        region: string | null; organization: string | null; bio: string | null; emailVerified: boolean;
        mfaEnabled: boolean; createdAt: string; lastLoginAt: string | null;
      };
      cases: Array<{ id: number; referenceCode: string; title: string; status: string; createdAt: string }>;
      stories: Array<{ id: number; title: string; status: string; createdAt: string }>;
      campaigns: Array<{ id: number; title: string; status: string; createdAt: string }>;
      activity: Array<{ id: number; action: string; resourceType: string; resourceId: string | null; createdAt: string }>;
      sessions: Array<{ createdAt: string; expiresAt: string; revokedAt: string | null }>;
    }>(`/admin/users/${selectedUserId}`),
    enabled: selectedUserId !== null,
  });

  const createCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const isCoordinator = newRole === DASHBOARD_ROLES.COMMUNITY_COORDINATOR;
      const res = await apiRequest(isCoordinator ? '/admin/users/coordinators' : '/admin/users/staff', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          displayName: newName,
          region: newRegion,
          organization: newOrganization,
          password: newPassword,
          role: newRole,
        }),
      });
      setMsg(res.message);
      setNewEmail('');
      setNewName('');
      setNewRegion('');
      setNewOrganization('');
      setNewPassword('');
      setNewRole(DASHBOARD_ROLES.COMMUNITY_COORDINATOR);
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Coordinator account could not be created.');
    }
  };

  const setRole = async (id: number, role: string) => {
    try {
      const response = await apiRequest(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMsg(response.message);
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Account role could not be changed.');
    }
  };

  const setStatus = async (id: number, status: string) => {
    try {
      const response = await apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(response.message);
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Account status could not be changed.');
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUserId) return;
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());
    try {
      const response = await apiRequest(`/admin/users/${selectedUserId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setMsg(response.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-users'] }),
        qc.invalidateQueries({ queryKey: ['admin-user-profile', selectedUserId] }),
      ]);
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Profile changes could not be saved.');
    }
  };

  const users = (data?.data || []).filter(
    (u) => {
      const query = search.trim().toLowerCase();
      const createdAtMs = Date.parse(u.createdAt);
      const registeredDate = Number.isFinite(createdAtMs) ? new Date(createdAtMs).toISOString().slice(0, 10) : '';
      return (!query || `${u.id} ${u.email} ${u.displayName || ''}`.toLowerCase().includes(query)) &&
        (statusFilter === 'ALL' || u.status === statusFilter) &&
        (roleFilter === 'ALL' || u.role === roleFilter) &&
        (verificationFilter === 'ALL' || String(u.emailVerified) === verificationFilter) &&
        (!createdAfter || registeredDate >= createdAfter) &&
        (!createdBefore || registeredDate <= createdBefore);
    },
  );

  return (
    <div className="space-y-6">
      <form onSubmit={createCoordinator} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Provision Staff Account</h2>
        {msg && <p role="status" className="text-xs text-[#16865D]">{msg}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder="Region" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input value={newOrganization} onChange={(e) => setNewOrganization(e.target.value)} placeholder="Organisation" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Initial Password (10+)" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <select value={newRole} onChange={(event) => setNewRole(event.target.value)} disabled={!canAssignRoles} aria-label="New staff role" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
            {roleOptions.map((role) => <option key={role} value={role}>{ROLE_DISPLAY_NAMES[role]}</option>)}
          </select>
        </div>
        <button type="submit" className="px-5 py-2 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-xs font-semibold">
          Create {ROLE_DISPLAY_NAMES[newRole as keyof typeof ROLE_DISPLAY_NAMES]} Account
        </button>
      </form>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between gap-3">
          <h2 className="font-editorial text-lg font-semibold">Registered Users & Coordinators</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name or email"
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#071324] text-xs"
          />
        </div>
        <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
          <select aria-label="Filter users by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs">
            <option value="ALL">All roles</option>{ALL_DASHBOARD_ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_DISPLAY_NAMES[role]}</option>
            ))}
          </select>
          <select aria-label="Filter users by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs">
            <option value="ALL">All account statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="PENDING_APPROVAL">Pending approval</option>
          </select>
          <select aria-label="Filter users by email verification" value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs">
            <option value="ALL">All verification states</option><option value="true">Verified</option><option value="false">Unverified</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">Registered after<input aria-label="Registration start date" type="date" value={createdAfter} onChange={(event) => setCreatedAfter(event.target.value)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" /></label>
          <label className="flex items-center gap-2 text-xs text-slate-500">Before<input aria-label="Registration end date" type="date" value={createdBefore} onChange={(event) => setCreatedBefore(event.target.value)} className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" /></label>
        </div>
        {isError && <p role="alert" className="px-6 py-3 text-sm text-rose-600">{error instanceof Error ? error.message : 'User accounts could not be loaded.'}</p>}
        {isLoading && <p className="px-6 py-3 text-sm text-slate-500">Loading user records…</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Organisation</th>
                <th className="px-5 py-3">Verified</th>
                <th className="px-5 py-3">Registered</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium">{u.displayName || '—'}</td>
                  <td className="px-5 py-3 text-xs font-mono-tabular">{u.email}</td>
                  <td className="px-5 py-3 text-xs">
                    {canAssignRoles ? (
                      <select aria-label={`Role for ${u.displayName || u.email}`} value={u.role} disabled={u.role === DASHBOARD_ROLES.PLATFORM_ADMIN} onChange={(event) => {
                        const nextRole = event.target.value;
                        if (nextRole !== u.role && window.confirm(`Change this account to ${ROLE_DISPLAY_NAMES[nextRole as keyof typeof ROLE_DISPLAY_NAMES]}? Existing sessions will be revoked.`)) {
                          void setRole(u.id, nextRole);
                        }
                      }} className="max-w-48 bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
                        {roleOptions.map((role) => <option key={role} value={role}>{ROLE_DISPLAY_NAMES[role]}</option>)}
                        {u.role === DASHBOARD_ROLES.PLATFORM_ADMIN && <option value={u.role}>Platform Administrator</option>}
                      </select>
                    ) : ROLE_DISPLAY_NAMES[u.role as keyof typeof ROLE_DISPLAY_NAMES] || u.role}
                  </td>
                  <td className="px-5 py-3 text-xs">{u.region || '—'}</td>
                  <td className="px-5 py-3 text-xs">{u.organization || '—'}</td>
                  <td className="px-5 py-3 text-xs">{u.emailVerified ? 'Verified' : 'Unverified'}</td>
                  <td className="px-5 py-3 text-xs">{formatGovernanceDate(u.createdAt)}</td>
                  <td className="px-5 py-3 text-xs font-semibold">{u.status}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button type="button" onClick={() => setSelectedUserId(u.id)} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">Profile</button>
                    {u.status !== 'ACTIVE' && (
                      <button type="button" onClick={() => setStatus(u.id, 'ACTIVE')} className="text-xs font-semibold text-[#16865D]">
                        Activate
                      </button>
                    )}
                    {u.status === 'ACTIVE' && u.role !== 'PLATFORM_ADMIN' && (
                      <button type="button" onClick={() => setStatus(u.id, 'SUSPENDED')} className="text-xs font-semibold text-rose-600">
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && users.length === 0 && <tr><td className="px-5 py-4 text-sm text-slate-500" colSpan={9}>No users match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUserId !== null && (
        <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-editorial text-xl font-semibold">User Profile & Activity</h2>
            <button type="button" onClick={() => setSelectedUserId(null)} className="text-xs underline">Close</button>
          </div>
          {profileLoading && <p className="text-sm text-slate-500">Loading profile and activity…</p>}
          {profileError && <p role="alert" className="text-sm text-rose-600">Profile and activity could not be loaded.</p>}
          {selectedUser?.data && <>
            <div className="text-sm">
              <p className="font-semibold">{selectedUser.data.user.email} · {selectedUser.data.user.role} · {selectedUser.data.user.status}</p>
              <p className="mt-1 text-xs text-slate-500">Email {selectedUser.data.user.emailVerified ? 'verified' : 'unverified'} · MFA {selectedUser.data.user.mfaEnabled ? 'enabled' : 'not enabled'} · Last login {selectedUser.data.user.lastLoginAt ? formatGovernanceDate(selectedUser.data.user.lastLoginAt) : 'not recorded'}</p>
            </div>
            <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
              <input name="displayName" required minLength={2} maxLength={120} defaultValue={selectedUser.data.user.displayName || ''} aria-label="Display name" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              <input name="region" maxLength={120} defaultValue={selectedUser.data.user.region || ''} aria-label="Region" placeholder="Region" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              <input name="organization" maxLength={160} defaultValue={selectedUser.data.user.organization || ''} aria-label="Organization" placeholder="Organization" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              <textarea name="bio" maxLength={2000} defaultValue={selectedUser.data.user.bio || ''} aria-label="Profile biography" placeholder="Profile notes" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              <button type="submit" className="sm:col-span-2 justify-self-start px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold">Save profile changes</button>
            </form>
            <div className="grid gap-4 lg:grid-cols-3 text-xs">
              <div><h3 className="font-semibold">Cases ({selectedUser.data.cases.length})</h3>{selectedUser.data.cases.map((item) => <p key={item.id} className="mt-1">{item.referenceCode} · {item.title} · {item.status}</p>)}</div>
              <div><h3 className="font-semibold">Stories ({selectedUser.data.stories.length})</h3>{selectedUser.data.stories.map((item) => <p key={item.id} className="mt-1">{item.title} · {item.status}</p>)}</div>
              <div><h3 className="font-semibold">Campaigns ({selectedUser.data.campaigns.length})</h3>{selectedUser.data.campaigns.map((item) => <p key={item.id} className="mt-1">{item.title} · {item.status}</p>)}</div>
            </div>
            <div>
              <h3 className="text-xs font-semibold">Recent account activity</h3>
              <ul className="mt-2 max-h-48 overflow-auto space-y-1 text-xs text-slate-500">
                {selectedUser.data.activity.map((item) => <li key={item.id}>{formatGovernanceDate(item.createdAt)} · {item.action} · {item.resourceType}</li>)}
                {selectedUser.data.activity.length === 0 && <li>No account activity recorded.</li>}
              </ul>
            </div>
          </>}
        </section>
      )}
    </div>
  );
}

export function AdminFinancialsPanel() {
  const qc = useQueryClient();
  const [ledgerRefs, setLedgerRefs] = useState<Record<number, string>>({});
  const [reconciliationNotes, setReconciliationNotes] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-donations'],
    queryFn: () =>
      apiRequest<{
        donations: Array<{
          id: number;
          donationReference: string;
          campaignTitle: string | null;
          amount: number;
          currency: string;
          donorName: string;
          status: string;
          paymentChannel: string;
          createdAt: string;
        }>;
        distributions: Array<{
          id: number;
          caseReference: string;
          caseTitle: string;
          amountUsd: number;
          distributionNotes: string;
          distributedAt: string;
        }>;
      }>('/admin/donations'),
  });

  const donations = data?.data?.donations || [];
  const distributions = data?.data?.distributions || [];

  const exportCsv = () => {
    if (donations.length === 0) return;
    const quote = (value: unknown) => {
      const text = String(value ?? '');
      const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [
      ['Reference', 'Amount', 'Currency', 'Donor', 'Status', 'Channel', 'Created'],
      ...donations.map((row) => [
        row.donationReference, row.amount, row.currency, row.donorName, row.status, row.paymentChannel, row.createdAt,
      ]),
    ];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `humanitybridge-financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const reconcile = async (id: number) => {
    const externalLedgerRef = (ledgerRefs[id] || '').trim();
    const note = (reconciliationNotes[id] || '').trim();
    if (!externalLedgerRef || note.length < 8) {
      setActionError('Enter the actual external settlement reference and at least eight characters of reconciliation notes.');
      return;
    }
    setBusyId(id);
    setActionError(null);
    setMsg(null);
    try {
      const response = await apiRequest(`/admin/donations/${id}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ externalLedgerRef, reconciliationNote: note }),
      });
      setMsg(response.message);
      setLedgerRefs((current) => ({ ...current, [id]: '' }));
      setReconciliationNotes((current) => ({ ...current, [id]: '' }));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-donations'] }),
        qc.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
    } catch (reconciliationError) {
      setActionError(reconciliationError instanceof Error ? reconciliationError.message : 'The donation could not be reconciled.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Finance & accountability</p>
          <h2 className="mt-1 font-editorial text-2xl font-semibold">Donations & Financial Accountability</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            Review recorded donations and reconcile confirmed records against an independently verified external settlement statement. Online refunds and payment processing are disabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> {isFetching ? 'Refreshing…' : 'Refresh ledger'}
          </button>
          <button type="button" onClick={exportCsv} disabled={donations.length === 0 || isPending || isError} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700">
            <Download className="h-4 w-4" /> Export financial CSV
          </button>
        </div>
      </header>
      {msg && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{msg}</p>}
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{actionError}</p>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0D223D]" aria-labelledby="donation-ledger-heading">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 id="donation-ledger-heading" className="text-sm font-bold">Donation ledger</h3>
          <p className="mt-1 text-xs text-slate-500">Only confirmed records can be reconciled. Each reconciliation requires a real external reference and a review note.</p>
        </div>
        {isPending ? <p role="status" className="p-5 text-sm text-slate-500">Loading donation ledger…</p> : isError ? (
          <div role="alert" className="space-y-3 p-5 text-sm">
            <p className="text-rose-700 dark:text-rose-300">{error instanceof Error ? error.message : 'The donation ledger could not be loaded.'}</p>
            <button type="button" onClick={() => void refetch()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">Retry loading ledger</button>
          </div>
        ) : donations.length === 0 ? <p className="p-5 text-sm text-slate-500">No donation records are currently available.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950/50">
                <tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Donor</th><th className="px-5 py-3">Campaign</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Reconciliation</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {donations.map((donation) => (
                  <tr key={donation.id}>
                    <td className="px-5 py-3 font-mono-tabular text-xs font-semibold">{donation.donationReference}</td>
                    <td className="px-5 py-3 text-xs">{donation.donorName}</td>
                    <td className="px-5 py-3 text-xs">{donation.campaignTitle || 'General Fund'}</td>
                    <td className="px-5 py-3 text-right font-mono-tabular text-xs">{donation.amount.toLocaleString()} {donation.currency}</td>
                    <td className="px-5 py-3 text-xs font-semibold">{donation.status.replaceAll('_', ' ')}</td>
                    <td className="px-5 py-3">
                      {donation.status === 'CONFIRMED' ? (
                        <div className="flex min-w-64 flex-col gap-2">
                          <input value={ledgerRefs[donation.id] || ''} onChange={(event) => setLedgerRefs((current) => ({ ...current, [donation.id]: event.target.value }))} maxLength={120} aria-label={`External settlement reference for ${donation.donationReference}`} placeholder="External bank / ledger reference" className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950" />
                          <textarea value={reconciliationNotes[donation.id] || ''} onChange={(event) => setReconciliationNotes((current) => ({ ...current, [donation.id]: event.target.value }))} minLength={8} maxLength={1500} rows={2} aria-label={`Reconciliation note for ${donation.donationReference}`} placeholder="What was checked against the settlement statement?" className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
                          <button type="button" disabled={busyId !== null || !(ledgerRefs[donation.id] || '').trim() || (reconciliationNotes[donation.id] || '').trim().length < 8} onClick={() => void reconcile(donation.id)} className="inline-flex min-h-9 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-950">
                            {busyId === donation.id ? 'Saving reconciliation…' : 'Reconcile record'}
                          </button>
                        </div>
                      ) : <span className="text-xs text-slate-500">No action available for this status.</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0D223D]" aria-labelledby="distribution-ledger-heading">
        <h3 id="distribution-ledger-heading" className="font-editorial text-lg font-semibold">Approved fund distributions</h3>
        <p className="mt-1 text-xs text-slate-500">Recorded distributions linked to humanitarian cases.</p>
        {isPending ? <p role="status" className="mt-4 text-xs text-slate-500">Loading distribution records…</p> : isError ? <p role="alert" className="mt-4 text-xs text-rose-700 dark:text-rose-300">Distribution records could not be loaded.</p> : distributions.length === 0 ? <p className="mt-4 text-xs text-slate-500">No fund distributions have been recorded.</p> : (
          <ul className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {distributions.map((distribution) => (
              <li key={distribution.id} className="flex flex-wrap justify-between gap-3 py-3">
                <span className="min-w-0"><strong className="font-mono-tabular">{distribution.caseReference}</strong> · {distribution.distributionNotes}<span className="mt-1 block text-[11px] text-slate-500">{distribution.caseTitle} · {formatGovernanceDate(distribution.distributedAt)}</span></span>
                <span className="font-mono-tabular font-semibold">{distribution.amountUsd.toLocaleString()} USD</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AdminAuditPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-audit-readonly'],
    queryFn: () => apiRequest<Array<{
      id: number;
      action: string;
      resourceType: string;
      resourceId: string | null;
      actorRole: string | null;
      createdAt: string;
    }>>('/admin/audit-logs'),
  });
  return (
    <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-editorial text-lg font-semibold">Read-only audit trail</h2>
        <p className="mt-1 text-xs text-slate-500">Latest 100 administrative events. This view cannot change records.</p>
      </header>
      {isLoading && <p className="px-6 py-4 text-sm text-slate-500">Loading audit records…</p>}
      {isError && <p role="alert" className="px-6 py-4 text-sm text-rose-600">Audit records could not be loaded.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-[#748196]">
            <tr>
              <th className="px-5 py-3">Timestamp (UTC)</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Actor Role</th>
              <th className="px-5 py-3">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.data || []).map((record) => (
              <tr key={record.id}>
                <td className="px-5 py-3 font-mono-tabular">{record.createdAt.slice(0, 19)}</td>
                <td className="px-5 py-3 font-semibold">{record.action}</td>
                <td className="px-5 py-3">{record.actorRole || 'SYSTEM'}</td>
                <td className="px-5 py-3 font-mono-tabular">{record.resourceType}:{record.resourceId || '-'}</td>
              </tr>
            ))}
            {!isLoading && !isError && (data?.data || []).length === 0 && (
              <tr><td className="px-5 py-4 text-slate-500" colSpan={4}>No audit events have been recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminSafeguardingAndSettingsPanel({ mode }: { mode: 'safeguarding' | 'settings' }) {
  const qc = useQueryClient();
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<'ACTIVE' | 'ALL' | 'RESOLVED' | 'RESTRICTED'>('ACTIVE');
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({});
  const [safeguardingError, setSafeguardingError] = useState<string | null>(null);
  const [safeguardingMessage, setSafeguardingMessage] = useState<string | null>(null);

  const passwordStrength = (() => {
    let score = 0;
    if (newPassword.length >= 12) score++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const {
    data: safeData,
    isPending: safeguardingPending,
    isError: safeguardingIsError,
    error: safeguardingQueryError,
    refetch: refetchSafeguarding,
    isFetching: safeguardingFetching,
  } = useQuery({
    queryKey: ['admin-safeguarding'],
    queryFn: () =>
      apiRequest<{
        reports: Array<{
          id: number;
          subjectType: string;
          referenceCode: string | null;
          severity: string;
          description: string;
          status: string;
          resolutionNotes: string | null;
          createdAt: string;
        }>;
        privacyRequests: Array<{
          id: number;
          requestType: string;
          referenceCode: string | null;
          details: string;
          status: string;
          createdAt: string;
        }>;
        consents: Array<{
          id: number;
          subjectType: string;
          subjectId: number;
          consentScope: string;
          granted: boolean;
          withdrawnAt: string | null;
          recordedAt: string;
        }>;
      }>('/admin/safeguarding'),
    enabled: mode === 'safeguarding',
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status, resolutionNotes }: { id: number; status: string; resolutionNotes: string }) =>
      apiRequest(`/admin/safeguarding/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolutionNotes }),
      }),
    onMutate: () => {
      setSafeguardingError(null);
      setSafeguardingMessage(null);
    },
    onSuccess: async (response) => {
      setSafeguardingMessage(response.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-safeguarding'] }),
        qc.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setSafeguardingError(error instanceof Error ? error.message : 'Unable to update the safeguarding report.');
    },
  });

  const privacyRequestMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/admin/privacy-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onMutate: () => {
      setSafeguardingError(null);
      setSafeguardingMessage(null);
    },
    onSuccess: async (response) => {
      setSafeguardingMessage(response.message);
      await qc.invalidateQueries({ queryKey: ['admin-safeguarding'] });
    },
    onError: (error) => {
      setSafeguardingError(error instanceof Error ? error.message : 'Unable to update the privacy request.');
    },
  });

  const {
    data: settingsData,
    isPending: settingsPending,
    isError: settingsIsError,
    error: settingsQueryError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiRequest<{
        settings: Array<{ settingKey: string; settingValue: string }>;
        backups: Array<{ id: number; backupType: string; status: string; locationLabel: string; recordedAt: string }>;
      }>('/admin/settings'),
    enabled: mode === 'settings',
  });

  const {
    data: auditData,
    isPending: auditPending,
    isError: auditIsError,
    error: auditQueryError,
    refetch: refetchSettingsAudit,
  } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () =>
      apiRequest<Array<{ id: number; action: string; resourceType: string; resourceId: string | null; actorRole: string | null; createdAt: string }>>(
        '/admin/audit-logs',
      ),
    enabled: mode === 'settings',
  });

  const auditRows = (auditData?.data || []).filter((log) => {
    const query = auditSearch.trim().toLowerCase();
    return !query || [log.action, log.resourceType, log.resourceId || '', log.actorRole || '']
      .some((value) => value.toLowerCase().includes(query));
  });

  const exportAuditCsv = () => {
    const columns = ['id', 'timestamp_utc', 'action', 'actor_role', 'resource_type', 'resource_id'];
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = auditRows.map((log) => [
      log.id, log.createdAt, log.action, log.actorRole || 'SYSTEM', log.resourceType, log.resourceId || '',
    ]);
    const csv = [columns, ...rows].map((row) => row.map(quote).join(',')).join('\\r\\n');
    const blob = new Blob(['\\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `humanitybridge-audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMsg(null);
    try {
      const response = await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setMsg(response.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Password update failed');
    }
  };

  if (mode === 'safeguarding') {
    const reports = safeData?.data?.reports || [];
    const visibleReports = reports.filter((report) => {
      if (reportFilter === 'ALL') return true;
      if (reportFilter === 'ACTIVE') return report.status === 'OPEN' || report.status === 'IN_REVIEW';
      return report.status === reportFilter;
    });
    const activeReportCount = reports.filter((report) => report.status === 'OPEN' || report.status === 'IN_REVIEW').length;
    const privacyRequests = safeData?.data?.privacyRequests || [];
    const consentRecords = safeData?.data?.consents || [];

    return (
      <div className="hb-safeguarding-centre space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Restricted governance workspace</p>
            <h2 className="mt-1 font-editorial text-2xl font-semibold">Safeguarding & Privacy Centre</h2>
            <p className="mt-1 text-sm text-slate-500">Live reports, privacy requests, and recorded consent from the connected database.</p>
          </div>
          <button
            type="button"
            onClick={() => void refetchSafeguarding()}
            disabled={safeguardingFetching}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${safeguardingFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            {safeguardingFetching ? 'Refreshing' : 'Refresh records'}
          </button>
        </header>

        {safeguardingError && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{safeguardingError}</p>}
        {safeguardingMessage && <p role="status" className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">{safeguardingMessage}</p>}

        <section className="hb-governance-data-panel space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D223D] sm:p-6" aria-labelledby="safeguarding-reports-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="safeguarding-reports-heading" className="font-semibold">Restricted safeguarding reports</h3>
              <p className="mt-1 text-xs text-slate-500">{activeReportCount} open or in-review · {reports.length} total records</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <span>Show</span>
              <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value as typeof reportFilter)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="ACTIVE">Active queue</option>
                <option value="ALL">All reports</option>
                <option value="RESOLVED">Resolved</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </label>
          </div>

          {safeguardingPending ? (
            <div role="status" className="space-y-3">
              <p className="text-sm text-slate-500">Loading live safeguarding records…</p>
              <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : safeguardingIsError ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <p>{safeguardingQueryError instanceof Error ? safeguardingQueryError.message : 'Safeguarding records could not be loaded.'}</p>
              <button type="button" onClick={() => void refetchSafeguarding()} className="mt-2 font-semibold underline underline-offset-2">Try again</button>
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
              <ShieldAlert className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">{reports.length === 0 ? 'No safeguarding reports are recorded.' : 'No reports match this view.'}</p>
              <p className="mt-1 text-xs text-slate-500">{reports.length === 0 ? 'New submissions from the public safeguarding form will appear here.' : 'Choose another status filter to view the remaining records.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleReports.map((report) => (
                <li key={report.id} className="space-y-3 py-4 first:pt-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{report.subjectType.replaceAll('_', ' ')}</p>
                        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-semibold dark:border-slate-700">{report.severity}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-slate-800">{report.status.replaceAll('_', ' ')}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {report.referenceCode ? `Reference ${report.referenceCode} · ` : ''}Received {formatGovernanceDate(report.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{report.description}</p>
                  {report.resolutionNotes && <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800"><strong>Latest review note:</strong> {report.resolutionNotes}</p>}
                  <label className="block text-xs font-semibold">
                    Review note
                    <textarea
                      rows={2}
                      value={reportNotes[report.id] || ''}
                      onChange={(event) => setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                      placeholder="Add an internal note for the audit trail (optional)"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-900"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {report.status !== 'IN_REVIEW' && (
                      <button type="button" disabled={reportMutation.isPending} onClick={() => reportMutation.mutate({ id: report.id, status: 'IN_REVIEW', resolutionNotes: reportNotes[report.id] || '' })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">
                        {report.status === 'RESOLVED' || report.status === 'RESTRICTED' ? 'Reopen for review' : 'Start review'}
                      </button>
                    )}
                    {report.status !== 'RESOLVED' && (
                      <button type="button" disabled={reportMutation.isPending} onClick={() => reportMutation.mutate({ id: report.id, status: 'RESOLVED', resolutionNotes: reportNotes[report.id] || '' })} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">
                        Mark resolved
                      </button>
                    )}
                    {report.status !== 'RESTRICTED' && (
                      <button type="button" disabled={reportMutation.isPending} onClick={() => reportMutation.mutate({ id: report.id, status: 'RESTRICTED', resolutionNotes: reportNotes[report.id] || '' })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">
                        Restrict
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hb-governance-data-panel space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D223D] sm:p-6" aria-labelledby="privacy-requests-heading">
          <div>
            <h3 id="privacy-requests-heading" className="font-semibold">Privacy requests</h3>
            <p className="mt-1 text-xs text-slate-500">{privacyRequests.length} database records</p>
          </div>
          {privacyRequests.length === 0 ? (
            <p className="text-sm text-slate-500">No privacy requests are recorded.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {privacyRequests.map((request) => (
                <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{request.requestType.replaceAll('_', ' ')} · {request.status.replaceAll('_', ' ')}</p>
                    <p className="mt-1 text-xs text-slate-500">{request.referenceCode ? `Reference ${request.referenceCode} · ` : ''}{formatGovernanceDate(request.createdAt)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{request.details}</p>
                  </div>
                  <div className="flex gap-2">
                    {request.status !== 'IN_REVIEW' && request.status !== 'RESOLVED' && (
                      <button type="button" disabled={privacyRequestMutation.isPending} onClick={() => privacyRequestMutation.mutate({ id: request.id, status: 'IN_REVIEW' })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">Start review</button>
                    )}
                    {request.status !== 'RESOLVED' && (
                      <button type="button" disabled={privacyRequestMutation.isPending} onClick={() => privacyRequestMutation.mutate({ id: request.id, status: 'RESOLVED' })} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950">Mark resolved</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hb-governance-data-panel space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D223D] sm:p-6" aria-labelledby="consent-records-heading">
          <div>
            <h3 id="consent-records-heading" className="font-semibold">Consent records</h3>
            <p className="mt-1 text-xs text-slate-500">Latest {consentRecords.length} records from the database.</p>
          </div>
          {consentRecords.length === 0 ? (
            <p className="text-sm text-slate-500">No consent records are recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead><tr><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Decision</th><th className="px-3 py-2">Recorded</th></tr></thead>
                <tbody>
                  {consentRecords.map((consent) => (
                    <tr key={consent.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-2">{consent.subjectType} · {consent.subjectId}</td>
                      <td className="px-3 py-2">{consent.consentScope}</td>
                      <td className="px-3 py-2">{consent.withdrawnAt ? 'Withdrawn' : consent.granted ? 'Granted' : 'Not granted'}</td>
                      <td className="px-3 py-2">{formatGovernanceDate(consent.recordedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-editorial text-2xl font-semibold">System Settings, MFA & Audit Logs</h2>
      {msg && <p className="text-xs text-[#16865D]">{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2"><MfaSettingsPanel /></div>

        <form onSubmit={changePassword} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="font-editorial text-lg font-semibold">Owner Password</h3>
          <div className="grid gap-3">
            {[
              ['Current password', currentPassword, setCurrentPassword],
              ['New password (12+ characters)', newPassword, setNewPassword],
              ['Confirm new password', confirmPassword, setConfirmPassword],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="text-xs font-semibold">
                {String(label)}
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={String(value)}
                  onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setShowPasswords((visible) => !visible)} className="text-xs font-semibold text-slate-600 underline underline-offset-4 dark:text-slate-300">
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>
          {newPassword && (
            <div aria-live="polite">
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-slate-700 transition-all dark:bg-slate-300" style={{ width: `${passwordStrength * 25}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Password strength: {passwordStrength <= 1 ? 'Weak' : passwordStrength <= 3 ? 'Good' : 'Strong'}
              </p>
            </div>
          )}
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-950">
            Update Password
          </button>
        </form>

        <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3" aria-labelledby="public-identity-heading">
          <div>
            <h3 id="public-identity-heading" className="font-editorial text-lg font-semibold">Public identity configuration</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Current values from the system settings registry. This view is read-only; changes are not implied until an approved settings workflow is available.</p>
          </div>
          {settingsPending && <p role="status" className="text-xs text-slate-500">Loading platform settings…</p>}
          {settingsIsError && <div role="alert" className="space-y-2 text-xs text-rose-700 dark:text-rose-300"><p>{settingsQueryError instanceof Error ? settingsQueryError.message : 'Platform settings could not be loaded.'}</p><button type="button" onClick={() => void refetchSettings()} className="rounded-lg border border-current px-3 py-2 font-semibold">Retry settings</button></div>}
          {!settingsPending && !settingsIsError && (settingsData?.data?.settings || []).length === 0 && <p className="text-xs text-slate-500">No public identity settings have been configured.</p>}
          {!settingsIsError && <dl className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {(settingsData?.data?.settings || []).map((s) => (
              <div key={s.settingKey} className="flex flex-wrap justify-between gap-2 py-2">
                <dt className="font-mono-tabular text-[#748196]">{s.settingKey}</dt>
                <dd className="max-w-[70%] break-words text-right font-medium">{s.settingValue}</dd>
              </div>
            ))}
          </dl>}
        </section>

        <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3" aria-labelledby="backup-register-heading">
          <div>
            <h3 id="backup-register-heading" className="font-editorial text-lg font-semibold">Backup register</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Recorded backup events returned by the platform. This registry does not itself run or verify a backup job.</p>
          </div>
          {settingsPending && <p role="status" className="text-xs text-slate-500">Loading backup records…</p>}
          {settingsIsError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">Backup records could not be loaded.</p>}
          {!settingsPending && !settingsIsError && (settingsData?.data?.backups || []).length === 0 && <p className="text-xs text-slate-500">No backup events have been recorded.</p>}
          {!settingsIsError && <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {(settingsData?.data?.backups || []).map((backup) => (
              <li key={backup.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <span className="min-w-0"><strong className="block">{backup.backupType.replaceAll('_', ' ')}</strong><span className="mt-1 block break-all text-slate-500">{backup.locationLabel}</span><time className="mt-1 block text-[11px] text-slate-500" dateTime={backup.recordedAt}>{formatGovernanceDate(backup.recordedAt)}</time></span>
                <span className="rounded-full border border-slate-300 px-2 py-1 text-[10px] font-semibold dark:border-slate-700">{backup.status.replaceAll('_', ' ')}</span>
              </li>
            ))}
          </ul>}
        </section>
      </div>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="font-editorial text-lg font-semibold">Immutable Security & Governance Audit Trail</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Latest 100 records. Export contains audit metadata only, not private record contents.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="Filter audit events..."
              aria-label="Filter audit events"
              className="min-h-9 rounded-lg border border-slate-200 bg-white/70 px-3 text-xs dark:border-slate-700 dark:bg-slate-950/50"
            />
            <button type="button" onClick={exportAuditCsv} disabled={auditRows.length === 0} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-40 dark:border-slate-700">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>
        {auditPending && <p role="status" className="px-6 py-4 text-sm text-slate-500">Loading security audit records…</p>}
        {auditIsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm text-rose-700 dark:text-rose-300"><span>{auditQueryError instanceof Error ? auditQueryError.message : 'Security audit records could not be loaded.'}</span><button type="button" onClick={() => void refetchSettingsAudit()} className="rounded-lg border border-current px-3 py-2 text-xs font-semibold">Retry audit logs</button></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-[#748196]">
              <tr>
                <th className="px-5 py-2.5">Timestamp (UTC)</th>
                <th className="px-5 py-2.5">Action</th>
                <th className="px-5 py-2.5">Actor Role</th>
                <th className="px-5 py-2.5">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditRows.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-2.5 font-mono-tabular">{log.createdAt.slice(0, 19)}</td>
                  <td className="px-5 py-2.5 font-semibold">{log.action}</td>
                  <td className="px-5 py-2.5">{log.actorRole || 'SYSTEM'}</td>
                  <td className="px-5 py-2.5 font-mono-tabular">{log.resourceType}:{log.resourceId || '-'}</td>
                </tr>
              ))}
              {!auditPending && !auditIsError && auditRows.length === 0 && <tr><td colSpan={4} className="px-5 py-5 text-center text-slate-500">No audit events match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
