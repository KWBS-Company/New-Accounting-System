import { type PDFDocument, type PDFPage } from 'pdf-lib';
import { COLORS, truncate, drawHRule } from './utils';
import { drawFooter } from './footer';
import type { DrawContext } from './types';
import { LedgerLine, LedgerPDFData } from 'src/accounts/types/ledger.types';
// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROW_H = 22;
const TH_H = 22;
const FOOTER_SPACE = 110;

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
          });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Column layout
//  Date(14%) | Voucher No(14%) | Description(38%) | Debit(12%) | Credit(12%) | Balance(10%)
// ─────────────────────────────────────────────────────────────────────────────

interface Col {
    label: string;
    w: number;
    x: number;
    align: 'left' | 'right';
}

function buildCols(currency: string, contentW: number, marginX: number): Col[] {
    const specs: [string, number, 'left' | 'right'][] = [
        ['Date', 0.14, 'left'],
        ['Voucher No', 0.14, 'left'],
        ['Description', 0.38, 'left'],
        [`Debit (${currency})`, 0.12, 'right'],
        [`Credit (${currency})`, 0.12, 'right'],
        ['Balance', 0.1, 'right'],
    ];
    let x = marginX;
    return specs.map(([label, frac, align]) => {
        const w = frac * contentW;
        const col: Col = { label, w, x, align };
        x += w;
        return col;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawAccountInfoBox  – account name / code / type card above the table
// ─────────────────────────────────────────────────────────────────────────────

function drawAccountInfoBox(
    page: PDFPage,
    ctx: DrawContext,
    data: LedgerPDFData,
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { regular, bold } = fonts;
    const { margin, contentW } = layout;

    const { ledger } = data;
    const BOX_H = 52;
    const PAD = 10;
    const BG = COLORS.rowBorder; // very light fill

    // Background rect
    page.drawRectangle({
        x: margin,
        y: y - BOX_H,
        width: contentW,
        height: BOX_H,
        color: BG,
        borderColor: COLORS.lightGray,
        borderWidth: 1,
    });

    // Account name (large, bold)
    page.drawText(truncate(ledger.name, bold, 11, contentW * 0.6), {
        x: margin + PAD,
        y: y - 18,
        size: 11,
        font: bold,
        color: COLORS.black,
    });

    // Code tag
    const codeLabel = `Code: ${ledger.code}`;
    page.drawText(codeLabel, {
        x: margin + PAD,
        y: y - 34,
        size: 8.5,
        font: regular,
        color: COLORS.darkGray,
    });

    // Account type (right-aligned)
    const typeLabel = ledger.accountType;
    const tlW = bold.widthOfTextAtSize(typeLabel, 8.5);
    page.drawText(typeLabel, {
        x: margin + contentW - PAD - tlW,
        y: y - 18,
        size: 8.5,
        font: bold,
        color: COLORS.darkGray,
    });

    return y - BOX_H - 14;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawTableHeader
// ─────────────────────────────────────────────────────────────────────────────

function drawTableHeader(
    page: PDFPage,
    ctx: DrawContext,
    cols: Col[],
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { bold } = fonts;
    const { margin, contentW } = layout;
    const SIZE = 7.5;

    drawHRule(page, margin, y, contentW, 1.8, COLORS.black);

    for (const col of cols) {
        const lW = bold.widthOfTextAtSize(col.label, SIZE);
        const tx = col.align === 'right' ? col.x + col.w - lW - 3 : col.x + 3;
        page.drawText(col.label, {
            x: tx,
            y: y - TH_H + 7,
            size: SIZE,
            font: bold,
            color: COLORS.black,
        });
    }

    drawHRule(page, margin, y - TH_H, contentW, 1.8, COLORS.black);
    return y - TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawOpeningRow  – "Opening Balance" row (no debit/credit, just balance col)
// ─────────────────────────────────────────────────────────────────────────────

function drawOpeningRow(
    page: PDFPage,
    ctx: DrawContext,
    cols: Col[],
    openingBalance: number,
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { bold } = fonts;
    const { margin, contentW } = layout;

    drawHRule(page, margin, y - ROW_H, contentW, 0.5, COLORS.rowBorder);

    page.drawText('Opening Balance', {
        x: cols[0].x + 3,
        y: y - ROW_H + 7,
        size: 9,
        font: bold,
        color: COLORS.darkGray,
    });

    const balStr = formatAmount(openingBalance);
    const balW = bold.widthOfTextAtSize(balStr, 9);
    page.drawText(balStr, {
        x: cols[5].x + cols[5].w - balW - 3,
        y: y - ROW_H + 7,
        size: 9,
        font: bold,
        color: COLORS.black,
    });

    return y - ROW_H;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawLedgerLine  – one transaction row
// ─────────────────────────────────────────────────────────────────────────────

function drawLedgerRow(
    page: PDFPage,
    ctx: DrawContext,
    cols: Col[],
    line: LedgerLine,
    y: number,
): void {
    const { fonts, layout } = ctx;
    const { regular } = fonts;
    const { margin, contentW } = layout;
    const SIZE = 8.5;

    drawHRule(page, margin, y - ROW_H, contentW, 0.5, COLORS.rowBorder);

    // Date
    page.drawText(
        truncate(
            formatDate(line.transactionDate),
            regular,
            SIZE,
            cols[0].w - 6,
        ),
        {
            x: cols[0].x + 3,
            y: y - ROW_H + 7,
            size: SIZE,
            font: regular,
            color: COLORS.bodyText,
        },
    );

    // Voucher No
    const vnLabel = line.serialNumber ? `VN-${line.serialNumber}` : '-';
    page.drawText(truncate(vnLabel, regular, SIZE, cols[1].w - 6), {
        x: cols[1].x + 3,
        y: y - ROW_H + 7,
        size: SIZE,
        font: regular,
        color: COLORS.darkGray,
    });

    // Description
    page.drawText(
        truncate(line.description || '-', regular, SIZE, cols[2].w - 6),
        {
            x: cols[2].x + 3,
            y: y - ROW_H + 7,
            size: SIZE,
            font: regular,
            color: COLORS.bodyText,
        },
    );

    // Debit
    const debitStr = formatAmount(line.debit);
    const debitColor = line.debit === 0 ? COLORS.midGray : COLORS.bodyText;
    const debitW = regular.widthOfTextAtSize(debitStr, SIZE);
    page.drawText(debitStr, {
        x: cols[3].x + cols[3].w - debitW - 3,
        y: y - ROW_H + 7,
        size: SIZE,
        font: regular,
        color: debitColor,
    });

    // Credit
    const creditStr = formatAmount(line.credit);
    const creditColor = line.credit === 0 ? COLORS.midGray : COLORS.bodyText;
    const creditW = regular.widthOfTextAtSize(creditStr, SIZE);
    page.drawText(creditStr, {
        x: cols[4].x + cols[4].w - creditW - 3,
        y: y - ROW_H + 7,
        size: SIZE,
        font: regular,
        color: creditColor,
    });

    // Running balance (pre-computed by backend on line.balance)
    const balStr = formatAmount(line.balance);
    const balColor = line.balance < 0 ? COLORS.red : COLORS.black;
    const balW = regular.widthOfTextAtSize(balStr, SIZE);
    page.drawText(balStr, {
        x: cols[5].x + cols[5].w - balW - 3,
        y: y - ROW_H + 7,
        size: SIZE,
        font: regular,
        color: balColor,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawClosingRow  – bold "Closing Balance" totals row
// ─────────────────────────────────────────────────────────────────────────────

function drawClosingRow(
    page: PDFPage,
    ctx: DrawContext,
    cols: Col[],
    totalDebit: number,
    totalCredit: number,
    closingBalance: number,
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { bold } = fonts;
    const { margin, contentW } = layout;
    const SIZE = 9;

    drawHRule(page, margin, y, contentW, 1.8, COLORS.black);
    y -= ROW_H;

    page.drawText('Closing Balance', {
        x: margin + 3,
        y: y + 7,
        size: SIZE,
        font: bold,
        color: COLORS.black,
    });

    // Total debit
    const tdStr = formatAmount(totalDebit);
    const tdW = bold.widthOfTextAtSize(tdStr, SIZE);
    page.drawText(tdStr, {
        x: cols[3].x + cols[3].w - tdW - 3,
        y: y + 7,
        size: SIZE,
        font: bold,
        color: COLORS.black,
    });

    // Total credit
    const tcStr = formatAmount(totalCredit);
    const tcW = bold.widthOfTextAtSize(tcStr, SIZE);
    page.drawText(tcStr, {
        x: cols[4].x + cols[4].w - tcW - 3,
        y: y + 7,
        size: SIZE,
        font: bold,
        color: COLORS.black,
    });

    // Closing balance
    const cbStr = formatAmount(closingBalance);
    const cbColor = closingBalance < 0 ? COLORS.red : COLORS.green;
    const cbW = bold.widthOfTextAtSize(cbStr, SIZE);
    page.drawText(cbStr, {
        x: cols[5].x + cols[5].w - cbW - 3,
        y: y + 7,
        size: SIZE,
        font: bold,
        color: cbColor,
    });

    return y;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawLedgerBody  (main export)
//
//  Renders:
//    1. Report title + date range meta
//    2. Account info box
//    3. Table: Opening Balance row → transaction rows → Closing Balance row
//
//  Returns last PDFPage for caller to stamp drawFooter on.
// ─────────────────────────────────────────────────────────────────────────────

export function drawLedgerBody(
    pdfDoc: PDFDocument,
    page: PDFPage,
    ctx: DrawContext,
    data: LedgerPDFData,
    startY: number,
): PDFPage {
    const { fonts, layout } = ctx;
    const { regular, bold } = fonts;
    const { margin, contentW } = layout;

    const currency = data.currency ?? 'USD';
    const cols = buildCols(currency, contentW, margin);
    let y = startY;
    let curPage = page;

    // ── 1. Title ──────────────────────────────────────────────────────────
    const TITLE = 'LEDGER';
    const TITLE_SIZE = 17;
    const titleW = bold.widthOfTextAtSize(TITLE, TITLE_SIZE);
    curPage.drawText(TITLE, {
        x: margin + (contentW - titleW) / 2,
        y: y - TITLE_SIZE,
        size: TITLE_SIZE,
        font: bold,
        color: COLORS.black,
    });
    y -= TITLE_SIZE + 20;

    // ── 2. Meta row (from / to) ───────────────────────────────────────────
    const META_SIZE = 9.5;
    curPage.drawText(`Report Date: ${data.reportDate}`, {
        x: margin,
        y,
        size: META_SIZE,
        font: regular,
        color: COLORS.darkGray,
    });
    const periodStr = `Period: ${data.fromDate}  –  ${data.toDate}`;
    const psW = regular.widthOfTextAtSize(periodStr, META_SIZE);
    curPage.drawText(periodStr, {
        x: margin + contentW - psW,
        y,
        size: META_SIZE,
        font: regular,
        color: COLORS.darkGray,
    });
    y -= 18;

    // ── 3. Account info box ───────────────────────────────────────────────
    y = drawAccountInfoBox(curPage, ctx, data, y);

    // ── 4. Table header ───────────────────────────────────────────────────
    y = drawTableHeader(curPage, ctx, cols, y);

    // ── 5. Opening balance row ────────────────────────────────────────────
    y = drawOpeningRow(curPage, ctx, cols, data.summary.openingBalance, y);

    // ── 6. Transaction rows ───────────────────────────────────────────────
    for (const line of data.lines) {
        if (y - ROW_H < layout.margin + FOOTER_SPACE) {
            drawFooter(curPage, ctx);
            curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
            y = curPage.getHeight() - layout.margin - 10;
            y = drawTableHeader(curPage, ctx, cols, y);
        }

        drawLedgerRow(curPage, ctx, cols, line, y);
        y -= ROW_H;
    }

    // ── 7. Closing balance row ────────────────────────────────────────────
    if (y - ROW_H < layout.margin + FOOTER_SPACE) {
        drawFooter(curPage, ctx);
        curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
        y = curPage.getHeight() - layout.margin - 10;
        y = drawTableHeader(curPage, ctx, cols, y);
    }

    // Use pre-computed summary values from the backend
    drawClosingRow(
        curPage,
        ctx,
        cols,
        data.summary.totalDebit,
        data.summary.totalCredit,
        data.summary.closingBalance,
        y,
    );

    return curPage;
}
