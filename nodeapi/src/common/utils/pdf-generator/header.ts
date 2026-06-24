import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import { COLORS, truncate, drawHRule, embedImageFromUrl } from './utils';
import type { DrawContext } from './types';
import {
    CompanyInfo,
    FiscalYear,
} from 'src/accounts/types/account_company.types';

// ─────────────────────────────────────────────────────────────────────────────
//  drawHeader
//
//  Renders on the given page:
//    • Logo box (or embedded PDFImage if company.logoImage is provided)
//    • Contact rows: phone, email, website, address
//    • Right side: company name (bold, large) + VAT / PAN / fiscal year
//    • Horizontal divider
//
//  Returns the Y coordinate immediately below the divider so the caller
//  knows where to continue drawing body content.
// ─────────────────────────────────────────────────────────────────────────────

export interface HeaderData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
}

export async function drawHeader(
    page: PDFPage,
    ctx: DrawContext,
    data: HeaderData,
    pdfDoc: PDFDocument,
) {
    const { fonts, layout } = ctx;
    const { regular, bold } = fonts;
    const { margin, contentW } = layout;
    const { company, fiscalYear } = data;

    const y = page.getHeight() - margin;

    // ── Logo area ───────────────────────────────────────────────────────────
    const LOGO_SIZE = 64;

    if (company.logoImage) {
        const logo = await embedImageFromUrl(pdfDoc, company.logoImage);
        // Caller pre-embedded the image via pdfDoc.embedPng / embedJpg
        if (logo) {
            page.drawImage(logo, {
                x: margin,
                y: y - LOGO_SIZE,
                width: LOGO_SIZE,
                height: LOGO_SIZE,
            });
        } else {
            // Dashed placeholder box
            page.drawRectangle({
                x: margin,
                y: y - LOGO_SIZE,
                width: LOGO_SIZE,
                height: LOGO_SIZE,
                color: rgb(0.94, 0.95, 0.96),
                borderColor: COLORS.lightGray,
                borderWidth: 1,
                borderDashArray: [3, 3],
            });

            const noLogoLabel = 'No Logo';
            const nlW = regular.widthOfTextAtSize(noLogoLabel, 8);
            page.drawText(noLogoLabel, {
                x: margin + (LOGO_SIZE - nlW) / 2,
                y: y - LOGO_SIZE / 2 - 4,
                size: 8,
                font: regular,
                color: COLORS.midGray,
            });
        }
    } else {
        // Dashed placeholder box
        page.drawRectangle({
            x: margin,
            y: y - LOGO_SIZE,
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            color: rgb(0.94, 0.95, 0.96),
            borderColor: COLORS.lightGray,
            borderWidth: 1,
            borderDashArray: [3, 3],
        });

        const noLogoLabel = 'No Logo';
        const nlW = regular.widthOfTextAtSize(noLogoLabel, 8);
        page.drawText(noLogoLabel, {
            x: margin + (LOGO_SIZE - nlW) / 2,
            y: y - LOGO_SIZE / 2 - 4,
            size: 8,
            font: regular,
            color: COLORS.midGray,
        });
    }

    // ── Contact rows (below logo) ───────────────────────────────────────────
    const contactLines: string[] = [
        company.phone ? `P: ${company.phone}` : '',
        company.email ? `E: ${company.email}` : '',
        company.website ? `W: ${company.website}` : '',
        company.address ? `A: ${company.address}` : '',
    ].filter(Boolean);

    const CONTACT_LINE_H = 13;
    const CONTACT_MAX_W = LOGO_SIZE + 100; // contacts stay in the left column
    let cy = y - LOGO_SIZE - 10;

    for (const line of contactLines) {
        page.drawText(truncate(line, regular, 8.5, CONTACT_MAX_W), {
            x: margin,
            y: cy,
            size: 8.5,
            font: regular,
            color: COLORS.darkGray,
        });
        cy -= CONTACT_LINE_H;
    }

    // ── Right side: company name ────────────────────────────────────────────
    const companyName = company.name ?? 'Company Name';
    const NAME_SIZE = 16;
    const nameW = bold.widthOfTextAtSize(companyName, NAME_SIZE);

    page.drawText(companyName, {
        x: margin + contentW - nameW,
        y: y - NAME_SIZE,
        size: NAME_SIZE,
        font: bold,
        color: COLORS.black,
    });

    // ── Right side: meta lines (VAT, PAN, fiscal year) ──────────────────────
    const META_SIZE = 9;
    const metaLines: string[] = [
        company.vatNumber ? `VAT No: ${company.vatNumber}` : '',
        company.panNumber ? `PAN No: ${company.panNumber}` : '',
        fiscalYear?.start
            ? `Fiscal Year: ${fiscalYear.start} – ${fiscalYear.end}`
            : '',
    ].filter(Boolean);

    let my = y - NAME_SIZE - 16;

    for (const ml of metaLines) {
        const mlW = regular.widthOfTextAtSize(ml, META_SIZE);
        page.drawText(ml, {
            x: margin + contentW - mlW,
            y: my,
            size: META_SIZE,
            font: regular,
            color: COLORS.darkGray,
        });
        my -= CONTACT_LINE_H;
    }

    // ── Divider ─────────────────────────────────────────────────────────────
    // Place it below whichever column (left or right) is taller
    const leftBottom = cy - 8;
    const rightBottom = my - 8;
    const dividerY = Math.min(leftBottom, rightBottom);

    drawHRule(page, margin, dividerY, contentW, 1.2, COLORS.lightGray);

    return dividerY - 14; // Y available for body content
}
