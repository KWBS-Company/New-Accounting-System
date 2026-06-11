import { Injectable } from "@nestjs/common";
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { User } from "src/auth/entities/user.entity";
import { AccountPDFService } from "./account.pdf.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AccoutingReportGenerator {
    constructor(private readonly accountPdfService: AccountPDFService,
        private readonly configService: ConfigService
    ) { }

    // ======================================================
    // EXCEL DOWNLOAD
    // ======================================================

    async downloadTrialBalanceExcel(
        data: any[],
        res: Response,
    ) {

        const workbook =
            new ExcelJS.Workbook();

        const worksheet =
            workbook.addWorksheet(
                'Trial Balance',
            );


        // --------------------------------------------------
        // HEADERS
        // --------------------------------------------------

        worksheet.columns = [
            {
                header: 'Code',
                key: 'code',
                width: 20,
            },
            {
                header: 'Account Name',
                key: 'name',
                width: 35,
            },
            {
                header: 'Account Type',
                key: 'accountType',
                width: 20,
            },
            {
                header: 'Debit',
                key: 'total_debit',
                width: 20,
            },
            {
                header: 'Credit',
                key: 'total_credit',
                width: 20,
            },
        ];


        // --------------------------------------------------
        // ROWS
        // --------------------------------------------------

        data.forEach((item) => {

            worksheet.addRow({
                code: item.code,
                name: item.name,
                accountType:
                    item.accountType,
                total_debit:
                    item.total_debit,
                total_credit:
                    item.total_credit,
            });
        });


        // --------------------------------------------------
        // HEADER STYLE
        // --------------------------------------------------

        worksheet.getRow(1).font = {
            bold: true,
        };


        // --------------------------------------------------
        // RESPONSE HEADERS
        // --------------------------------------------------

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=trial-balance.xlsx',
        );


        await workbook.xlsx.write(res);

        res.end();
    }

    async downloadProfitLossExcel(
        report: any,
        res: Response,
    ) {

        const workbook =
            new ExcelJS.Workbook();

        const worksheet =
            workbook.addWorksheet(
                'Profit & Loss',
            );

        const items =
            report.items;

        const summary =
            report.summary;


        // --------------------------------------------------
        // TITLE
        // --------------------------------------------------

        worksheet.mergeCells('A1:F1');

        worksheet.getCell('A1').value =
            'Profit & Loss Report';

        worksheet.getCell('A1').font = {
            bold: true,
            size: 16,
        };


        // --------------------------------------------------
        // HEADERS
        // --------------------------------------------------

        worksheet.columns = [
            {
                header: 'Code',
                key: 'code',
                width: 20,
            },
            {
                header: 'Account Name',
                key: 'name',
                width: 35,
            },
            {
                header: 'Account Type',
                key: 'accountType',
                width: 20,
            },
            {
                header: 'Debit',
                key: 'debit',
                width: 20,
            },
            {
                header: 'Credit',
                key: 'credit',
                width: 20,
            },
            {
                header: 'Balance',
                key: 'balance',
                width: 20,
            },
        ];

        worksheet.getRow(2).values = [
            'Code',
            'Account Name',
            'Account Type',
            'Debit',
            'Credit',
            'Balance',
        ];

        worksheet.getRow(2).font = {
            bold: true,
        };


        // --------------------------------------------------
        // DATA ROWS
        // --------------------------------------------------

        items.forEach((item) => {

            worksheet.addRow({
                code: item.code,
                name: item.name,
                accountType:
                    item.accountType,
                debit: item.debit,
                credit: item.credit,
                balance: item.balance,
            });
        });


        // --------------------------------------------------
        // SUMMARY
        // --------------------------------------------------

        worksheet.addRow([]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Revenue',
            summary.totalRevenue,
        ]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Expense',
            summary.totalExpense,
        ]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Net Profit',
            summary.netProfit,
        ]);


        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=profit-loss.xlsx',
        );

        await workbook.xlsx.write(res);

        res.end();
    }

    async downloadBalanceSheetExcel(
        report: any,
        res: Response,
    ) {

        const workbook =
            new ExcelJS.Workbook();

        const worksheet =
            workbook.addWorksheet(
                'Balance Sheet',
            );

        const items =
            report.items;

        const summary =
            report.summary;


        // --------------------------------------------------
        // TITLE
        // --------------------------------------------------

        worksheet.mergeCells('A1:F1');

        worksheet.getCell('A1').value =
            'Balance Sheet Report';

        worksheet.getCell('A1').font = {
            bold: true,
            size: 16,
        };


        // --------------------------------------------------
        // HEADERS
        // --------------------------------------------------

        worksheet.columns = [
            {
                header: 'Code',
                key: 'code',
                width: 20,
            },
            {
                header: 'Account Name',
                key: 'name',
                width: 35,
            },
            {
                header: 'Account Type',
                key: 'accountType',
                width: 20,
            },
            {
                header: 'Debit',
                key: 'debit',
                width: 20,
            },
            {
                header: 'Credit',
                key: 'credit',
                width: 20,
            },
            {
                header: 'Balance',
                key: 'balance',
                width: 20,
            },
        ];

        worksheet.getRow(2).values = [
            'Code',
            'Account Name',
            'Account Type',
            'Debit',
            'Credit',
            'Balance',
        ];

        worksheet.getRow(2).font = {
            bold: true,
        };


        // --------------------------------------------------
        // DATA ROWS
        // --------------------------------------------------

        items.forEach((item) => {

            worksheet.addRow({
                code: item.code,
                name: item.name,
                accountType:
                    item.accountType,
                debit: item.debit,
                credit: item.credit,
                balance: item.balance,
            });
        });


        // --------------------------------------------------
        // SUMMARY
        // --------------------------------------------------

        worksheet.addRow([]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Assets',
            summary.totalAssets,
        ]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Liabilities',
            summary.totalLiabilities,
        ]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Equity',
            summary.totalEquity,
        ]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Liabilities + Equity',
            summary.totalLiabilitiesAndEquity,
        ]);


        // --------------------------------------------------
        // RESPONSE
        // --------------------------------------------------

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=balance-sheet.xlsx',
        );

        await workbook.xlsx.write(res);

        res.end();
    }



    // ======================================================
    // PDF DOWNLOAD
    // ======================================================

    async downloadTrialBalancePdf(
        data: any[],
        user: User
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');

        const buf = await this.accountPdfService.trialBalancePdfGenerator(data, backendUrl, user);

        return buf;

    }

    async downloadBalanceSheetPdf(
        report: {
            items: any[];
            summary: {
                totalAssets: number;
                totalLiabilities: number;
                totalEquity: number;
                totalLiabilitiesAndEquity: number;
            };
        },
        user: User
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');

        const buf = await this.accountPdfService.balanceSheetPdfGenerator(report, backendUrl, user);

        return buf;
    }

    async downloadProfitLossPdf(
        report: {
            items: any[];
            summary: {
                totalRevenue: any;
                totalExpense: any;
                netProfit: number;
            };
        },
        user: User,
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');

        const buf = await this.accountPdfService.profitAndLossPdfGenerator(report, backendUrl, user);

        return buf;

    }


}