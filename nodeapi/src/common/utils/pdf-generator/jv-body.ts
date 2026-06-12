import { type PDFDocument, type PDFPage } from "pdf-lib";
import { COLORS, truncate, drawHRule } from "./utils";
import { drawFooter } from "./footer";
import type { DrawContext } from "./types";
import { JournalLine, JournalVoucherData } from "src/accounts/types/account_report.types";

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROW_H        = 22;
const TH_H         = 22;
const FOOTER_SPACE = 110;

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Column layout
//  Account(26%) | Description(34%) | Debit(20%) | Credit(20%)
// ─────────────────────────────────────────────────────────────────────────────

interface Col { label: string; w: number; x: number; align: "left" | "right" }

function buildCols(currency: string, contentW: number, marginX: number): Col[] {
  const fractions = [0.26, 0.34, 0.20, 0.20];
  const labels    = ["Account", "Description", `Debit (${currency})`, `Credit (${currency})`];
  const aligns: ("left" | "right")[] = ["left", "left", "right", "right"];

  let x = marginX;
  return fractions.map((f, i) => {
    const w = f * contentW;
    const col: Col = { label: labels[i], w, x, align: aligns[i] };
    x += w;
    return col;
  });
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
  const SIZE = 8;

  drawHRule(page, margin, y, contentW, 1.8, COLORS.black);

  for (const col of cols) {
    const lW = bold.widthOfTextAtSize(col.label, SIZE);
    const tx = col.align === "right" ? col.x + col.w - lW - 4 : col.x + 4;
    page.drawText(col.label, {
      x: tx, y: y - TH_H + 7, size: SIZE, font: bold, color: COLORS.black,
    });
  }

  drawHRule(page, margin, y - TH_H, contentW, 1.8, COLORS.black);
  return y - TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawMetaGrid  – 2-column grid of label: value pairs
//  Returns Y below the grid.
// ─────────────────────────────────────────────────────────────────────────────

function drawMetaGrid(
  page: PDFPage,
  ctx: DrawContext,
  rows: Array<{ label: string; value: string }>,
  y: number,
): number {
  const { fonts, layout } = ctx;
  const { regular, bold } = fonts;
  const { margin, contentW } = layout;

  const COL_W    = contentW / 2;
  const ROW_H_MG = 18;
  const LABEL_SZ = 9;
  const VALUE_SZ = 9;

  // Pair rows into 2 columns
  for (let i = 0; i < rows.length; i += 2) {
    const leftRow  = rows[i];
    const rightRow = rows[i + 1];

    if (leftRow) {
      const lW = regular.widthOfTextAtSize(leftRow.label + " ", LABEL_SZ);
      page.drawText(leftRow.label, {
        x: margin, y, size: LABEL_SZ, font: regular, color: COLORS.darkGray,
      });
      page.drawText(leftRow.value, {
        x: margin + lW, y, size: VALUE_SZ, font: bold, color: COLORS.black,
      });
    }

    if (rightRow) {
      const lW = regular.widthOfTextAtSize(rightRow.label + " ", LABEL_SZ);
      page.drawText(rightRow.label, {
        x: margin + COL_W, y, size: LABEL_SZ, font: regular, color: COLORS.darkGray,
      });
      page.drawText(rightRow.value, {
        x: margin + COL_W + lW, y, size: VALUE_SZ, font: bold, color: COLORS.black,
      });
    }

    y -= ROW_H_MG;
  }

  return y - 8; // small gap after grid
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawLine  – single journal entry row; handles zero-value styling
// ─────────────────────────────────────────────────────────────────────────────

function drawLine(
  page: PDFPage,
  ctx: DrawContext,
  cols: Col[],
  line: JournalLine,
  y: number,
): void {
  const { fonts } = ctx;
  const { regular } = fonts;

  // Row separator
  drawHRule(page, ctx.layout.margin, y - ROW_H, ctx.layout.contentW, 0.5, COLORS.rowBorder);

  // Account name (col 0)
  const accountVal = truncate(line.account.name ?? "", regular, 9, cols[0].w - 8);
  page.drawText(accountVal, {
    x: cols[0].x + 4, y: y - ROW_H + 7, size: 9, font: regular, color: COLORS.bodyText,
  });

  // Description (col 1)
  const descVal = truncate(line.description || "-", regular, 9, cols[1].w - 8);
  page.drawText(descVal, {
    x: cols[1].x + 4, y: y - ROW_H + 7, size: 9, font: regular, color: COLORS.bodyText,
  });

  // Debit (col 2) – grey "0.00" when zero
  const debitStr   = formatAmount(line.debit);
  const debitColor = line.debit === 0 ? COLORS.midGray : COLORS.bodyText;
  const debitW     = regular.widthOfTextAtSize(debitStr, 9);
  page.drawText(debitStr, {
    x: cols[2].x + cols[2].w - debitW - 4, y: y - ROW_H + 7,
    size: 9, font: regular, color: debitColor,
  });

  // Credit (col 3) – grey "0.00" when zero
  const creditStr   = formatAmount(line.credit);
  const creditColor = line.credit === 0 ? COLORS.midGray : COLORS.bodyText;
  const creditW     = regular.widthOfTextAtSize(creditStr, 9);
  page.drawText(creditStr, {
    x: cols[3].x + cols[3].w - creditW - 4, y: y - ROW_H + 7,
    size: 9, font: regular, color: creditColor,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawTotalsRow
// ─────────────────────────────────────────────────────────────────────────────

function drawTotalsRow(
  page: PDFPage,
  ctx: DrawContext,
  cols: Col[],
  totalDebit: number,
  totalCredit: number,
  y: number,
): number {
  const { fonts, layout } = ctx;
  const { bold } = fonts;
  const { margin, contentW } = layout;

  drawHRule(page, margin, y, contentW, 1.8, COLORS.black);
  y -= ROW_H;

  page.drawText("Total", {
    x: margin + 4, y: y + 7, size: 9.5, font: bold, color: COLORS.black,
  });

  for (const [idx, val] of [[2, totalDebit], [3, totalCredit]] as [number, number][]) {
    const str = formatAmount(val);
    const w   = bold.widthOfTextAtSize(str, 9.5);
    page.drawText(str, {
      x: cols[idx].x + cols[idx].w - w - 4, y: y + 7,
      size: 9.5, font: bold, color: COLORS.black,
    });
  }

  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawBalanceBadge
// ─────────────────────────────────────────────────────────────────────────────

function drawBalanceBadge(
  page: PDFPage,
  ctx: DrawContext,
  isBalanced: boolean,
  y: number,
): void {
  const { fonts, layout } = ctx;
  const { bold } = fonts;
  const { margin } = layout;

  const text     = isBalanced ? "Voucher Balanced" : "Voucher Not Balanced";
  const bgColor  = isBalanced ? COLORS.greenBg  : COLORS.redBg;
  const bdrColor = isBalanced ? COLORS.greenBdr : COLORS.redBdr;
  const txColor  = isBalanced ? COLORS.green    : COLORS.red;

  const SIZE   = 9;
  const PAD_X  = 12;
  const PAD_Y  = 6;
  const DOT_R  = 3.5;
  const DOT_GAP = 8;

  const textW  = bold.widthOfTextAtSize(text, SIZE);
  const badgeW = DOT_R * 2 + DOT_GAP + textW + PAD_X * 2;
  const badgeH = SIZE + PAD_Y * 2;

  page.drawRectangle({
    x: margin, y: y - badgeH - 10,
    width: badgeW, height: badgeH,
    color: bgColor, borderColor: bdrColor, borderWidth: 1,
  });

  page.drawCircle({
    x: margin + PAD_X + DOT_R, y: y - badgeH / 2 - 10,
    size: DOT_R, color: txColor,
  });

  page.drawText(text, {
    x: margin + PAD_X + DOT_R * 2 + DOT_GAP,
    y: y - badgeH - 10 + PAD_Y,
    size: SIZE, font: bold, color: txColor,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawJVBody  (main export)
//
//  Renders:
//    1. Voucher title
//    2. Transaction meta grid (Voucher No / Date / Reference / Type)
//    3. Journal lines table with pagination
//    4. Totals row
//    5. Balance badge
//
//  Returns the last PDFPage so the caller can stamp drawFooter on it.
// ─────────────────────────────────────────────────────────────────────────────

export function drawJVBody(
  pdfDoc: PDFDocument,
  page: PDFPage,
  ctx: DrawContext,
  data: JournalVoucherData,
  startY: number,
): PDFPage {
  const { fonts, layout } = ctx;
  const { regular, bold } = fonts;
  const { margin, contentW } = layout;

  const currency = data.company.transactionCurrencyCode ?? "USD";
  const { txn }  = data;

  let y       = startY;
  let curPage = page;
  const cols  = buildCols(currency, contentW, margin);

  // ── 1. Voucher title ──────────────────────────────────────────────────
  const TITLE      = "JOURNAL VOUCHER";
  const TITLE_SIZE = 17;
  const titleW     = bold.widthOfTextAtSize(TITLE, TITLE_SIZE);

  curPage.drawText(TITLE, {
    x: margin + (contentW - titleW) / 2,
    y: y - TITLE_SIZE,
    size: TITLE_SIZE, font: bold, color: COLORS.black,
  });
  y -= TITLE_SIZE + 22;

  // ── 2. Transaction meta grid ──────────────────────────────────────────
  const metaRows = [
    { label: "Voucher No :",        value: `VN - ${txn.serialNumber}` },
    { label: "Transaction Date :",  value: formatDate(txn.transactionDate) },
    { label: "Reference :",         value: txn.reference || "-" },
    { label: "Transaction Type :",  value: txn.transactionType.name },
  ];

  y = drawMetaGrid(curPage, ctx, metaRows, y);
  y -= 6;

  // ── 3. Table header ───────────────────────────────────────────────────
  y = drawTableHeader(curPage, ctx, cols, y);

  // ── 4. Journal lines ──────────────────────────────────────────────────
  for (const line of txn.lines) {
    if (y - ROW_H < margin + FOOTER_SPACE) {
      drawFooter(curPage, ctx);
      curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
      y       = curPage.getHeight() - margin - 10;
      y       = drawTableHeader(curPage, ctx, cols, y);
    }

    drawLine(curPage, ctx, cols, line, y);
    y -= ROW_H;
  }

  // ── 5. Totals row ─────────────────────────────────────────────────────
  if (y - ROW_H < margin + FOOTER_SPACE) {
    drawFooter(curPage, ctx);
    curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
    y       = curPage.getHeight() - margin - 10;
    y       = drawTableHeader(curPage, ctx, cols, y);
  }

  y = drawTotalsRow(curPage, ctx, cols, txn.totalDebit, txn.totalCredit, y);

  // ── 6. Balance badge ──────────────────────────────────────────────────
  drawBalanceBadge(curPage, ctx, txn.isBalanced, y);

  return curPage;
}
