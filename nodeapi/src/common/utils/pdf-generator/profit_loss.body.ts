import { type PDFDocument, type PDFPage } from 'pdf-lib';
import { COLORS, truncate, drawHRule } from './utils';
import { drawFooter } from './footer';
import type { DrawContext, PLColDef } from './types';
import {
    PLLineItem,
    ProfitLossPDFData,
} from 'src/accounts/types/profit_loss.types';
// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROW_H = 22; // data row height
const TH_H = 22; // table-header row height
const FOOTER_SPACE = 110; // px reserved at bottom for footer

// ─────────────────────────────────────────────────────────────────────────────
//  formatAmount  – converts a number to a locale string with 2 decimal places
// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  buildPLColumns  – resolve fractional widths → pixel positions
//  Layout mirrors the HTML: code(14%) | name(56%) | type(14%) | amount(16%)
// ─────────────────────────────────────────────────────────────────────────────

function buildPLColumns(
    sectionLabel: string, // "Revenue" or "Expenses"
    currency: string,
    contentW: number,
    marginX: number,
): PLColDef[] {
    const defs: Omit<PLColDef, 'w' | 'x'>[] = [
        {
            label: sectionLabel,
            key: 'code',
            widthFraction: 0.14,
            align: 'left',
        },
        { label: '', key: 'name', widthFraction: 0.56, align: 'left' },
        { label: '', key: 'accountType', widthFraction: 0.14, align: 'left' },
        {
            label: `Amount (${currency})`,
            key: 'balance',
            widthFraction: 0.16,
            align: 'right',
        },
    ];

    let x = marginX;
    return defs.map((d) => {
        const w = d.widthFraction * contentW;
        const col: PLColDef = { ...d, w, x };
        x += w;
        return col;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawSectionHeader  – bold top/bottom-bordered heading row
//  Returns Y below the bottom border.
// ─────────────────────────────────────────────────────────────────────────────

function drawSectionHeader(
    page: PDFPage,
    ctx: DrawContext,
    cols: PLColDef[],
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { bold } = fonts;
    const { margin, contentW } = layout;
    const LABEL_SIZE = 8;

    drawHRule(page, margin, y, contentW, 1.8, COLORS.black);

    // Section label (left-aligned, spanning first 3 cols)
    page.drawText(cols[0].label, {
        x: margin + 4,
        y: y - TH_H + 7,
        size: LABEL_SIZE,
        font: bold,
        color: COLORS.black,
    });

    // Amount header (right-aligned in last col)
    const amtCol = cols[3];
    const amtW = bold.widthOfTextAtSize(amtCol.label, LABEL_SIZE);
    page.drawText(amtCol.label, {
        x: amtCol.x + amtCol.w - amtW - 4,
        y: y - TH_H + 7,
        size: LABEL_SIZE,
        font: bold,
        color: COLORS.black,
    });

    drawHRule(page, margin, y - TH_H, contentW, 1.8, COLORS.black);
    return y - TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawLineItems  – renders rows for one section (revenues or expenses)
//  Handles mid-table page breaks.
//  Returns { page, y } after last row.
// ─────────────────────────────────────────────────────────────────────────────

function drawLineItems(
    pdfDoc: PDFDocument,
    page: PDFPage,
    ctx: DrawContext,
    cols: PLColDef[],
    items: PLLineItem[],
    y: number,
    sectionLabel: string,
    currency: string,
): { page: PDFPage; y: number } {
    const { fonts, layout } = ctx;
    const { regular } = fonts;
    const { margin, contentW } = layout;

    if (items.length === 0) {
        // Empty-state row
        const msg = `No ${sectionLabel.toLowerCase()} recorded.`;
        page.drawText(msg, {
            x: margin + 4,
            y: y - ROW_H + 7,
            size: 9,
            font: regular,
            color: COLORS.midGray,
        });
        return { page, y: y - ROW_H };
    }

    for (const item of items) {
        // Page break?
        if (y - ROW_H < layout.margin + FOOTER_SPACE) {
            drawFooter(page, ctx);
            page = pdfDoc.addPage([layout.pageW, layout.pageH]);
            y = page.getHeight() - layout.margin - 10;
            // Re-draw section header on new page
            const newCols = buildPLColumns(
                sectionLabel,
                currency,
                contentW,
                margin,
            );
            y = drawSectionHeader(page, ctx, newCols, y);
        }

        // Row separator
        drawHRule(page, margin, y - ROW_H, contentW, 0.5, COLORS.rowBorder);

        // code  (col 0 — muted, smaller)
        const codeVal = truncate(item.code ?? '', regular, 8.5, cols[0].w - 6);
        page.drawText(codeVal, {
            x: cols[0].x + 4,
            y: y - ROW_H + 7,
            size: 8.5,
            font: regular,
            color: COLORS.darkGray,
        });

        // name (col 1)
        const nameVal = truncate(item.name ?? '', regular, 9, cols[1].w - 8);
        page.drawText(nameVal, {
            x: cols[1].x + 4,
            y: y - ROW_H + 7,
            size: 9,
            font: regular,
            color: COLORS.bodyText,
        });

        // accountType (col 2)
        const typeVal = truncate(
            item.accountType ?? '',
            regular,
            9,
            cols[2].w - 8,
        );
        page.drawText(typeVal, {
            x: cols[2].x + 4,
            y: y - ROW_H + 7,
            size: 9,
            font: regular,
            color: COLORS.bodyText,
        });

        // amount (col 3 – right-aligned)
        const amtStr = formatAmount(item.balance);
        const amtW = regular.widthOfTextAtSize(amtStr, 9);
        page.drawText(amtStr, {
            x: cols[3].x + cols[3].w - amtW - 4,
            y: y - ROW_H + 7,
            size: 9,
            font: regular,
            color: COLORS.bodyText,
        });

        y -= ROW_H;
    }

    return { page, y };
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawSubtotalRow  – bold "Total Revenue / Total Expenses" row with top border
// ─────────────────────────────────────────────────────────────────────────────

function drawSubtotalRow(
    page: PDFPage,
    ctx: DrawContext,
    label: string,
    amount: number,
    cols: PLColDef[],
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { bold } = fonts;
    const { margin, contentW } = layout;

    drawHRule(page, margin, y, contentW, 1.5, COLORS.black);
    y -= ROW_H;

    page.drawText(label, {
        x: margin + 4,
        y: y + 7,
        size: 9.5,
        font: bold,
        color: COLORS.black,
    });

    const amtStr = formatAmount(amount);
    const amtCol = cols[3];
    const amtW = bold.widthOfTextAtSize(amtStr, 9.5);
    page.drawText(amtStr, {
        x: amtCol.x + amtCol.w - amtW - 4,
        y: y + 7,
        size: 9.5,
        font: bold,
        color: COLORS.black,
    });

    return y; // caller adds gap before next section
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawSummaryTable  – Total Revenue / Total Expenses / Net Profit(Loss)
// ─────────────────────────────────────────────────────────────────────────────

function drawSummaryTable(
    page: PDFPage,
    ctx: DrawContext,
    data: ProfitLossPDFData,
    y: number,
): number {
    const { fonts, layout } = ctx;
    const { regular, bold } = fonts;
    const { margin, contentW } = layout;

    // Right column x
    const RIGHT_X = margin + contentW;

    // Helper – draw one summary row
    function summaryRow(
        label: string,
        value: string,
        isBold: boolean,
        valueColor: import('pdf-lib').Color,
        rowY: number,
    ): number {
        drawHRule(page, margin, rowY - ROW_H, contentW, 0.5, COLORS.rowBorder);

        const font = isBold ? bold : regular;
        page.drawText(label, {
            x: margin + 4,
            y: rowY - ROW_H + 7,
            size: 9.5,
            font,
            color: isBold ? COLORS.black : COLORS.bodyText,
        });

        const vW = font.widthOfTextAtSize(value, 9.5);
        page.drawText(value, {
            x: RIGHT_X - vW - 4,
            y: rowY - ROW_H + 7,
            size: 9.5,
            font,
            color: valueColor,
        });

        return rowY - ROW_H;
    }

    // ── Total Revenue ──
    y = summaryRow(
        'Total Revenue',
        formatAmount(data.summary.totalRevenue),
        false,
        COLORS.bodyText,
        y,
    );

    // ── Total Expenses ──
    y = summaryRow(
        'Total Expenses',
        formatAmount(data.summary.totalExpense),
        false,
        COLORS.bodyText,
        y,
    );

    // ── Net Profit / Loss (double-bordered) ──
    const netLabel = data.isProfit ? 'Net Profit' : 'Net Loss';
    const netRaw = formatAmount(data.summary.netProfitAbs);
    const netValue = data.isProfit ? netRaw : `(${netRaw})`;
    const netColor = data.isProfit ? COLORS.green : COLORS.red;

    drawHRule(page, margin, y, contentW, 2.0, COLORS.black); // top double-ish
    y -= ROW_H;
    drawHRule(page, margin, y, contentW, 2.0, COLORS.black); // bottom

    page.drawText(netLabel, {
        x: margin + 4,
        y: y + 7,
        size: 9.5,
        font: bold,
        color: COLORS.black,
    });

    const nvW = bold.widthOfTextAtSize(netValue, 9.5);
    page.drawText(netValue, {
        x: RIGHT_X - nvW - 4,
        y: y + 7,
        size: 9.5,
        font: bold,
        color: netColor,
    });

    return y;
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawStatusBadge  – "Net Profit" / "Net Loss" pill
// ─────────────────────────────────────────────────────────────────────────────

function drawStatusBadge(
    page: PDFPage,
    ctx: DrawContext,
    isProfit: boolean,
    y: number,
): void {
    const { fonts, layout } = ctx;
    const { bold } = fonts;
    const { margin } = layout;

    const text = isProfit ? 'Net Profit' : 'Net Loss';
    const bgColor = isProfit ? COLORS.greenBg : COLORS.redBg;
    const bdrColor = isProfit ? COLORS.greenBdr : COLORS.redBdr;
    const txColor = isProfit ? COLORS.green : COLORS.red;

    const TEXT_SIZE = 9;
    const PAD_X = 12;
    const PAD_Y = 6;
    const DOT_R = 3.5;
    const DOT_GAP = 8;

    const textW = bold.widthOfTextAtSize(text, TEXT_SIZE);
    const badgeW = DOT_R * 2 + DOT_GAP + textW + PAD_X * 2;
    const badgeH = TEXT_SIZE + PAD_Y * 2;

    page.drawRectangle({
        x: margin,
        y: y - badgeH - 10,
        width: badgeW,
        height: badgeH,
        color: bgColor,
        borderColor: bdrColor,
        borderWidth: 1,
    });

    page.drawCircle({
        x: margin + PAD_X + DOT_R,
        y: y - badgeH / 2 - 10,
        size: DOT_R,
        color: txColor,
    });

    page.drawText(text, {
        x: margin + PAD_X + DOT_R * 2 + DOT_GAP,
        y: y - badgeH - 10 + PAD_Y,
        size: TEXT_SIZE,
        font: bold,
        color: txColor,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  drawPLBody  (main export)
//
//  Renders:
//    1. Report title + meta row
//    2. Revenue table  (section header → line items → subtotal)
//    3. Expenses table (section header → line items → subtotal)
//    4. Summary table  (Total Revenue / Total Expenses / Net Profit-Loss)
//    5. Status badge
//
//  Parameters:
//    pdfDoc   – needed to add overflow pages
//    page     – first content page (header already drawn)
//    ctx      – shared DrawContext (fonts + layout)
//    data     – ProfitLossData
//    startY   – Y returned by drawHeader()
//
//  Returns the last PDFPage so the caller can stamp drawFooter on it.
// ─────────────────────────────────────────────────────────────────────────────

export function drawPLBody(
    pdfDoc: PDFDocument,
    page: PDFPage,
    ctx: DrawContext,
    data: ProfitLossPDFData,
    startY: number,
): PDFPage {
    const { fonts, layout } = ctx;
    const { regular, bold } = fonts;
    const { margin, contentW } = layout;

    const currency = data.currency ?? 'USD';
    let y = startY;
    let curPage = page;

    // ── 1. Report title ───────────────────────────────────────────────────
    const TITLE = 'PROFIT & LOSS';
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

    // ── 2. Meta row ───────────────────────────────────────────────────────
    const META_SIZE = 9.5;
    const metaLeft = `Report Date: ${data.reportDate}`;
    const metaRight = `As of: ${data.asOf}`;

    curPage.drawText(metaLeft, {
        x: margin,
        y,
        size: META_SIZE,
        font: regular,
        color: COLORS.darkGray,
    });
    const mrW = regular.widthOfTextAtSize(metaRight, META_SIZE);
    curPage.drawText(metaRight, {
        x: margin + contentW - mrW,
        y,
        size: META_SIZE,
        font: regular,
        color: COLORS.darkGray,
    });
    y -= 22;

    // ── 3. Revenue section ────────────────────────────────────────────────
    const revCols = buildPLColumns('Revenue', currency, contentW, margin);
    y = drawSectionHeader(curPage, ctx, revCols, y);

    const revResult = drawLineItems(
        pdfDoc,
        curPage,
        ctx,
        revCols,
        data.revenues,
        y,
        'Revenue',
        currency,
    );
    curPage = revResult.page;
    y = revResult.y;

    y = drawSubtotalRow(
        curPage,
        ctx,
        'Total Revenue',
        data.summary.totalRevenue,
        revCols,
        y,
    );
    y -= 24; // gap before expenses

    // ── 4. Expenses section ───────────────────────────────────────────────
    // Page break before expenses if not enough room for header + at least 2 rows
    if (y - (TH_H + ROW_H * 2) < layout.margin + FOOTER_SPACE) {
        drawFooter(curPage, ctx);
        curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
        y = curPage.getHeight() - layout.margin - 10;
    }

    const expCols = buildPLColumns('Expenses', currency, contentW, margin);
    y = drawSectionHeader(curPage, ctx, expCols, y);

    const expResult = drawLineItems(
        pdfDoc,
        curPage,
        ctx,
        expCols,
        data.expenses,
        y,
        'Expenses',
        currency,
    );
    curPage = expResult.page;
    y = expResult.y;

    y = drawSubtotalRow(
        curPage,
        ctx,
        'Total Expenses',
        data.summary.totalExpense,
        expCols,
        y,
    );
    y -= 28; // gap before summary

    // ── 5. Summary table ──────────────────────────────────────────────────
    // Needs ~3 rows + badge — break page if too tight
    const SUMMARY_NEEDED = ROW_H * 3 + 60;
    if (y - SUMMARY_NEEDED < layout.margin + FOOTER_SPACE) {
        drawFooter(curPage, ctx);
        curPage = pdfDoc.addPage([layout.pageW, layout.pageH]);
        y = curPage.getHeight() - layout.margin - 10;
    }

    y = drawSummaryTable(curPage, ctx, data, y);

    // ── 6. Status badge ───────────────────────────────────────────────────
    drawStatusBadge(curPage, ctx, data.isProfit, y);

    return curPage; // caller stamps drawFooter on this page
}
