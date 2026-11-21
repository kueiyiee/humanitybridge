import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileImage, Landmark, ReceiptText, Upload } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { openBankTransferReceipt, type BankTransferReceipt } from '../../utils/bankTransferReceipt';

interface CaseOption { id: number; referenceCode: string; title: string; status: string }
interface TransferRow {
  id: number; caseReference: string; caseTitle: string; beneficiaryName: string;
  bankName: string; bankReference: string; amount: number | string; currency: string;
  transferDate: string; purpose: string; status: string; verificationNotes: string | null;
  receiptNumber: string | null; evidenceMediaId: number;
}
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

export function CoordinatorBankTransfersPanel() {
  const qc = useQueryClient();
  const [caseId, setCaseId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [recipientAccountLast4, setRecipientAccountLast4] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceMediaId, setEvidenceMediaId] = useState<number | null>(null);
  const [evidenceName, setEvidenceName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const casesQuery = useQuery({ queryKey: ['coordinator-transfer-cases'], queryFn: () => apiRequest<CaseOption[]>('/coordinator/cases') });
  const transfersQuery = useQuery({ queryKey: ['coordinator-bank-transfers'], queryFn: () => apiRequest<TransferRow[]>('/coordinator/bank-transfers') });
  const verifiedCases = (casesQuery.data?.data || []).filter((item) => item.status === 'VERIFIED');

  const uploadEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setError('Upload a JPG, PNG, WebP or PDF file up to 5 MB.'); event.target.value = ''; return;
    }
    const body = new FormData(); body.append('file', file); body.append('scope', 'PRIVATE_CASE_EVIDENCE');
    setBusy(true);
    try {
      const result = await apiRequest<{ id: number; safeFilename: string }>('/media/upload', { method: 'POST', body });
      setEvidenceMediaId(result.data.id); setEvidenceName(file.name);
      setMessage('Transfer evidence uploaded to the private document vault.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Evidence upload failed.');
    } finally { setBusy(false); }
  };

  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    if (!evidenceMediaId) { setError('Upload the bank transfer screenshot or PDF before submitting.'); return; }
    setBusy(true);
    try {
      const result = await apiRequest('/coordinator/bank-transfers', {
        method: 'POST',
        body: JSON.stringify({
          caseId: Number(caseId), bankName, bankReference, amount: Number(amount), currency,
          transferDate, recipientAccountLast4: recipientAccountLast4 || undefined,
          purpose, notes, evidenceMediaId,
        }),
      });
      setMessage(result.message);
      setCaseId(''); setBankName(''); setBankReference(''); setAmount(''); setCurrency('USD');
      setTransferDate(new Date().toISOString().slice(0, 10)); setRecipientAccountLast4('');
      setPurpose(''); setNotes(''); setEvidenceMediaId(null); setEvidenceName('');
      qc.invalidateQueries({ queryKey: ['coordinator-bank-transfers'] });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Transfer record could not be submitted.');
    } finally { setBusy(false); }
  };

  const viewEvidence = async (mediaId: number) => {
    const popup = window.open('', '_blank');
    if (!popup) { setError('Please allow pop-ups to view private evidence.'); return; }
    try {
      const result = await apiRequest<{ signedUrl: string }>(`/media/private/${mediaId}/signed-url`);
      popup.location.href = new URL(result.data.signedUrl, window.location.origin).toString();
    } catch (viewError) {
      popup.close(); setError(viewError instanceof Error ? viewError.message : 'Unable to open private evidence.');
    }
  };

  const viewReceipt = (id: number) => openBankTransferReceipt(async () => {
    const result = await apiRequest<BankTransferReceipt>(`/coordinator/bank-transfers/${id}/receipt`);
    return result.data;
  }).catch((receiptError) => setError(receiptError instanceof Error ? receiptError.message : 'Receipt is unavailable.'));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Offline disbursement control</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">External bank transfer evidence</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">Record a transfer only after it has been made through the organisation's bank. Attach the bank-issued confirmation. Platform Administration independently reviews the record before an organisational receipt is issued. HumanityBridge does not collect bank credentials or process online payments.</p>
      </header>
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      <section className="hb-panel p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300"><Landmark className="h-5 w-5" /></span>
          <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Submit transfer record</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">All fields are required unless marked optional.</p></div>
        </div>
        <form onSubmit={submitTransfer} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><label className="mb-1.5 block text-xs font-semibold">Verified beneficiary case *</label><select required value={caseId} onChange={(e) => setCaseId(e.target.value)} className={fieldClass}><option value="">Select a verified case</option>{verifiedCases.map((item) => <option key={item.id} value={item.id}>{item.referenceCode} — {item.title}</option>)}</select>{verifiedCases.length === 0 && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Only cases verified by Platform Administration can receive a transfer record.</p>}</div>
          <div><label className="mb-1.5 block text-xs font-semibold">Bank name *</label><input required maxLength={120} value={bankName} onChange={(e) => setBankName(e.target.value)} className={fieldClass} placeholder="Bank or financial institution" /></div>
          <div><label className="mb-1.5 block text-xs font-semibold">Bank transaction reference *</label><input required minLength={4} maxLength={120} value={bankReference} onChange={(e) => setBankReference(e.target.value)} className={fieldClass} placeholder="Reference shown by the bank" /></div>
          <div><label className="mb-1.5 block text-xs font-semibold">Amount transferred *</label><input required type="number" min="0.01" max="1000000000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldClass} placeholder="0.00" /></div>
          <div><label className="mb-1.5 block text-xs font-semibold">Currency *</label><select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass}><option value="USD">USD — US Dollar</option><option value="SSP">SSP — South Sudanese Pound</option><option value="ETB">ETB — Ethiopian Birr</option><option value="KES">KES — Kenyan Shilling</option><option value="UGX">UGX — Ugandan Shilling</option></select></div>
          <div><label className="mb-1.5 block text-xs font-semibold">Transfer date *</label><input required type="date" max={new Date().toISOString().slice(0, 10)} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={fieldClass} /></div>
          <div><label className="mb-1.5 block text-xs font-semibold">Recipient account last four digits (optional)</label><input inputMode="numeric" maxLength={4} value={recipientAccountLast4} onChange={(e) => setRecipientAccountLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} className={fieldClass} placeholder="••••" /></div>
          <div className="md:col-span-2"><label className="mb-1.5 block text-xs font-semibold">Transfer purpose *</label><input required maxLength={180} value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldClass} placeholder="e.g. Approved household food assistance" /></div>
          <div className="md:col-span-2"><label className="mb-1.5 block text-xs font-semibold">Transfer notes *</label><textarea required minLength={8} maxLength={1500} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} placeholder="Add the minimum context needed for the independent reviewer." /></div>
          <div className="md:col-span-2 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
            <label className="flex cursor-pointer items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Upload className="h-5 w-5" /></span><span><span className="block text-xs font-bold">Bank-issued transfer confirmation *</span><span className="mt-1 block text-[11px] text-slate-500">Screenshot or PDF · JPG, PNG, WebP or PDF · maximum 5 MB</span></span><input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,application/pdf,image/jpeg,image/png,image/webp" onChange={uploadEvidence} /></label>
            {evidenceMediaId && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{evidenceName} uploaded to private vault</p>}
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="max-w-xl text-[11px] leading-5 text-slate-500">Do not upload card details, passwords, PINs or complete account numbers. Only provide the official transfer proof needed for review.</p>
            <button type="submit" disabled={busy || !verifiedCases.length} className="rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950">{busy ? 'Submitting…' : 'Submit for independent review'}</button>
          </div>
        </form>
      </section>

      <section className="hb-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-bold text-slate-900 dark:text-white">My submitted bank transfers</h2><p className="mt-1 text-xs text-slate-500">Receipts become available only after an administrator verifies the evidence.</p></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(transfersQuery.data?.data || []).length === 0 ? <p className="p-5 text-xs text-slate-500">No bank transfer records have been submitted.</p> : (transfersQuery.data?.data || []).map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0"><p className="font-mono text-[11px] font-bold text-cyan-800 dark:text-cyan-300">{item.caseReference} · {item.bankReference}</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.beneficiaryName} · {item.bankName}</p><p className="mt-1 text-xs text-slate-500">{item.amount} {item.currency} · {item.transferDate} · {item.purpose}</p>{item.verificationNotes && <p className="mt-2 max-w-2xl text-xs text-rose-700 dark:text-rose-300">Review feedback: {item.verificationNotes}</p>}</div>
            <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${item.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : item.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{item.status.replace('_', ' ')}</span><button type="button" onClick={() => viewEvidence(item.evidenceMediaId)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"><FileImage className="h-4 w-4" /></button>{item.status === 'VERIFIED' && <button type="button" onClick={() => viewReceipt(item.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white"><ReceiptText className="h-3.5 w-3.5" />Receipt</button>}</div>
          </article>)}
        </div>
      </section>
    </div>
  );
}
