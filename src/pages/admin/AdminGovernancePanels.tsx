import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { MfaSettingsPanel } from '../../components/security/MfaSettingsPanel';
import { apiRequest } from '../../services/api';

export function AdminUsersPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          email: string;
          role: string;
          status: string;
          mfaEnabled: boolean;
          displayName: string | null;
          region: string | null;
          organization: string | null;
        }>
      >('/admin/users'),
  });

  const createCoordinator = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/users/coordinators', {
      method: 'POST',
      body: JSON.stringify({ email: newEmail, displayName: newName, region: newRegion, organization: newOrganization, password: newPassword }),
    });
    setMsg(res.message);
    setNewEmail('');
    setNewName('');
    setNewRegion('');
    setNewOrganization('');
    setNewPassword('');
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const setStatus = async (id: number, status: string) => {
    await apiRequest(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const users = (data?.data || []).filter(
    (u) =>
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.displayName || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <form onSubmit={createCoordinator} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Provision Community Coordinator Account</h2>
        {msg && <p className="text-xs text-[#16865D]">{msg}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder="Region" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input value={newOrganization} onChange={(e) => setNewOrganization(e.target.value)} placeholder="Organisation" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Initial Password (10+)" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        </div>
        <button type="submit" className="px-5 py-2 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-xs font-semibold">
          Create Coordinator Account
        </button>
      </form>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between gap-3">
          <h2 className="font-editorial text-lg font-semibold">Registered Users & Coordinators</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter accounts..."
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#071324] text-xs"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Organisation</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium">{u.displayName || '—'}</td>
                  <td className="px-5 py-3 text-xs font-mono-tabular">{u.email}</td>
                  <td className="px-5 py-3 text-xs">{u.role}</td>
                  <td className="px-5 py-3 text-xs">{u.region || '—'}</td>
                  <td className="px-5 py-3 text-xs">{u.organization || '—'}</td>
                  <td className="px-5 py-3 text-xs font-semibold">{u.status}</td>
                  <td className="px-5 py-3 text-right space-x-2">
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminFinancialsPanel() {
  const qc = useQueryClient();
  const [ledgerRef, setLedgerRef] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data } = useQuery({
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

  const exportCsv = () => {
    const rows = data?.data?.donations || [];
    const header = 'Reference,Amount,Currency,Donor,Status,Channel,Created\n';
    const body = rows
      .map((r) => `${r.donationReference},${r.amount},${r.currency},"${r.donorName}",${r.status},${r.paymentChannel},${r.createdAt}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanitybridge-financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reconcile = async (id: number) => {
    const ref = ledgerRef.trim() || `BANK-REC-${Date.now()}`;
    const res = await apiRequest(`/admin/donations/${id}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ externalLedgerRef: ref, reconciliationNote: 'Verified against settlement statement' }),
    });
    setMsg(res.message);
    qc.invalidateQueries({ queryKey: ['admin-donations'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-2xl font-semibold">Donations & Financial Accountability</h2>
          {msg && <p className="text-xs text-[#16865D] mt-1">{msg}</p>}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
        >
          <Download className="w-4 h-4" />
          <span>Export Financial CSV</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <input
            value={ledgerRef}
            onChange={(e) => setLedgerRef(e.target.value)}
            placeholder="External bank/ledger settlement ref for reconciliation..."
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#071324] text-xs w-80"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
              <tr>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Donor</th>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.data?.donations || []).map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-3 font-mono-tabular text-xs font-semibold">{d.donationReference}</td>
                  <td className="px-5 py-3 text-xs">{d.donorName}</td>
                  <td className="px-5 py-3 text-xs">{d.campaignTitle || 'General Fund'}</td>
                  <td className="px-5 py-3 text-right font-mono-tabular">${d.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-xs font-semibold">{d.status}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {d.status === 'CONFIRMED' && (
                      <>
                        <button type="button" onClick={() => reconcile(d.id)} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">
                          Reconcile
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/admin/donations/${d.id}/refund`, {
                              method: 'POST',
                              body: JSON.stringify({ reason: 'Administrative refund issued upon request' }),
                            });
                            qc.invalidateQueries({ queryKey: ['admin-donations'] });
                          }}
                          className="text-xs font-semibold text-rose-600"
                        >
                          Refund
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h3 className="font-editorial text-lg font-semibold mb-3">Approved Fund Distributions</h3>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {(data?.data?.distributions || []).map((dist) => (
            <li key={dist.id} className="py-2.5 flex justify-between gap-4">
              <span><strong className="font-mono-tabular">{dist.caseReference}</strong> · {dist.distributionNotes}</span>
              <span className="font-mono-tabular font-semibold text-[#16865D]">${dist.amountUsd.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
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

  const passwordStrength = (() => {
    let score = 0;
    if (newPassword.length >= 12) score++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const { data: safeData } = useQuery({
    queryKey: ['admin-safeguarding'],
    queryFn: () =>
      apiRequest<{
        reports: Array<{ id: number; subjectType: string; severity: string; description: string; status: string }>;
        consents: Array<{ id: number; subjectType: string; consentScope: string; granted: boolean; recordedAt: string }>;
      }>('/admin/safeguarding'),
    enabled: mode === 'safeguarding',
  });

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiRequest<{
        settings: Array<{ settingKey: string; settingValue: string }>;
        backups: Array<{ id: number; backupType: string; status: string; locationLabel: string; recordedAt: string }>;
      }>('/admin/settings'),
    enabled: mode === 'settings',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () =>
      apiRequest<Array<{ id: number; action: string; resourceType: string; resourceId: string | null; actorRole: string | null; createdAt: string }>>(
        '/admin/audit-logs',
      ),
    enabled: mode === 'settings',
  });

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
    return (
      <div className="space-y-6">
        <h2 className="font-editorial text-2xl font-semibold">Safeguarding & Privacy Centre</h2>
        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-sm">Restricted Safeguarding Reports</h3>
          {(safeData?.data?.reports || []).length === 0 ? (
            <p className="text-xs text-[#748196]">No open safeguarding incidents.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(safeData?.data?.reports || []).map((r) => (
                <li key={r.id} className="py-3 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <p className="font-semibold">{r.subjectType} · {r.severity} ({r.status})</p>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{r.description}</p>
                  </div>
                  {r.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/admin/safeguarding/${r.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'RESOLVED', resolutionNotes: 'Reviewed and closed by Safeguarding Officer' }),
                        });
                        qc.invalidateQueries({ queryKey: ['admin-safeguarding'] });
                      }}
                      className="px-3 py-1.5 rounded bg-[#0B1F3A] text-white font-semibold"
                    >
                      Mark Resolved
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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

        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
          <h3 className="font-editorial text-lg font-semibold">Configurable Public Identity</h3>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {(settingsData?.data?.settings || []).map((s) => (
              <div key={s.settingKey} className="py-2 flex justify-between gap-4">
                <dt className="font-mono-tabular text-[#748196]">{s.settingKey}</dt>
                <dd className="text-right font-medium">{s.settingValue}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-editorial text-lg font-semibold">Immutable Security & Governance Audit Trail</h3>
        </div>
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
              {(auditData?.data || []).slice(0, 20).map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-2.5 font-mono-tabular">{log.createdAt.slice(0, 19)}</td>
                  <td className="px-5 py-2.5 font-semibold">{log.action}</td>
                  <td className="px-5 py-2.5">{log.actorRole || 'SYSTEM'}</td>
                  <td className="px-5 py-2.5 font-mono-tabular">{log.resourceType}:{log.resourceId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
