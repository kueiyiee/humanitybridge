import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/api';

export function AdminCasesPanel() {
  const qc = useQueryClient();
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-cases'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          referenceCode: string;
          title: string;
          status: string;
          isPublic: boolean;
          urgencyLevel: string;
          affectedCount: number;
          privateContactName: string;
          privateContactPhone: string;
          privateLocationNotes: string;
          coordinatorName: string | null;
          categoryName: string;
          regionName: string;
        }>
      >('/admin/cases'),
  });

  const decideCase = async (id: number, decision: string, publishPublicly: boolean) => {
    const notes = notesById[id] || `Reviewed and marked ${decision} by Platform Administration.`;
    const res = await apiRequest(`/admin/cases/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, notes, publishPublicly }),
    });
    setFeedback(res.message);
    qc.invalidateQueries({ queryKey: ['admin-cases'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-editorial text-2xl font-semibold">Humanitarian Case Verification</h2>
        {feedback && <p className="text-xs font-medium text-[#16865D]">{feedback}</p>}
      </div>

      <div className="space-y-4">
        {(data?.data || []).map((c) => (
          <div key={c.id} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">
                  {c.referenceCode} · {c.categoryName} · {c.regionName} · {c.urgencyLevel}
                </p>
                <h3 className="mt-1 font-editorial text-xl font-semibold">{c.title}</h3>
                <p className="text-xs text-[#748196] mt-1">
                  Coordinator: {c.coordinatorName || 'Field Desk'} · Affected: {c.affectedCount} · Public: {c.isPublic ? 'Yes' : 'No'}
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-semibold px-3 py-1 rounded bg-slate-100 dark:bg-slate-800">
                {c.status}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Confidential Verification Vault (Admin Only):</p>
              <p>Contact: {c.privateContactName} ({c.privateContactPhone})</p>
              <p>Notes: {c.privateLocationNotes}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter verification notes or information request..."
                value={notesById[c.id] || ''}
                onChange={(e) => setNotesById((p) => ({ ...p, [c.id]: e.target.value }))}
                className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => decideCase(c.id, 'VERIFIED', true)}
                  className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold"
                >
                  Verify & Publish
                </button>
                <button
                  type="button"
                  onClick={() => decideCase(c.id, 'INFO_REQUESTED', false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Request Info
                </button>
                <button
                  type="button"
                  onClick={() => decideCase(c.id, 'REJECTED', false)}
                  className="px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 dark:text-rose-400 text-xs font-semibold"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminStoriesPanel() {
  const qc = useQueryClient();
  const [translationPreview, setTranslationPreview] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['admin-stories'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          title: string;
          regionName: string;
          status: string;
          anonymousPublication: boolean;
          isMinorSubject: boolean;
          consentStory: boolean;
          consentMedia: boolean;
          guardianConsentRecorded: boolean;
        }>
      >('/admin/stories'),
  });

  const moderateStory = async (id: number, decision: string) => {
    await apiRequest(`/admin/stories/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, editorialNotes: `Editorial decision: ${decision}` }),
    });
    qc.invalidateQueries({ queryKey: ['admin-stories'] });
  };

  const requestTranslationDraft = async (id: number, targetLocale: string) => {
    const res = await apiRequest<{ translatedTitle: string; translatedExcerpt: string; providerStatus: string }>(
      `/admin/stories/${id}/translate-draft`,
      { method: 'POST', body: JSON.stringify({ targetLocale }) },
    );
    setTranslationPreview(
      `Draft (${targetLocale.toUpperCase()} · Human review required): ${res.data.translatedTitle} — ${res.data.translatedExcerpt}`,
    );
  };

  return (
    <div className="space-y-5">
      <h2 className="font-editorial text-2xl font-semibold">Story Moderation & Consent Verification</h2>
      {translationPreview && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#0D223D] border border-[#00BCEB] text-xs">{translationPreview}</div>
      )}
      <div className="space-y-4">
        {(data?.data || []).map((s) => (
          <div key={s.id} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#748196]">{s.regionName} · Status: <span className="font-semibold text-[#0B1F3A] dark:text-white">{s.status}</span></p>
              <h3 className="mt-1 font-editorial text-xl font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                Narrative Consent: {s.consentStory ? 'Recorded' : 'Missing'} · Media Consent: {s.consentMedia ? 'Yes' : 'No'} ·
                {s.isMinorSubject ? ` Minor Safeguard (Guardian Consent: ${s.guardianConsentRecorded ? 'Yes' : 'MISSING'})` : ' Adult Subject'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button type="button" onClick={() => moderateStory(s.id, 'PUBLISHED')} className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold">
                Publish Story
              </button>
              <button type="button" onClick={() => requestTranslationDraft(s.id, 'ar')} className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                Draft Arabic Translation
              </button>
              <button type="button" onClick={() => moderateStory(s.id, 'REJECTED')} className="px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCampaignsPanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState(15000);
  const [msg, setMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () =>
      apiRequest<Array<{ id: number; title: string; targetAmount: number; raisedAmount: number; status: string }>>(
        '/admin/campaigns',
      ),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 60 * 86400000).toISOString();
    const res = await apiRequest('/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title,
        summary,
        description,
        targetAmount: Number(targetAmount),
        startDate: now,
        endDate: end,
        status: 'ACTIVE',
      }),
    });
    setMsg(res.message);
    setTitle('');
    setSummary('');
    setDescription('');
    qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
  };

  const toggleStatus = async (id: number, status: string) => {
    await apiRequest(`/admin/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Launch Humanitarian Campaign</h2>
        {msg && <p className="text-xs text-[#16865D]">{msg}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign Title" className="sm:col-span-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} placeholder="Target USD" className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
        </div>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short campaign summary (min 20 chars)" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Full operational description (min 50 chars)" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
          Publish Campaign
        </button>
      </form>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
            <tr>
              <th className="px-5 py-3">Campaign</th>
              <th className="px-5 py-3 text-right">Confirmed Raised</th>
              <th className="px-5 py-3 text-right">Target</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.data || []).map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3 font-medium">{c.title}</td>
                <td className="px-5 py-3 text-right font-mono-tabular">${c.raisedAmount.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono-tabular">${c.targetAmount.toLocaleString()}</td>
                <td className="px-5 py-3 text-xs font-semibold">{c.status}</td>
                <td className="px-5 py-3 text-right space-x-2">
                  <button type="button" onClick={() => toggleStatus(c.id, c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">
                    {c.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                  </button>
                  <button type="button" onClick={() => toggleStatus(c.id, 'COMPLETED')} className="text-xs font-semibold text-[#16865D]">
                    Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminOutreachAndNewsPanel() {
  const qc = useQueryClient();
  const [articleTitle, setArticleTitle] = useState('');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleBody, setArticleBody] = useState('');

  const { data: volData } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () =>
      apiRequest<{
        applications: Array<{ id: number; fullName: string; region: string; skills: string; status: string }>;
      }>('/admin/volunteers'),
  });

  const { data: partData } = useQuery({
    queryKey: ['admin-partnerships'],
    queryFn: () =>
      apiRequest<{
        enquiries: Array<{ id: number; organizationName: string; organizationType: string; region: string; status: string }>;
      }>('/admin/partnerships'),
  });

  const { data: assistData } = useQuery({
    queryKey: ['admin-assistance'],
    queryFn: () =>
      apiRequest<Array<{ id: number; caseReference: string; coordinatorName: string; supportType: string; requestedAmountUsd: number; status: string }>>(
        '/admin/assistance-requests',
      ),
  });

  const publishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/admin/articles', {
      method: 'POST',
      body: JSON.stringify({ title: articleTitle, summary: articleSummary, body: articleBody, categoryId: 1 }),
    });
    setArticleTitle('');
    setArticleSummary('');
    setArticleBody('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Pending Coordinator Assistance Requests</h2>
        {(assistData?.data || []).length === 0 ? (
          <p className="text-xs text-[#748196]">No assistance requests submitted.</p>
        ) : (
          <div className="space-y-2">
            {(assistData?.data || []).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-mono-tabular font-semibold">{a.caseReference}</span> · {a.supportType} (${a.requestedAmountUsd.toLocaleString()}) · {a.status}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/admin/assistance-requests/${a.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'APPROVED', adminFeedback: 'Approved for procurement disbursement' }),
                      });
                      qc.invalidateQueries({ queryKey: ['admin-assistance'] });
                    }}
                    className="px-3 py-1 rounded bg-[#16865D] text-white font-semibold"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/admin/assistance-requests/${a.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'REJECTED', adminFeedback: 'Requires updated invoice estimate' }),
                      });
                      qc.invalidateQueries({ queryKey: ['admin-assistance'] });
                    }}
                    className="px-3 py-1 rounded border border-rose-300 text-rose-600 font-semibold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="font-editorial text-lg font-semibold mb-3">Volunteer Applications</h3>
          {(volData?.data?.applications || []).length === 0 ? (
            <p className="text-xs text-[#748196]">No applications in queue.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(volData?.data?.applications || []).map((v) => (
                <li key={v.id} className="py-2.5 flex justify-between items-center gap-2">
                  <span>{v.fullName} · {v.region} ({v.status})</span>
                  {v.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/admin/volunteers/${v.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
                        qc.invalidateQueries({ queryKey: ['admin-volunteers'] });
                      }}
                      className="px-2.5 py-1 rounded bg-[#0B1F3A] text-white font-semibold"
                    >
                      Approve
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="font-editorial text-lg font-semibold mb-3">Partnership Enquiries</h3>
          {(partData?.data?.enquiries || []).length === 0 ? (
            <p className="text-xs text-[#748196]">No partnership enquiries in queue.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(partData?.data?.enquiries || []).map((p) => (
                <li key={p.id} className="py-2.5 flex justify-between items-center gap-2">
                  <span>{p.organizationName} ({p.organizationType}) · {p.status}</span>
                  {p.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/admin/partnerships/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) });
                        qc.invalidateQueries({ queryKey: ['admin-partnerships'] });
                      }}
                      className="px-2.5 py-1 rounded bg-[#0B1F3A] text-white font-semibold"
                    >
                      Approve
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form onSubmit={publishArticle} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="font-editorial text-lg font-semibold">Publish News / Transparency Brief</h3>
        <input value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} placeholder="Article headline" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <input value={articleSummary} onChange={(e) => setArticleSummary(e.target.value)} placeholder="Brief summary" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <textarea rows={3} value={articleBody} onChange={(e) => setArticleBody(e.target.value)} placeholder="Full publication copy" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <button type="submit" className="px-5 py-2 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-xs font-semibold">
          Publish Article
        </button>
      </form>
    </div>
  );
}
