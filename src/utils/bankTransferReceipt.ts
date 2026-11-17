export interface BankTransferReceipt {
  receiptNumber: string;
  beneficiaryName: string;
  bankName: string;
  bankReference: string;
  amount: number | string;
  currency: string;
  transferDate: string | Date;
  recipientAccountLast4?: string | null;
  purpose: string;
  notes: string;
  verificationNotes: string | null;
  verifiedAt: string | Date | null;
  receiptIssuedAt: string | Date | null;
  caseReference: string;
  caseTitle: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
}

function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function writeBankTransferReceipt(target: Window, receipt: BankTransferReceipt): void {
  const amount = Number(receipt.amount);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : escapeHtml(receipt.amount);
  const rows: Array<[string, string]> = [
    ['Receipt number', receipt.receiptNumber],
    ['Case reference', receipt.caseReference],
    ['Case title', receipt.caseTitle],
    ['Beneficiary', receipt.beneficiaryName],
    ['Bank', receipt.bankName],
    ['Bank transaction reference', receipt.bankReference],
    ['Transfer date', formatDate(receipt.transferDate)],
    ['Amount transferred', `${formattedAmount} ${escapeHtml(receipt.currency)}`],
    ['Recipient account', receipt.recipientAccountLast4 ? `Ending ${escapeHtml(receipt.recipientAccountLast4)}` : 'Not recorded'],
    ['Purpose', receipt.purpose],
    ['Transfer record notes', receipt.notes],
    ['Verification completed', formatDate(receipt.verifiedAt)],
    ['Verified by organisation', receipt.verificationNotes || '—'],
  ];
  const tableRows = rows.map(([label, value]) =>
    `<tr><th>${escapeHtml(label)}</th><td>${label === 'Amount transferred' ? value : escapeHtml(value)}</td></tr>`,
  ).join('');
  target.document.open();
  target.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HumanityBridge Receipt ${escapeHtml(receipt.receiptNumber)}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;background:#f3f6fa;padding:32px}
.sheet{max-width:820px;margin:0 auto;background:#fff;border:1px solid #dbe3ec;padding:42px;box-shadow:0 16px 50px #14243a12}
.brand{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#0e7490}
h1{font-size:26px;margin:12px 0 6px}.sub{font-size:12px;color:#64748b;margin:0 0 24px}
.status{display:inline-block;border-radius:999px;padding:7px 12px;background:#dcfce7;color:#166534;font-size:11px;font-weight:800;letter-spacing:.08em}
table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:13px 10px;border-bottom:1px solid #e8edf3;text-align:left;vertical-align:top;font-size:12px;line-height:1.5}th{width:34%;color:#64748b;font-weight:600}td{font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere}
.notice{margin-top:28px;padding:15px;border:1px solid #f1d49a;background:#fffaf0;color:#7c4a03;font-size:11px;line-height:1.7}
.footer{margin-top:30px;border-top:1px solid #e8edf3;padding-top:15px;color:#64748b;font-size:10px;line-height:1.6}
.actions{max-width:820px;margin:16px auto;display:flex;justify-content:flex-end}button{border:0;border-radius:8px;background:#0e7490;color:#fff;padding:11px 18px;font-weight:700;cursor:pointer}
@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;box-shadow:none;padding:24px}.actions{display:none}}
</style></head><body><main class="sheet">
<div class="brand">HumanityBridge · Humanitarian Assistance</div>
<h1>External Bank Transfer Verification Receipt</h1>
<p class="sub">Official organisational acknowledgement · Issued ${escapeHtml(formatDate(receipt.receiptIssuedAt))}</p>
<span class="status">VERIFIED RECORD</span>
<table><tbody>${tableRows}</tbody></table>
<div class="notice"><strong>Important clarification:</strong> This is a HumanityBridge organisational receipt confirming that the submitted external bank-transfer record and supporting evidence were reviewed and approved by an authorised reviewer. It is not issued by the bank and does not replace the bank's official transaction receipt or statement.</div>
<div class="footer">Keep this receipt with the original bank confirmation. Receipt reference: ${escapeHtml(receipt.receiptNumber)}. Any correction or dispute should quote this reference and the case reference.</div>
</main><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div></body></html>`);
  target.document.close();
  target.focus();
}

export async function openBankTransferReceipt(fetchReceipt: () => Promise<BankTransferReceipt>): Promise<void> {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Please allow pop-ups to open the receipt.');
  try {
    writeBankTransferReceipt(popup, await fetchReceipt());
  } catch (error) {
    popup.close();
    throw error;
  }
}
