import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../services/api';

type DocumentRecord = Record<string, unknown>;
type HistoryEntry = {
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedBy: number;
  changedAt: string;
};
type VerificationEntry = { verifiedAt: string };

function asRecord(value: unknown): DocumentRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DocumentRecord
    : {};
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function date(value: unknown): string {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function statusClass(status: string): string {
  if (status === 'ISSUED') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'PENDING_APPROVAL') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (status === 'REVOKED') return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300';
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.025]">
      <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{display(value)}</dd>
    </div>
  );
}

export function DocumentRecordDetails({ record }: { record: DocumentRecord }) {
  const id = Number(record.id);
  const historyQuery = useQuery({
    queryKey: ['admin-document-record-history', id],
    queryFn: () => apiRequest<{ history: HistoryEntry[]; verificationEvents: VerificationEntry[] }>(`/admin/documents/records/${id}/history`),
    enabled: Number.isSafeInteger(id) && id > 0,
  });

  const payload = asRecord(record.payload);
  const organisation = asRecord(record.organisationSnapshot);
  const status = String(record.status || 'UNKNOWN');
  const history = historyQuery.data?.data.history ?? [];
  const verifications = historyQuery.data?.data.verificationEvents ?? [];
  const reference = display(record.referenceCode);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-white/10 dark:from-white/[0.06] dark:to-transparent sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Registry reference</p>
            <p className="mt-1 break-all font-mono text-base font-semibold text-slate-950 dark:text-white">{reference}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{display(record.category)} · {display(record.subject)}</p>
          </div>
          <span className={`inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide ${statusClass(status)}`}>{status.replaceAll('_', ' ')}</span>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Document information</h3>
        <dl className="grid gap-2.5 sm:grid-cols-2">
          <Detail label="Recipient" value={record.recipientName} />
          <Detail label="Document category" value={record.category} />
          <Detail label="Created" value={date(record.createdAt)} />
          <Detail label="Issued" value={date(record.issuedAt)} />
          <Detail label="Expiry" value={date(record.expiresAt)} />
          <Detail label="Public recipient label" value={record.publicRecipientName} />
          <Detail label="Created by user ID" value={record.createdBy} />
          <Detail label="Approved by user ID" value={record.approvedBy} />
          <Detail label="Issued by user ID" value={record.issuedBy} />
          <Detail label="Template version ID" value={record.templateVersionId} />
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Document content</h3>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{display(payload.purpose)}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <Detail label="Programme" value={payload.programme} />
            <Detail label="Start date" value={payload.startDate} />
            <Detail label="End date" value={payload.endDate} />
          </dl>
        </div>
      </section>

      {Object.keys(organisation).length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Issuing organisation snapshot</h3>
          <dl className="grid gap-2.5 sm:grid-cols-2">
            <Detail label="Official name" value={organisation.officialName} />
            <Detail label="Country" value={organisation.country} />
            <Detail label="Registered address" value={organisation.registeredAddress} />
            <Detail label="Issuing department" value={organisation.issuingDepartment} />
          </dl>
        </section>
      )}

      {record.pdfSha256 && (
        <section className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">PDF integrity · SHA-256</p>
          <p className="mt-2 break-all font-mono text-[11px] leading-5 text-slate-700 dark:text-slate-300">{display(record.pdfSha256)}</p>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Status and verification history</h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{history.length} status events · {verifications.length} verification checks</span>
        </div>
        {historyQuery.isPending ? (
          <p className="py-5 text-center text-xs text-slate-500">Loading record history…</p>
        ) : historyQuery.isError ? (
          <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">Record history could not be loaded.</p>
        ) : history.length || verifications.length ? (
          <div className="space-y-2">
            {history.map((entry, index) => (
              <div key={`${entry.changedAt}-${index}`} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-white/10">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{entry.previousStatus ? `${entry.previousStatus.replaceAll('_', ' ')} → ` : ''}{entry.newStatus.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{entry.reason || `Updated by user ${entry.changedBy}`}</p>
                </div>
                <time className="text-[11px] text-slate-500 dark:text-slate-400">{date(entry.changedAt)}</time>
              </div>
            ))}
            {verifications.map((entry, index) => (
              <div key={`verification-${entry.verifiedAt}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-white/10">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Public verification check</span>
                <time className="text-[11px] text-slate-500 dark:text-slate-400">{date(entry.verifiedAt)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/15 dark:text-slate-400">No status changes or verification checks have been recorded.</p>
        )}
      </section>
    </div>
  );
}
