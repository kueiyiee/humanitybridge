import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as bwipjs from 'bwip-js/node';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

export interface DocumentOrganisationSnapshot {
  officialName?: string | null;
  registeredAddress?: string | null;
  country?: string | null;
  telephone?: string | null;
  email?: string | null;
  website?: string | null;
  registrationInformation?: string | null;
  approvedTagline?: string | null;
  issuingDepartment?: string | null;
  footerDisclaimer?: string | null;
}

export interface DocumentSignatorySnapshot {
  fullName: string;
  position: string;
  department?: string | null;
}

export interface GeneratedDocumentInput {
  referenceCode: string;
  verificationUrl: string | null;
  recipientName: string;
  subject: string;
  purpose: string;
  programme?: string;
  startDate?: string;
  endDate?: string;
  issueDate: string;
  expiresAt?: string | null;
  pageSize: 'A4' | 'LETTER';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  title: string;
  introduction?: string;
  footerText?: string;
  includeBarcode?: boolean;
  organisation: DocumentOrganisationSnapshot;
  signatory?: DocumentSignatorySnapshot | null;
  contentJson?: string;
  pageSettings?: {
    orientation?: 'PORTRAIT' | 'LANDSCAPE';
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
    showPageNumbers?: boolean;
  };
  preview?: boolean;
}

const MARGIN = 50;
const FOOTER_HEIGHT = 105;
const LOGO_PATH = fileURLToPath(new URL('../../assets/images/HumanityBridge Global Unity Logo.png', import.meta.url));

function wrapLine(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pageDimensions(input: GeneratedDocumentInput): [number, number] {
  const dimensions: [number, number] = input.pageSize === 'A4'
    ? [595.2756, 841.8898]
    : [612, 792];
  return input.orientation === 'LANDSCAPE' ? [dimensions[1], dimensions[0]] : dimensions;
}

function displayDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' });
}

type EditorNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: EditorNode[];
};

function colorValue(value: unknown, fallback = rgb(0.13, 0.15, 0.16)) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return fallback;
  return rgb(
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  );
}

export async function generateDocumentPdf(input: GeneratedDocumentInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title);
  pdf.setSubject(input.subject);
  pdf.setAuthor(input.organisation.officialName || 'HumanityBridge');
  pdf.setCreator('HumanityBridge Document Centre');

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const times = await pdf.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const timesBoldItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const courier = await pdf.embedFont(StandardFonts.Courier);
  const courierBold = await pdf.embedFont(StandardFonts.CourierBold);
  const courierItalic = await pdf.embedFont(StandardFonts.CourierOblique);
  const courierBoldItalic = await pdf.embedFont(StandardFonts.CourierBoldOblique);
  const [pageWidth, pageHeight] = pageDimensions(input);
  const logo = await pdf.embedPng(await fs.readFile(LOGO_PATH));
  const qrPng = input.preview || !input.verificationUrl
    ? null
    : await QRCode.toBuffer(input.verificationUrl, {
        type: 'png',
        errorCorrectionLevel: 'Q',
        margin: 4,
        width: 240,
      });
  const barcodePng = input.preview || input.includeBarcode === false
    ? null
    : await bwipjs.toBuffer({
        bcid: 'code128',
        text: input.referenceCode,
        scale: 2,
        height: 10,
        includetext: true,
        textxalign: 'center',
        paddingwidth: 4,
        paddingheight: 2,
      });
  const qr = qrPng ? await pdf.embedPng(qrPng) : null;
  const barcode = barcodePng ? await pdf.embedPng(barcodePng) : null;
  const pageSize: [number, number] = [pageWidth, pageHeight];
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let cursorY!: number;

  const addPage = () => {
    page = pdf.addPage(pageSize);
    pages.push(page);
    cursorY = pageHeight - 124;
    if (input.pageSettings?.headerText?.trim()) {
      page.drawText(input.pageSettings.headerText.trim(), {
        x: MARGIN,
        y: pageHeight - 18,
        size: 8,
        font: regular,
        color: rgb(0.35, 0.38, 0.4),
        maxWidth: pageWidth - MARGIN * 2,
      });
    }
    const logoScale = Math.min(94 / logo.width, 50 / logo.height);
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    page.drawImage(logo, {
      x: MARGIN,
      y: pageHeight - 80 - logoHeight / 2,
      width: logoWidth,
      height: logoHeight,
    });

    const organisationName = input.organisation.officialName?.trim() || 'HumanityBridge';
    page.drawText(organisationName, {
      x: MARGIN + 112,
      y: pageHeight - 48,
      size: 15,
      font: bold,
      color: rgb(0.1, 0.12, 0.13),
      maxWidth: pageWidth - MARGIN * 2 - 112,
    });

    const contactLines = [
      input.organisation.registeredAddress,
      [input.organisation.country, input.organisation.telephone].filter(Boolean).join(' · '),
      [input.organisation.email, input.organisation.website].filter(Boolean).join(' · '),
      input.organisation.registrationInformation,
    ].filter((line): line is string => Boolean(line?.trim()));
    let headerY = pageHeight - 63;
    for (const contactLine of contactLines.slice(0, 3)) {
      page.drawText(contactLine, {
        x: MARGIN + 112,
        y: headerY,
        size: 7.5,
        font: regular,
        color: rgb(0.35, 0.38, 0.4),
        maxWidth: pageWidth - MARGIN * 2 - 112,
      });
      headerY -= 10;
    }
    if (input.organisation.approvedTagline?.trim()) {
      page.drawText(input.organisation.approvedTagline.trim(), {
        x: MARGIN,
        y: pageHeight - 102,
        size: 8,
        font: regular,
        color: rgb(0.35, 0.38, 0.4),
        maxWidth: pageWidth - MARGIN * 2,
      });
      cursorY = pageHeight - 132;
    } else {
      cursorY = pageHeight - 116;
    }
    page.drawLine({
      start: { x: MARGIN, y: cursorY + 12 },
      end: { x: pageWidth - MARGIN, y: cursorY + 12 },
      thickness: 0.8,
      color: rgb(0.78, 0.8, 0.81),
    });
  };

  addPage();
  const contentWidth = pageWidth - MARGIN * 2;
  const ensureRoom = (needed: number) => {
    if (cursorY - needed < FOOTER_HEIGHT + 22) addPage();
  };
  const drawFlow = (
    text: string,
    font: PDFFont,
    fontSize: number,
    color = rgb(0.13, 0.15, 0.16),
    lineGap = 4,
  ) => {
    for (const paragraph of text.split(/\r?\n/)) {
      for (const line of wrapLine(paragraph, font, fontSize, contentWidth)) {
        ensureRoom(fontSize + lineGap);
        page.drawText(line, { x: MARGIN, y: cursorY, size: fontSize, font, color });
        cursorY -= fontSize + lineGap;
      }
      cursorY -= lineGap;
    }
  };
  const drawField = (label: string, value: string, size = 10) => {
    if (!value.trim()) return;
    ensureRoom(size + 20);
    page.drawText(label, {
      x: MARGIN,
      y: cursorY,
      size: 8,
      font: bold,
      color: rgb(0.35, 0.38, 0.4),
    });
    cursorY -= 14;
    drawFlow(value, regular, size);
    cursorY -= 8;
  };

  const drawEditorContent = async () => {
    const root = JSON.parse(input.contentJson!) as EditorNode;
    const settings = input.pageSettings;
    const left = settings?.marginLeft ? settings.marginLeft * 72 / 25.4 : MARGIN;
    const right = settings?.marginRight ? settings.marginRight * 72 / 25.4 : MARGIN;
    const width = pageWidth - left - right;
    const fontFor = (marks: EditorNode['marks'], attrs: Record<string, unknown> = {}): PDFFont => {
      const family = String(attrs.fontFamily || '').toLowerCase();
      const isBold = Boolean(marks?.some((mark) => mark.type === 'bold'));
      const isItalic = Boolean(marks?.some((mark) => mark.type === 'italic'));
      if (family.includes('courier')) return isBold ? (isItalic ? courierBoldItalic : courierBold) : (isItalic ? courierItalic : courier);
      if (family.includes('georgia') || family.includes('times')) return isBold ? (isItalic ? timesBoldItalic : timesBold) : (isItalic ? timesItalic : times);
      return isBold ? (isItalic ? boldItalic : bold) : (isItalic ? italic : regular);
    };
    const textColor = (marks: EditorNode['marks']) => {
      const colorMark = marks?.find((mark) => mark.type === 'textStyle')?.attrs?.color;
      return colorValue(colorMark);
    };
    const drawParagraph = (node: EditorNode, prefix = '') => {
      const attrs = node.attrs || {};
      const headingLevel = node.type === 'heading' ? Number(attrs.level) || 1 : 0;
      const baseSize = headingLevel === 1 ? 24 : headingLevel === 2 ? 18 : headingLevel === 3 ? 14 : 11;
      const indent = Math.max(0, Math.min(8, Number(attrs.indent) || 0)) * 20;
      const startX = left + indent;
      const maxWidth = Math.max(30, width - indent);
      const tokens: Array<{ text: string; font: PDFFont; size: number; color: ReturnType<typeof rgb>; highlight: ReturnType<typeof rgb> | null; underline: boolean }> = [];
      const collect = (child: EditorNode) => {
        if (child.type === 'hardBreak') {
          tokens.push({ text: '\n', font: regular, size: baseSize, color: rgb(0.13, 0.15, 0.16), highlight: null, underline: false });
          return;
        }
        if (child.text !== undefined) {
          const marks = child.marks || [];
          const style = marks.find((mark) => mark.type === 'textStyle')?.attrs || {};
          const sizeValue = typeof style.fontSize === 'string' ? Number.parseFloat(style.fontSize) : NaN;
          const fontSizeValue = typeof style.fontSize === 'string' ? style.fontSize : '';
          const size = Number.isFinite(sizeValue) ? sizeValue * (fontSizeValue.endsWith('pt') ? 1 : 0.75) : baseSize;
          const highlightValue = marks.find((mark) => mark.type === 'highlight')?.attrs?.color;
          const color = textColor(marks);
          const font = fontFor(marks, style);
          for (const token of child.text.split(/(\s+)/).filter(Boolean)) {
            tokens.push({
              text: token,
              font,
              size,
              color,
              highlight: highlightValue ? colorValue(highlightValue, rgb(1, 0.94, 0.45)) : null,
              underline: marks.some((mark) => mark.type === 'underline'),
            });
          }
          return;
        }
        child.content?.forEach(collect);
      };
      node.content?.forEach(collect);
      const defaultColor = rgb(0.13, 0.15, 0.16);
      if (prefix) {
        tokens.unshift({ text: prefix, font: bold, size: baseSize, color: defaultColor, highlight: null, underline: false });
      }
      const lines: Array<typeof tokens> = [[]];
      let lineWidth = 0;
      for (const token of tokens) {
        if (token.text === '\n') {
          lines.push([]);
          lineWidth = 0;
          continue;
        }
        const tokenWidth = token.font.widthOfTextAtSize(token.text, token.size);
        if (lineWidth > 0 && lineWidth + tokenWidth > maxWidth) {
          lines.push([]);
          lineWidth = 0;
          if (/^\s+$/.test(token.text)) continue;
        }
        lines[lines.length - 1].push(token);
        lineWidth += tokenWidth;
      }
      const lineHeight = baseSize * (Number.parseFloat(String(attrs.lineHeight || '1.5')) || 1.5);
      for (const line of lines) {
        ensureRoom(lineHeight + 3);
        const actualWidth = line.reduce((sum, token) => sum + token.font.widthOfTextAtSize(token.text, token.size), 0);
        const alignment = attrs.textAlign;
        let x = startX;
        if (alignment === 'center') x += Math.max(0, (maxWidth - actualWidth) / 2);
        if (alignment === 'right') x += Math.max(0, maxWidth - actualWidth);
        for (const token of line) {
          const tokenWidth = token.font.widthOfTextAtSize(token.text, token.size);
          if (token.highlight) page.drawRectangle({
            x,
            y: cursorY - 2,
            width: tokenWidth,
            height: token.size + 4,
            color: token.highlight,
          });
          page.drawText(token.text, { x, y: cursorY, size: token.size, font: token.font, color: token.color });
          if (token.underline) page.drawLine({
            start: { x, y: cursorY - 1.5 },
            end: { x: x + tokenWidth, y: cursorY - 1.5 },
            thickness: 0.6,
            color: token.color,
          });
          x += tokenWidth;
        }
        cursorY -= lineHeight;
      }
      cursorY -= headingLevel ? 8 : 3;
    };
    const drawBlock = async (node: EditorNode, listPrefix = ''): Promise<void> => {
      if (node.type === 'pageBreak') {
        addPage();
        return;
      }
      if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote' || node.type === 'codeBlock') {
        if (node.type === 'blockquote') cursorY -= 4;
        drawParagraph(node, listPrefix || (node.type === 'blockquote' ? '> ' : ''));
        if (node.type === 'blockquote') cursorY -= 4;
        return;
      }
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        let index = Number(node.attrs?.start) || 1;
        for (const item of node.content || []) {
          await drawBlock(item, node.type === 'orderedList' ? `${index++}. ` : '• ');
        }
        cursorY -= 3;
        return;
      }
      if (node.type === 'listItem') {
        for (const child of node.content || []) await drawBlock(child, listPrefix);
        return;
      }
      if (node.type === 'image') {
        const source = node.attrs?.src;
        if (typeof source !== 'string' || !source.startsWith('data:image/')) return;
        const imageMatch = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i.exec(source);
        if (!imageMatch) return;
        const imageData = Buffer.from(imageMatch[2], 'base64');
        const image = imageMatch[1].toLowerCase() === 'png'
          ? await pdf.embedPng(imageData)
          : await pdf.embedJpg(imageData);
        const maxImageWidth = width;
        const widthValue = node.attrs?.width;
        const originalWidth = typeof widthValue === 'string' && widthValue.endsWith('%')
          ? maxImageWidth * (Number.parseFloat(widthValue) / 100)
          : Number(widthValue) || maxImageWidth;
        const scaledWidth = Math.min(maxImageWidth, originalWidth);
        const scaledHeight = image.height * scaledWidth / image.width;
        ensureRoom(scaledHeight + 8);
        page.drawImage(image, { x: left, y: cursorY - scaledHeight, width: scaledWidth, height: scaledHeight });
        cursorY -= scaledHeight + 8;
        return;
      }
      if (node.type === 'table') {
        const rows = (node.content || []).flatMap((child) =>
          child.type === 'tableRowGroup' ? child.content || [] : [child],
        );
        const cellsPerRow = Math.max(1, ...rows.map((row) => row.content?.length || 0));
        const cellWidth = width / cellsPerRow;
        for (const row of rows) {
          const cells = (row.content || []).map((cell) => {
            const text = (cell.content || []).flatMap((paragraph) => paragraph.content || [])
              .map((child) => child.text || '').join(' ');
            return {
              cell,
              lines: wrapLine(text, regular, 9, cellWidth - 8),
            };
          });
          const rowHeight = Math.max(24, ...cells.map(({ lines }) => lines.length * 12 + 8));
          ensureRoom(rowHeight);
          let x = left;
          for (const { cell, lines } of cells) {
            page.drawRectangle({ x, y: cursorY - rowHeight + 4, width: cellWidth, height: rowHeight, borderColor: rgb(0.6, 0.63, 0.65), borderWidth: 0.5 });
            lines.forEach((line, lineIndex) => page.drawText(line, {
              x: x + 4,
              y: cursorY - 11 - lineIndex * 12,
              size: 9,
              font: cell.type === 'tableHeader' ? bold : regular,
              color: rgb(0.13, 0.15, 0.16),
              maxWidth: cellWidth - 8,
            }));
            x += cellWidth;
          }
          cursorY -= rowHeight;
        }
        cursorY -= 8;
        return;
      }
      for (const child of node.content || []) await drawBlock(child, listPrefix);
    };
    for (const child of root.content || []) await drawBlock(child);
  };

  if (input.contentJson) {
    await drawEditorContent();
  } else {
    drawFlow(input.title, bold, 22, rgb(0.12, 0.14, 0.15), 4);
    cursorY -= 12;
    if (input.introduction?.trim()) {
      drawFlow(input.introduction.trim(), regular, 10, rgb(0.25, 0.28, 0.29), 5);
      cursorY -= 10;
    }

    drawField('RECIPIENT', input.recipientName, 12);
    drawField('DOCUMENT SUBJECT', input.subject, 11);
    drawField('PURPOSE', input.purpose);
    drawField('PROGRAMME OR PROJECT', input.programme || '');
    drawField('PARTICIPATION PERIOD', [displayDate(input.startDate), displayDate(input.endDate)].filter(Boolean).join(' – '));
    drawField('ISSUE DATE', displayDate(input.issueDate), 9);
    drawField('EXPIRY DATE', displayDate(input.expiresAt), 9);
  }

  ensureRoom(70);
  if (input.signatory) {
    cursorY -= 8;
    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end: { x: MARGIN + 190, y: cursorY },
      thickness: 0.8,
      color: rgb(0.55, 0.58, 0.59),
    });
    cursorY -= 17;
    page.drawText(input.signatory.fullName, {
      x: MARGIN,
      y: cursorY,
      size: 10,
      font: bold,
      color: rgb(0.12, 0.14, 0.15),
    });
    cursorY -= 13;
    page.drawText(
      [input.signatory.position, input.signatory.department].filter(Boolean).join(' · '),
      { x: MARGIN, y: cursorY, size: 8, font: regular, color: rgb(0.35, 0.38, 0.4) },
    );
    cursorY -= 14;
    page.drawText('Authorised signatory (typed name; not a cryptographic signature)', {
      x: MARGIN,
      y: cursorY,
      size: 7,
      font: regular,
      color: rgb(0.45, 0.48, 0.49),
    });
  }

  for (const [index, documentPage] of pages.entries()) {
    const footerY = 76;
    documentPage.drawLine({
      start: { x: MARGIN, y: footerY + 16 },
      end: { x: pageWidth - MARGIN, y: footerY + 16 },
      thickness: 0.8,
      color: rgb(0.78, 0.8, 0.81),
    });
    if (input.preview) {
      documentPage.drawText('PREVIEW ONLY · Reference and verification code are assigned at issuance.', {
        x: MARGIN,
        y: footerY - 1,
        size: 8,
        font: bold,
        color: rgb(0.4, 0.42, 0.43),
      });
    } else if (qr && barcode) {
      documentPage.drawImage(qr, { x: MARGIN, y: footerY - 38, width: 52, height: 52 });
      documentPage.drawImage(barcode, { x: MARGIN + 62, y: footerY - 20, width: 166, height: 35 });
      documentPage.drawText(`Reference: ${input.referenceCode}`, {
        x: MARGIN + 62,
        y: footerY + 1,
        size: 7,
        font: bold,
        color: rgb(0.15, 0.17, 0.18),
      });
      documentPage.drawText(input.verificationUrl || '', {
        x: MARGIN + 240,
        y: footerY + 1,
        size: 7,
        font: regular,
        color: rgb(0.28, 0.31, 0.32),
        maxWidth: pageWidth - MARGIN * 2 - 240,
      });
    } else if (barcode) {
      documentPage.drawImage(barcode, { x: MARGIN, y: footerY - 20, width: 166, height: 35 });
      documentPage.drawText(`Reference: ${input.referenceCode}`, {
        x: MARGIN + 180,
        y: footerY + 1,
        size: 7,
        font: bold,
        color: rgb(0.15, 0.17, 0.18),
      });
    } else if (qr) {
      documentPage.drawImage(qr, { x: MARGIN, y: footerY - 38, width: 52, height: 52 });
      documentPage.drawText(`Reference: ${input.referenceCode}`, {
        x: MARGIN + 62,
        y: footerY + 1,
        size: 7,
        font: bold,
        color: rgb(0.15, 0.17, 0.18),
      });
      documentPage.drawText(input.verificationUrl || '', {
        x: MARGIN + 62,
        y: footerY - 12,
        size: 7,
        font: regular,
        color: rgb(0.28, 0.31, 0.32),
        maxWidth: pageWidth - MARGIN * 2 - 62,
      });
    } else {
      documentPage.drawText(`Reference: ${input.referenceCode}`, {
        x: MARGIN,
        y: footerY - 1,
        size: 8,
        font: bold,
        color: rgb(0.4, 0.42, 0.43),
      });
    }
    const footerText = input.organisation.footerDisclaimer?.trim() || input.footerText?.trim();
    if (footerText) {
      documentPage.drawText(footerText, {
        x: MARGIN,
        y: 30,
        size: 7,
        font: regular,
        color: rgb(0.4, 0.42, 0.43),
        maxWidth: pageWidth - MARGIN * 2 - 70,
      });
    }
    if (input.pageSettings?.footerText?.trim()) {
      documentPage.drawText(input.pageSettings.footerText.trim(), {
        x: MARGIN,
        y: 14,
        size: 7,
        font: regular,
        color: rgb(0.4, 0.42, 0.43),
        maxWidth: pageWidth - MARGIN * 2 - 70,
      });
    }
    documentPage.drawText(
      `${input.preview ? 'Preview' : input.referenceCode}${input.pageSettings?.showPageNumbers === false ? '' : ` · ${index + 1} / ${pages.length}`}`,
      {
        x: pageWidth - MARGIN - 68,
        y: 30,
        size: 7,
        font: regular,
        color: rgb(0.4, 0.42, 0.43),
      },
    );
  }

  const output = await pdf.save();
  return Buffer.from(output);
}

export function sha256Document(contents: Buffer): string {
  return crypto.createHash('sha256').update(contents).digest('hex');
}
