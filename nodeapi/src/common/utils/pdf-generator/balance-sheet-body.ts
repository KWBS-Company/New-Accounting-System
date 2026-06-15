import { type PDFDocument, type PDFPage } from "pdf-lib";
import { COLORS, truncate, drawHRule } from "./utils";
import { drawFooter } from "./footer";
import type { DrawContext } from "./types";
import { BalanceSheetData, BSLineItem } from "src/accounts/types/pdf_data.types";
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
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Column layout  – code(14%) | name(56%) | type(14%) | balance(16%)
// ─────────────────────────────────────────────────────────────────────────────

interface Col { label: string; w: number; x: number; align: "left" | "right" }

function buildCols(sectionLabel: string, currency: string, contentW: number, marginX: number): Col[] {
  const specs: [string, number, "left" | "right"][] = [
    [sectionLabel, 0.14, "left"],
    ["", 0.56, "left"],
    ["", 0.14, "left"],
    [`Balance (${currency})`, 0.16, "right"],
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
//  drawSectionHeader  – bold top/bottom-bordered heading row
// ─────────────────────────────────────────────────────────────────────────────

function drawSectionHeader(
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

  // Section label spans first 3 cols
  page.drawText(cols[0].label, {
    x: margin + 4, y: y - TH_H + 7, size: SIZE, font: bold, color: COLORS.black,
  });

  // Balance header right-aligned in last col
  const amtCol = cols[3];
  const amtW = bold.widthOfTextAtSize(amtCol.label, SIZE);
  page.drawText(amtCol.label, {
    x: amtCol.x + amtCol.w - amtW - 4, y: y - TH_H + 7, size: SIZE, font: bold, color: COLORS.black,
  });

  drawHRule(page, margin, y - TH_H, contentW, 1.8, COLORS.black);
  return y - TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawLineItems  – rows for one section with page-break pagination
// ─────────────────────────────────────────────────────────────────────────────

function drawLineItems(
  pdfDoc: PDFDocument,
  page: PDFPage,
  ctx: DrawContext,
  cols: Col[],
  items: BSLineItem[],
  y: number,
  sectionLabel: string,
  currency: string,
): { page: PDFPage; y: number } {
  const { fonts, layout } = ctx;
  const { regular } = fonts;
  const { margin, contentW } = layout;

  if (items.length === 0) {
    page.drawText(`No ${sectionLabel.toLowerCase()} recorded.`, {
      x: margin + 4, y: y - ROW_H + 7, size: 9, font: regular, color: COLORS.midGray,
    });
    return { page, y: y - ROW_H };
  }

  for (const item of items) {
    if (y - ROW_H < layout.margin + FOOTER_SPACE) {
      drawFooter(page, ctx);
      page = pdfDoc.addPage([layout.pageW, layout.pageH]);
      y = page.getHeight() - layout.margin - 10;
      const newCols = buildCols(sectionLabel, currency, contentW, margin);
      y = drawSectionHeader(page, ctx, newCols, y);
    }

    drawHRule(page, margin, y - ROW_H, contentW, 0.5, COLORS.rowBorder);

    // code – muted
    page.drawText(truncate(item.code ?? "", regular, 8.5, cols[0].w - 6), {
      x: cols[0].x + 4, y: y - ROW_H + 7, size: 8.5, font: regular, color: COLORS.darkGray,
    });

    // name
    page.drawText(truncate(item.name ?? "", regular, 9, cols[1].w - 8), {
      x: cols[1].x + 4, y: y - ROW_H + 7, size: 9, font: regular, color: COLORS.bodyText,
    });

    // accountType
    page.drawText(truncate(item.accountType ?? "", regular, 9, cols[2].w - 8), {
      x: cols[2].x + 4, y: y - ROW_H + 7, size: 9, font: regular, color: COLORS.bodyText,
    });

    // balance – right-aligned
    const amtStr = formatAmount(item.balance);
    const amtW = regular.widthOfTextAtSize(amtStr, 9);
    page.drawText(amtStr, {
      x: cols[3].x + cols[3].w - amtW - 4, y: y - ROW_H + 7,
      size: 9, font: regular, color: COLORS.bodyText,
    });

    y -= ROW_H;
  }

  return { page, y };
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawSubtotalRow  – bold "Total X" row with top border
// ─────────────────────────────────────────────────────────────────────────────

function drawSubtotalRow(
  page: PDFPage,
  ctx: DrawContext,
  cols: Col[],
  label: string,
  amount: number,
  y: number,
): number {
  const { fonts, layout } = ctx;
  const { bold } = fonts;
  const { margin, contentW } = layout;

  drawHRule(page, margin, y, contentW, 1.5, COLORS.black);
  y -= ROW_H;

  page.drawText(label, {
    x: margin + 4, y: y + 7, size: 9.5, font: bold, color: COLORS.black,
  });

  const amtStr = formatAmount(amount);
  const amtCol = cols[3];
  const amtW = bold.widthOfTextAtSize(amtStr, 9.5);
  page.drawText(amtStr, {
    x: amtCol.x + amtCol.w - amtW - 4, y: y + 7, size: 9.5, font: bold, color: COLORS.black,
  });

  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawSummaryTable  – Liabilities / Equity / Total L&E
// ─────────────────────────────────────────────────────────────────────────────

function drawSummaryTable(
  page: PDFPage,
  ctx: DrawContext,
  data: BalanceSheetData,
  y: number,
): number {
  const { fonts, layout } = ctx;
  const { regular, bold } = fonts;
  const { margin, contentW } = layout;

  const RIGHT_X = margin + contentW;
  const ROW_SIZE = 9.5;

  function summaryRow(label: string, value: string, isBold: boolean, rowY: number): number {
    drawHRule(page, margin, rowY - ROW_H, contentW, 0.5, COLORS.rowBorder);
    const font = isBold ? bold : regular;
    page.drawText(label, {
      x: margin + 4, y: rowY - ROW_H + 7,
      size: ROW_SIZE, font, color: isBold ? COLORS.black : COLORS.bodyText,
    });
    const vW = font.widthOfTextAtSize(value, ROW_SIZE);
    page.drawText(value, {
      x: RIGHT_X - vW - 4, y: rowY - ROW_H + 7,
      size: ROW_SIZE, font, color: isBold ? COLORS.black : COLORS.bodyText,
    });
    return rowY - ROW_H;
  }

  y = summaryRow("Total Liabilities", formatAmount(data.summary.totalLiabilities), false, y);
  y = summaryRow("Total Equity", formatAmount(data.summary.totalEquity), false, y);

  // Grand total – double border
  drawHRule(page, margin, y, contentW, 2.0, COLORS.black);
  y -= ROW_H;
  drawHRule(page, margin, y, contentW, 2.0, COLORS.black);

  const grandLabel = "Total Liabilities & Equity";
  const grandValue = formatAmount(data.summary.totalLiabilitiesAndEquity);
  page.drawText(grandLabel, {
    x: margin + 4, y: y + 7, size: ROW_SIZE, font: bold, color: COLORS.black,
  });
  const gvW = bold.widthOfTextAtSize(grandValue, ROW_SIZE);
  page.drawText(grandValue, {
    x: RIGHT_X - gvW - 4, y: y + 7, size: ROW_SIZE, font: bold, color: COLORS.black,
  });

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

  const text = isBalanced ? "Balance Sheet Balanced" : "Balance Sheet Not Balanced";
  const bgColor = isBalanced ? COLORS.greenBg : COLORS.redBg;
  const bdrColor = isBalanced ? COLORS.greenBdr : COLORS.redBdr;
  const txColor = isBalanced ? COLORS.green : COLORS.red;

  const SIZE = 9;
  const PAD_X = 12;
  const PAD_Y = 6;
  const DOT_R = 3.5;
  const DOT_GAP = 8;

  const textW = bold.widthOfTextAtSize(text, SIZE);
  const badgeW = DOT_R * 2 + DOT_GAP + textW + PAD_X * 2;
  const badgeH = SIZE + PAD_Y * 2;

  page.drawRectangle({
    x: margin, y: y - badgeH - 10,
    width: badgeW, height: badgeH,
    color: bgColor, borderColor: bdrColor, borderWidth: 1,
  });
  page.drawCircle({
    x: margin + PAD_X + DOT_R, y: y - badgeH / 2 - 10, size: DOT_R, color: txColor,
  });
  page.drawText(text, {
    x: margin + PAD_X + DOT_R * 2 + DOT_GAP,
    y: y - badgeH - 10 + PAD_Y,
    size: SIZE, font: bold, color: txColor,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawBSBody  (main export)
//
//  Renders:
//    1. Report title + meta row
//    2. Assets section   (header → rows → subtotal)
//    3. Liabilities section (header → rows → subtotal)
//    4. Equity section   (header → rows → subtotal)
//    5. Summary table    (Liabilities / Equity / Grand Total)
//    6. Balance badge
//
//  Returns the last PDFPage for the caller to stamp drawFooter on.
// ─────────────────────────────────────────────────────────────────────────────

export function drawBSBody(
  pdfDoc: PDFDocument,
  page: PDFPage,
  ctx: DrawContext,
  data: BalanceSheetData,
  startY: number,
): PDFPage {
  const { fonts, layout } = ctx;
  const { regular, bold } = fonts;
  const { margin, contentW } = layout;

  const currency = data.currency ?? "USD";
  let y = startY;
  let curPage = page;

  // ── 1. Title ──────────────────────────────────────────────────────────
  const TITLE = "BALANCE SHEET";
  const TITLE_SIZE = 17;
  const titleW = bold.widthOfTextAtSize(TITLE, TITLE_SIZE);
  curPage.drawText(TITLE, {
    x: margin + (contentW - titleW) / 2, y: y - TITLE_SIZE,
    size: TITLE_SIZE, font: bold, color: COLORS.black,
  });
  y -= TITLE_SIZE + 20;

  // ── 2. Meta row ───────────────────────────────────────────────────────
  const META_SIZE = 9.5;
  curPage.drawText(`Report Date: ${data.reportDate}`, {
    x: margin, y, size: META_SIZE, font: regular, color: COLORS.darkGray,
  });
  const metaRight = `As of: ${data.asOf}`;
  const mrW = regular.widthOfTextAtSize(metaRight, META_SIZE);
  curPage.drawText(metaRight, {
    x: margin + contentW - mrW, y, size: META_SIZE, font: regular, color: COLORS.darkGray,
  });
  y -= 22;

  // ── Helper: draw one full section ─────────────────────────────────────
  function drawSection(
    items: BSLineItem[],
    sectionLabel: string,
    subtotalLabel: string,
    subtotalAmount: number,
  ): void {
    // Page break if not enough room for header + at least 2 rows
    if (y - (TH_H + ROW_H * 2) < layout.margin + FOOTER_SPACE) {
      drawFooter(curPage, ctx);
      curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
      y = curPage.getHeight() - layout.margin - 10;
    }

    const cols = buildCols(sectionLabel, currency, contentW, margin);
    y = drawSectionHeader(curPage, ctx, cols, y);

    const result = drawLineItems(pdfDoc, curPage, ctx, cols, items, y, sectionLabel, currency);
    curPage = result.page;
    y = result.y;

    y = drawSubtotalRow(curPage, ctx, cols, subtotalLabel, subtotalAmount, y);
    y -= 24; // gap between sections
  }

  // ── 3. Assets ─────────────────────────────────────────────────────────
  drawSection(data.assets, "Assets", "Total Assets", data.summary.totalAssets);

  // ── 4. Liabilities ────────────────────────────────────────────────────
  drawSection(data.liabilities, "Liabilities", "Total Liabilities", data.summary.totalLiabilities);

  // ── 5. Equity ─────────────────────────────────────────────────────────
  drawSection(data.equity, "Equity", "Total Equity", data.summary.totalEquity);

  drawSection([], "Profit", `${data.summary.currentYearNetPL > 0 ? 'Current Year Net Profit' : 'Current Year Net Loss'}`, data.summary.currentYearNetPL);

  // ── 6. Summary table ──────────────────────────────────────────────────
  const SUMMARY_NEEDED = ROW_H * 3 + 60;
  if (y - SUMMARY_NEEDED < layout.margin + FOOTER_SPACE) {
    drawFooter(curPage, ctx);
    curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
    y = curPage.getHeight() - layout.margin - 10;
  }

  y = drawSummaryTable(curPage, ctx, data, y);

  // ── 7. Badge ──────────────────────────────────────────────────────────
  drawBalanceBadge(curPage, ctx, data.isBalanced, y);

  return curPage;
}