import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { generateDocumentPdf } from '../src/server/services/documentGenerator';

function documentInput(overrides: Partial<Parameters<typeof generateDocumentPdf>[0]> = {}) {
  return {
    referenceCode: 'HB-TEST-2026-000001',
    verificationUrl: 'https://humanitybridge.example/verify/HB-TEST-2026-000001',
    recipientName: 'Acceptance Recipient',
    subject: 'Acceptance document',
    purpose: 'A generated document used to verify PDF output and physical page dimensions.',
    programme: 'Acceptance programme',
    issueDate: '2026-01-15T12:00:00.000Z',
    pageSize: 'A4' as const,
    orientation: 'PORTRAIT' as const,
    title: 'Acceptance certificate',
    organisation: { officialName: 'Acceptance Test Organisation' },
    includeBarcode: true,
    ...overrides,
  };
}

test('generates a valid A4 PDF with verification and barcode data', async () => {
  const contents = await generateDocumentPdf(documentInput());
  const pdf = await PDFDocument.load(contents);
  const page = pdf.getPage(0);

  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(page.getWidth() - 595.2756) < 0.1);
  assert.ok(Math.abs(page.getHeight() - 841.8898) < 0.1);
  assert.equal(contents.toString('ascii', 0, 5), '%PDF-');
});

test('respects landscape letter dimensions and creates a preview PDF', async () => {
  const contents = await generateDocumentPdf(documentInput({
    pageSize: 'LETTER',
    orientation: 'LANDSCAPE',
    preview: true,
    includeBarcode: false,
    verificationUrl: null,
  }));
  const pdf = await PDFDocument.load(contents);
  const page = pdf.getPage(0);

  assert.equal(pdf.getPageCount(), 1);
  assert.equal(page.getWidth(), 792);
  assert.equal(page.getHeight(), 612);
});

test('renders rich editor content and explicit page breaks into landscape A4 pages', async () => {
  const contents = await generateDocumentPdf(documentInput({
    orientation: 'LANDSCAPE',
    contentJson: JSON.stringify({
      type: 'doc',
      pageSettings: {
        orientation: 'LANDSCAPE',
        marginTop: 20,
        marginRight: 18,
        marginBottom: 20,
        marginLeft: 18,
      },
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Custom heading', marks: [{ type: 'bold' }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Saved rich document text.', marks: [{ type: 'italic' }] }] },
        { type: 'pageBreak' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second page.' }] },
      ],
    }),
    pageSettings: { orientation: 'LANDSCAPE', marginRight: 18, marginLeft: 18 },
  }));
  const pdf = await PDFDocument.load(contents);
  assert.equal(pdf.getPageCount(), 2);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 841.8898) < 0.1);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 595.2756) < 0.1);
});

test('paginates table rows stored in the table pagination row groups', async () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    type: 'tableRow',
    content: [
      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Row ${index + 1}` }] }] },
      { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Table cell content' }] }] },
    ],
  }));
  const contents = await generateDocumentPdf(documentInput({
    preview: true,
    includeBarcode: false,
    verificationUrl: null,
    contentJson: JSON.stringify({
      type: 'doc',
      content: [{ type: 'table', content: [{ type: 'tableRowGroup', content: rows }] }],
    }),
  }));
  const pdf = await PDFDocument.load(contents);

  assert.ok(pdf.getPageCount() > 1);
});
