import { type PDFPage, type PDFDocument } from "pdf-lib";
import { COLORS, truncate, drawHRule } from "./utils.js";
import { drawFooter } from "./footer.js";
import type { DrawContext, ColDef } from "./types";
import { TrialBalanceData } from "src/accounts/types/account_report.types.js";

// ─────────────────────────────────────────────────────────────────────────────
//  buildColumns – resolve fractional widths into pixel positions
// ─────────────────────────────────────────────────────────────────────────────

export function buildColumns(currency: string, contentW: number, marginX: number): ColDef[] {
  const defs: Omit<ColDef, "w" | "x">[] = [
    { label: "Code",                key: "code",        widthFraction: 0.13, align: "left"  },
    { label: "Account Name",        key: "name",        widthFraction: 0.32, align: "left"  },
    { label: "Type",                key: "accountType", widthFraction: 0.18, align: "left"  },
    { label: `Debit (${currency})`, key: "debit",       widthFraction: 0.18, align: "right" },
    { label: `Credit (${currency})`,key: "credit",      widthFraction: 0.19, align: "right" },
  ];

  let x = marginX;
  return defs.map((d) => {
    const w = d.widthFraction * contentW;
    const col: ColDef = { ...d, w, x };
    x += w;
    return col;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawTableHeader – column labels with top/bottom border
// ─────────────────────────────────────────────────────────────────────────────

const TH_H = 22; // table-header row height

function drawTableHeader(
  page: PDFPage,
  ctx: DrawContext,
  cols: ColDef[],
  y: number,
): number {
  const { fonts, layout } = ctx;
  const { bold } = fonts;
  const { margin, contentW } = layout;

  drawHRule(page, margin, y, contentW, 1.8, COLORS.black);

  for (const col of cols) {
    const lSize = 8;
    const lW    = bold.widthOfTextAtSize(col.label, lSize);
    const tx    = col.align === "right" ? col.x + col.w - lW - 4 : col.x + 4;

    page.drawText(col.label, {
      x:    tx,
      y:    y - TH_H + 7,
      size: lSize,
      font:  bold,
      color: COLORS.black,
    });
  }

  drawHRule(page, margin, y - TH_H, contentW, 1.8, COLORS.black);
  return y - TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawBadge – "Trial Balance Matched / Not Matched"
// ─────────────────────────────────────────────────────────────────────────────

function drawBadge(
  page: PDFPage,
  ctx: DrawContext,
  isMatched: boolean,
  y: number,
): void {
  const { fonts, layout } = ctx;
  const { bold } = fonts;
  const { margin } = layout;

  const text     = isMatched ? "Trial Balance Matched" : "Trial Balance Not Matched";
  const bgColor  = isMatched ? COLORS.greenBg  : COLORS.redBg;
  const bdrColor = isMatched ? COLORS.greenBdr : COLORS.redBdr;
  const txColor  = isMatched ? COLORS.green    : COLORS.red;

  const TEXT_SIZE = 9;
  const PAD_X     = 12;
  const PAD_Y     = 6;
  const DOT_R     = 3.5;
  const DOT_GAP   = 8;

  const textW  = bold.widthOfTextAtSize(text, TEXT_SIZE);
  const badgeW = DOT_R * 2 + DOT_GAP + textW + PAD_X * 2;
  const badgeH = TEXT_SIZE + PAD_Y * 2;

  page.drawRectangle({
    x:           margin,
    y:           y - badgeH,
    width:       badgeW,
    height:      badgeH,
    color:       bgColor,
    borderColor: bdrColor,
    borderWidth: 1,
  });

  page.drawCircle({
    x:    margin + PAD_X + DOT_R,
    y:    y - badgeH / 2,
    size: DOT_R,
    color: txColor,
  });

  page.drawText(text, {
    x:    margin + PAD_X + DOT_R * 2 + DOT_GAP,
    y:    y - badgeH + PAD_Y,
    size: TEXT_SIZE,
    font:  bold,
    color: txColor,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawBody
//
//  Renders:
//    • Report title (centered)
//    • Report Date / As Of meta row
//    • Account table rows with automatic page-break pagination
//    • Totals row
//    • Matched / Unmatched badge
//
//  Parameters
//    pdfDoc  – needed to add overflow pages
//    page    – the first content page (already has header drawn)
//    ctx     – shared fonts + layout
//    data    – full TrialBalanceData
//    startY  – Y returned by drawHeader()
//
//  Returns the last PDFPage so the caller can draw the footer on it.
// ─────────────────────────────────────────────────────────────────────────────

const ROW_H        = 22;
const FOOTER_SPACE = 110; // reserved at page bottom for footer + badge

export function drawBody(
  pdfDoc: PDFDocument,
  page: PDFPage,
  ctx: DrawContext,
  data: TrialBalanceData,
  startY: number,
): PDFPage {
  const { fonts, layout } = ctx;
  const { regular, bold } = fonts;
  const { margin, contentW, pageW, pageH } = layout;

  const currency = data.currency ?? "USD";
  const cols     = buildColumns(currency, contentW, margin);

  let currentPage = page;
  let y           = startY;

  // Helper: add a continuation page (no decorative header, just table)
  function addOverflowPage(): PDFPage {
    const p = pdfDoc.addPage([pageW, pageH]);
    y = p.getHeight() - margin - 10;
    y = drawTableHeader(p, ctx, cols, y);
    return p;
  }

  // ── Report title ──────────────────────────────────────────────────────
  const TITLE      = "TRIAL BALANCE";
  const TITLE_SIZE = 17;
  const titleW     = bold.widthOfTextAtSize(TITLE, TITLE_SIZE);

  currentPage.drawText(TITLE, {
    x:    margin + (contentW - titleW) / 2,
    y:    y - TITLE_SIZE,
    size: TITLE_SIZE,
    font:  bold,
    color: COLORS.black,
  });
  y -= TITLE_SIZE + 20;

  // ── Meta row ──────────────────────────────────────────────────────────
  const META_SIZE = 9.5;
  const metaLeft  = `Report Date: ${data.reportDate}`;
  const metaRight = `As of: ${data.asOf}`;

  currentPage.drawText(metaLeft, {
    x: margin, y, size: META_SIZE, font: regular, color: COLORS.darkGray,
  });

  const mrW = regular.widthOfTextAtSize(metaRight, META_SIZE);
  currentPage.drawText(metaRight, {
    x: margin + contentW - mrW, y, size: META_SIZE, font: regular, color: COLORS.darkGray,
  });
  y -= 20;

  // ── Table header ─────────────────────────────────────────────────────
  y = drawTableHeader(currentPage, ctx, cols, y);

  // ── Account rows ─────────────────────────────────────────────────────
  for (const acct of data.accounts) {
    // Page break check
    if (y - ROW_H < margin + FOOTER_SPACE) {
      drawFooter(currentPage, ctx);
      currentPage = addOverflowPage();
    }

    // Row separator
    drawHRule(currentPage, margin, y - ROW_H, contentW, 0.5, COLORS.rowBorder);

    // Cell values
    const rowData: Record<string, string> = {
      code:        acct.code        ?? "",
      name:        acct.name        ?? "",
      accountType: acct.accountType ?? "",
      debit:       acct.debit       ?? "",
      credit:      acct.credit      ?? "",
    };

    for (const col of cols) {
      const raw = rowData[col.key as string] ?? "";
      const val = truncate(raw, regular, 9, col.w - 8);
      const tw  = regular.widthOfTextAtSize(val, 9);
      const tx  = col.align === "right" ? col.x + col.w - tw - 4 : col.x + 4;

      currentPage.drawText(val, {
        x: tx, y: y - ROW_H + 7, size: 9, font: regular, color: COLORS.bodyText,
      });
    }

    y -= ROW_H;
  }

  // ── Totals row ────────────────────────────────────────────────────────
  if (y - ROW_H < margin + FOOTER_SPACE) {
    drawFooter(currentPage, ctx);
    currentPage = addOverflowPage();
  }

  drawHRule(currentPage, margin, y, contentW, 1.8, COLORS.black);
  y -= ROW_H;

  currentPage.drawText("Total", {
    x: margin + 4, y: y + 7, size: 9.5, font: bold, color: COLORS.black,
  });

  for (const key of ["debit", "credit"] as const) {
    const col = cols.find((c) => c.key === key)!;
    const val = data.totals[key] ?? "0.00";
    const tw  = bold.widthOfTextAtSize(val, 9.5);
    currentPage.drawText(val, {
      x: col.x + col.w - tw - 4, y: y + 7, size: 9.5, font: bold, color: COLORS.black,
    });
  }

  // ── Balance badge ─────────────────────────────────────────────────────
  y -= 24;
  drawBadge(currentPage, ctx, data.isMatched, y);

  return currentPage; // caller draws footer on this page
}
