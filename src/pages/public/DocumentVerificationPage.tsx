import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, BadgeCheck, Clock3, FileCheck2, LoaderCircle, LockKeyhole, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../services/api';

type VerificationResult = {
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND';
  referenceCode?: string | null;
  category?: string | null;
  issuingOrganisation?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  recipientName?: string | null;
  verifiedAt?: string;
};

function displayDate(value?: string | null): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function DocumentVerificationPage() {
  const { reference: routeReference } = useParams();
  const navigate = useNavigate();
  const [referenceInput, setReferenceInput] = useState(routeReference || '');
  const reference = routeReference?.trim().toUpperCase() || '';
  const verificationQuery = useQuery({
    queryKey: ['public-document-verification', reference],
    queryFn: () => apiRequest<VerificationResult>(`/public/documents/verify/${encodeURIComponent(reference)}`),
    enabled: Boolean(reference),
    retry: false,
    staleTime: 0,
  });
  const result = verificationQuery.data?.data;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = referenceInput.trim().toUpperCase();
    if (!clean) return;
    navigate(`/verify/${encodeURIComponent(clean)}`);
  };

  const isValid = result?.status === 'VALID';
  const isProblem = result?.status === 'REVOKED' || result?.status === 'EXPIRED' || result?.status === 'NOT_FOUND';

  return (
    <main className="min-h-[70vh] bg-[radial-gradient(ellipse_at_top,_rgba(148,163,184,0.18),_transparent_52%)] px-4 py-12 dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.07),_transparent_50%)] sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white/80 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">HumanityBridge · Public service</p>
          <h1 className="mt-3 font-editorial text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Document verification</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Confirm the status of an officially issued HumanityBridge document using its unique reference.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.09)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111315]/90 sm:p-8">
          <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="document-reference" className="sr-only">Document reference number</label>
            <input
              id="document-reference"
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value.toUpperCase())}
              placeholder="HB-REFERENCE-2026-000001"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-300/50 dark:border-white/15 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-300"
            />
            <button type="submit" disabled={!referenceInput.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
              <Search className="h-4 w-4" /> Verify document
            </button>
          </form>

          {!reference && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Enter the reference printed on the document. Verification is rate-limited and returns only authorised public details.</p>
            </div>
          )}

          {verificationQuery.isPending && reference && (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-12 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Checking the official registry…
            </div>
          )}

          {verificationQuery.isError && (
            <div role="alert" className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Verification is temporarily unavailable</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">The registry could not be reached. This does not indicate whether the document is valid. Please try again shortly.</p>
                  <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-white dark:border-white/15 dark:text-white dark:hover:bg-white/5" onClick={() => void verificationQuery.refetch()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry verification
                  </button>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6">
              <div className={`rounded-2xl border p-5 sm:p-6 ${
                isValid
                  ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                  : isProblem
                    ? 'border-rose-500/25 bg-rose-500/[0.04]'
                    : 'border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03]'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      isValid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : isProblem ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                    }`}>
                      {isValid ? <BadgeCheck className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Registry result</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                        {result.status === 'VALID' ? 'Document is valid'
                          : result.status === 'EXPIRED' ? 'Document has expired'
                            : result.status === 'REVOKED' ? 'Document has been revoked'
                              : 'No public verification record found'}
                      </h2>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider ${
                    isValid ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : isProblem ? 'bg-rose-500/10 text-rose-800 dark:text-rose-200'
                        : 'bg-slate-500/10 text-slate-700 dark:text-slate-200'
                  }`}>{result.status.replaceAll('_', ' ')}</span>
                </div>

                {result.status !== 'NOT_FOUND' && (
                  <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-slate-300/70 pt-5 dark:border-white/10 sm:grid-cols-2">
                    <VerificationValue label="Reference" value={result.referenceCode} mono />
                    <VerificationValue label="Document category" value={result.category} />
                    <VerificationValue label="Issuing organisation" value={result.issuingOrganisation} />
                    <VerificationValue label="Issue date" value={displayDate(result.issueDate)} />
                    <VerificationValue label="Expiry date" value={result.expiryDate ? displayDate(result.expiryDate) : 'No expiry date recorded'} />
                    {result.recipientName && <VerificationValue label="Recipient" value={result.recipientName} />}
                  </dl>
                )}
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Checked against the live public registry{result.verifiedAt ? ` at ${displayDate(result.verifiedAt)}` : ''}. If you believe this result is incorrect, contact HumanityBridge through its official channels.
              </p>
            </div>
          )}
        </section>

        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <FileCheck2 className="h-3.5 w-3.5" /> No private case, contact or supporting information is displayed.
        </div>
      </div>
    </main>
  );
}

function VerificationValue({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{value || 'Not publicly disclosed'}</dd>
    </div>
  );
}
