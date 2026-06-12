import { Injectable } from "@nestjs/common";
import { CommonService } from "src/common/utils/common";
import { Transaction } from "../entities/transactions.entity";
import { User } from "src/auth/entities/user.entity";
import { AccountType } from "../types/account_types.enum";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawHeader } from "src/common/utils/pdf-generator/header";
import { drawBody } from "src/common/utils/pdf-generator/trial-balance-body";
import { drawFooter } from "src/common/utils/pdf-generator/footer";
import { DrawContext, Fonts, PageLayout } from "src/common/utils/pdf-generator/types";
import { ProfitLossData, TrialBalanceData } from "../types/account_report.types";
import { drawPLBody } from "src/common/utils/pdf-generator/pl-body";

@Injectable()
export class AccountPDFService {
    constructor(private readonly commonService: CommonService) { }

    async journalVoucherPdfGenerator(txnData: Transaction, backendUrl: string, user: User) {

        const totalDebit = txnData.lines.reduce((s, l) => s + Number(l.debit), 0);
        const totalCredit = txnData.lines.reduce((s, l) => s + Number(l.credit), 0);
        const company = user.userRoles[0].customer;
        const context = {
            backendUrl: backendUrl,
            company: {
                ...user.userRoles[0].customer,   // name, companyLogo, vatNumber, panNumber,
                // fiscalStartDate, fiscalEndDate,
                // transactionCurrencyCode
                phone: company.companyPhone,
                email: company.companyEmail,
                website: company.companyWebsite,
                address: company.companyAddress,
            },
            txn: {
                ...txnData,
                totalDebit,
                totalCredit,
                isBalanced: totalDebit === totalCredit,
            },
        };
        const html = await this.commonService.generateTemplate(
            'journal-voucher.hbs',
            context,
        );
        const pdfBuffer = await this.commonService.pdfGenerateByHtml(html);
        return pdfBuffer;
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

    async balanceSheetPdfGenerator(bs: {
        items: any[];
        summary: {
            totalAssets: number;
            totalLiabilities: number;
            totalEquity: number;
            totalLiabilitiesAndEquity: number;
        };
    }, backendUrl: string, user: User) {
        const company = user.userRoles[0].customer;
        const equities = bs.items.filter(it => it.accountType === AccountType.EQUITY);
        const assets = bs.items.filter(it => it.accountType === AccountType.ASSET);
        const liabilities = bs.items.filter(it => it.accountType === AccountType.LIABILITY);
        const context = {
            company: {
                name: company.companyName,
                companyLogo: company.companyLogo ? `${backendUrl}${company.companyLogo}` : null,
                phone: company.companyPhone,
                email: company.companyEmail,
                website: company.companyWebsite,
                address: company.companyAddress,
                panNumber: company.panNumber,
                vatNumber: company.vatNumber,
                transactionCurrencyCode: company.transactionCurrencyCode

            },
            fiscalYear: {
                start: new Date(company.fiscalStartDate).toLocaleDateString(),
                end: new Date(company.fiscalEndDate).toLocaleDateString()
            },
            reportDate: new Date().toLocaleDateString(),
            asOf: new Date().toLocaleDateString(),
            equity: equities,
            liabilities,
            assets,
            summary: bs.summary,
            currency: company.transactionCurrencyCode,
            isMatched: bs.summary.totalAssets === bs.summary.totalLiabilitiesAndEquity
        }

        const html = await this.commonService.generateTemplate(
            'balance-sheet.hbs',
            context,
        );
        const pdfBuffer = await this.commonService.pdfGenerateByHtml(html);
        return pdfBuffer;

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