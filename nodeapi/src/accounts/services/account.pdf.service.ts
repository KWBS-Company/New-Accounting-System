import { Injectable } from "@nestjs/common";
import { CommonService } from "src/common/utils/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawHeader } from "src/common/utils/pdf-generator/header";
import { drawBody } from "src/common/utils/pdf-generator/trial-balance-body";
import { drawFooter } from "src/common/utils/pdf-generator/footer";
import { DrawContext, Fonts, PageLayout } from "src/common/utils/pdf-generator/types";
import { BalanceSheetData, JournalVoucherData, ProfitLossData, TrialBalanceData } from "../types/pdf_data.types";
import { drawPLBody } from "src/common/utils/pdf-generator/pl-body";
import { drawJVBody } from "src/common/utils/pdf-generator/jv-body";
import { drawBSBody } from "src/common/utils/pdf-generator/balance-sheet-body";

@Injectable()
export class AccountPDFService {
    constructor(private readonly commonService: CommonService) { }

    async journalVoucherPdfGenerator(data: JournalVoucherData) {

        const pdfDoc = await PDFDocument.create();
        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const fonts: Fonts = { regular, bold, italic };

        const pageW = 595;
        const pageH = 842;
        const margin = 48;
        const layout: PageLayout = { pageW, pageH, margin, contentW: pageW - margin * 2 };
        const ctx: DrawContext = { fonts, layout };

        const firstPage = pdfDoc.addPage([pageW, pageH]);

        // HEADER
        const bodyStartY = await drawHeader(firstPage, ctx, {
            company: data.company,
            fiscalYear: data.fiscalYear,
        }, pdfDoc);

        // BODY
        const lastPage = drawJVBody(pdfDoc, firstPage, ctx, data, bodyStartY);

        // FOOTER
        drawFooter(lastPage, ctx);

        return await pdfDoc.save();
    }

    async trialBalancePdfGenerator(data: TrialBalanceData) {
        // ── 1. Create document + embed fonts ──────────────────────────────────
        const pdfDoc = await PDFDocument.create();
        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        const fonts: Fonts = { regular, bold, italic };

        // ── 2. Page layout constants (A4) ─────────────────────────────────────
        const pageW = 595;
        const pageH = 842;
        const margin = 48;

        const layout: PageLayout = {
            pageW,
            pageH,
            margin,
            contentW: pageW - margin * 2,
        };

        const ctx: DrawContext = { fonts, layout };

        // ── 3. First page ─────────────────────────────────────────────────────
        const firstPage = pdfDoc.addPage([pageW, pageH]);

        // ── 4. HEADER (first page only) ───────────────────────────────────────
        const bodyStartY = await drawHeader(firstPage, ctx, {
            company: data.company,
            fiscalYear: data.fiscalYear,
        },
            pdfDoc);

        // ── 5. BODY (may add extra pages internally) ──────────────────────────
        //      Returns the last page so we can stamp the footer on it.
        const lastPage = drawBody(pdfDoc, firstPage, ctx, data, bodyStartY);

        // ── 6. FOOTER (last page – overflow pages get their footer inside drawBody) ──
        drawFooter(lastPage, ctx);

        // ── 7. Serialise ──────────────────────────────────────────────────────
        const bytes = await pdfDoc.save();
        return bytes;
    }

    async balanceSheetPdfGenerator(data: BalanceSheetData) {
        const pdfDoc = await PDFDocument.create();
        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const fonts: Fonts = { regular, bold, italic };

        const pageW = 595;
        const pageH = 842;
        const margin = 48;
        const layout: PageLayout = { pageW, pageH, margin, contentW: pageW - margin * 2 };
        const ctx: DrawContext = { fonts, layout };

        const firstPage = pdfDoc.addPage([pageW, pageH]);

        const bodyStartY = await drawHeader(firstPage, ctx, {
            company: data.company,
            fiscalYear: data.fiscalYear,
        }, pdfDoc);

        const lastPage = drawBSBody(pdfDoc, firstPage, ctx, data, bodyStartY);

        drawFooter(lastPage, ctx);

        return await pdfDoc.save();

    }

    async profitAndLossPdfGenerator(data: ProfitLossData) {

        // 1. Document + fonts
        const pdfDoc = await PDFDocument.create();
        const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const fonts: Fonts = { regular, bold, italic };

        // 2. A4 layout
        const pageW = 595;
        const pageH = 842;
        const margin = 48;
        const layout: PageLayout = { pageW, pageH, margin, contentW: pageW - margin * 2 };
        const ctx: DrawContext = { fonts, layout };

        // 3. First page
        const firstPage = pdfDoc.addPage([pageW, pageH]);

        // 4. HEADER  (first page only)
        const bodyStartY = await drawHeader(firstPage, ctx, {
            company: data.company,
            fiscalYear: data.fiscalYear,
        }, pdfDoc);

        // 5. BODY  (may add overflow pages, returns last page)
        const lastPage = drawPLBody(pdfDoc, firstPage, ctx, data, bodyStartY);

        // 6. FOOTER on last page
        //    (overflow pages already get their footer stamped inside drawPLBody)
        drawFooter(lastPage, ctx);

        return await pdfDoc.save();
    }
}