import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Landmark, ReceiptText, ShieldCheck, XCircle } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { openBankTransferReceipt, type BankTransferReceipt } from '../../utils/bankTransferReceipt';

interface TransferRow {
  id: number; caseReference: string; caseTitle: string; beneficiaryName: string;
  bankName: string; bankReference: string; amount: number | string; currency: string;
  transferDate: string; recipientAccountLast4: string | null; purpose: string; notes: string;
  status: string; verificationNotes: string | null; receiptNumber: string | null;
  evidenceMediaId: number; recordedByName: string | null;
}

export function AdminBankTransfersPanel() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-bank-transfers'],
    queryFn: () => apiRequest<TransferRow[]>('/admin/bank-transfers'),
  });

  const viewEvidence = async (mediaId: number) => {
    const popup = window.open('', '_blank');
    if (!popup) { setError('Please allow pop-ups to open the private evidence file.'); return; }
    try {
      const result = await apiRequest<{ signedUrl: string }>(`/media/private/${mediaId}/signed-url`);
      popup.location.href = new URL(result.data.signedUrl, window.location.origin).toString();
    } catch (viewError) {
      popup.close(); setError(viewError instanceof Error ? viewError.message : 'Unable to open evidence file.');
    }
  };

  const review = async (item: TransferRow, decision: 'VERIFIED' | 'REJECTED') => {
    const verificationNotes = (notes[item.id] || '').trim();
    if (verificationNotes.length < 8) { setError('Enter at least eight characters of verification notes before submitting a decision.'); return; }
    setBusyId(item.id); setError(null); setMessage(null);
    try {
      const result = await apiRequest(`/admin/bank-transfers/${item.id}/review`, {
        method: 'PATCH', body: JSON.stringify({ decision, verificationNotes }),
      });
      setMessage(result.message);
      qc.invalidateQueries({ queryKey: ['admin-bank-transfers'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin-donations'] });
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Review could not be saved.');
    } finally { setBusyId(null); }
  };

  const viewReceipt = (id: number) => openBankTransferReceipt(async () => {
    const result = await apiRequest<BankTransferReceipt>(`/admin/bank-transfers/${id}/receipt`);
    return result.data;
  }).catch((receiptError) => setError(receiptError instanceof Error ? receiptError.message : 'Receipt is unavailable.'));

  const records = data?.data || [];
  const pending = records.filter((item) => item.status === 'PENDING_REVIEW');
  const verified = records.filter((item) => item.status === 'VERIFIED');
  const rejected = records.filter((item) => item.status === 'REJECTED');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Bank transfers & organisational receipts</h1>
        <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-600 dark:text-slate-400">Compare bank evidence with the statement before issuing a receipt. Payments are not processed here.</p>
      </header>
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Awaiting review', pending.length], ['Verified & receipted', verified.length], ['Rejected', rejected.length]].map(([label, value]) => <div key={String(label)} className="hb-panel p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</p></div>)}
      </div>
      <section className="hb-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300"><Landmark className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900 dark:text-white">Transfer review queue</h2><p className="mt-1 text-[11px] text-slate-500">A reviewer cannot approve their own submission.</p></div></div><button type="button" onClick={() => refetch()} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Refresh queue</button></div>
        {isLoading ? <p className="p-5 text-xs text-slate-500">Loading transfer records…</p> : records.length === 0 ? <p className="p-5 text-xs text-slate-500">No external bank transfer records have been submitted.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {records.map((item) => <article key={item.id} className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0"><p className="font-mono text-[11px] font-bold text-cyan-800 dark:text-cyan-300">{item.caseReference} · {item.bankReference}</p><h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{item.beneficiaryName}</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.caseTitle} · {item.bankName} · {item.amount} {item.currency} · {item.transferDate}</p><p className="mt-1 text-xs text-slate-500">Purpose: {item.purpose} · Submitted by: {item.recordedByName || 'Coordinator'}</p>{item.recipientAccountLast4 && <p className="mt-1 text-[11px] text-slate-500">Recipient account ending {item.recipientAccountLast4}</p>}</div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${item.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : item.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{item.status.replace('_', ' ')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => viewEvidence(item.evidenceMediaId)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><ExternalLink className="h-3.5 w-3.5" />Open private bank evidence</button>{item.status === 'VERIFIED' && <button type="button" onClick={() => viewReceipt(item.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white"><ReceiptText className="h-3.5 w-3.5" />View / print receipt</button>}</div>
            {item.status === 'PENDING_REVIEW' && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50"><label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">Independent verification notes *</label><textarea rows={2} minLength={8} maxLength={1500} value={notes[item.id] || ''} onChange={(e) => setNotes((previous) => ({ ...previous, [item.id]: e.target.value }))} placeholder="Confirm what was checked against the bank statement, or explain why the evidence is insufficient." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busyId === item.id || (notes[item.id] || '').trim().length < 8} onClick={() => review(item, 'VERIFIED')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />Verify & issue receipt</button><button type="button" disabled={busyId === item.id || (notes[item.id] || '').trim().length < 8} onClick={() => review(item, 'REJECTED')} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><XCircle className="h-3.5 w-3.5" />Reject evidence</button></div></div>}
            {item.status === 'REJECTED' && item.verificationNotes && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">Review notes: {item.verificationNotes}</p>}
            {item.status === 'VERIFIED' && <p className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" />Receipt issued: <span className="font-mono font-bold">{item.receiptNumber}</span></p>}
          </article>)}
        </div>}
      </section>
    </div>
  );
}
