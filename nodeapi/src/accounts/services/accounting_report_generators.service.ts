import { Injectable } from "@nestjs/common";
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { User } from "src/auth/entities/user.entity";

@Injectable()
export class AccoutingReportGenerator {
    constructor() { }

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
        res: Response,
        user: User
    ) {

        const company = user.userRoles[0].customer;

        const logo = company.companyLogo;

        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
        });

        // --------------------------------------------------
        // RESPONSE HEADERS
        // --------------------------------------------------

        res.setHeader(
            'Content-Type',
            'application/pdf',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=trial-balance.pdf',
        );

        doc.pipe(res);


        // --------------------------------------------------
        // TITLE
        // --------------------------------------------------

        doc
            .fontSize(20)
            .font('Helvetica-Bold')
            .text(
                'Trial Balance Report',
                {
                    align: 'center',
                },
            );

        doc.moveDown(2);


        // --------------------------------------------------
        // TABLE CONFIG
        // --------------------------------------------------

        const startY = doc.y;

        const col1 = 40;
        const col2 = 110;
        const col3 = 300;
        const col4 = 390;
        const col5 = 490;

        const rowHeight = 22;


        // --------------------------------------------------
        // HEADER
        // --------------------------------------------------

        doc
            .fontSize(11)
            .font('Helvetica-Bold');

        doc.text(
            'Code',
            col1,
            startY,
        );

        doc.text(
            'Account Name',
            col2,
            startY,
        );

        doc.text(
            'Type',
            col3,
            startY,
        );

        doc.text(
            'Debit',
            col4,
            startY,
            {
                width: 80,
                align: 'right',
            },
        );

        doc.text(
            'Credit',
            col5,
            startY,
            {
                width: 60,
                align: 'right',
            },
        );


        // --------------------------------------------------
        // UNDERLINE HEADER
        // --------------------------------------------------

        doc.moveTo(40, startY + 18)
            .lineTo(560, startY + 18)
            .stroke();


        // --------------------------------------------------
        // ROWS
        // --------------------------------------------------

        let y = startY + 30;

        doc.font('Helvetica');

        data.forEach((item) => {

            doc.text(
                item.code,
                col1,
                y,
            );

            doc.text(
                item.name,
                col2,
                y,
                {
                    width: 170,
                },
            );

            doc.text(
                item.accountType,
                col3,
                y,
            );

            doc.text(
                Number(
                    item.total_debit,
                ).toFixed(2),
                col4,
                y,
                {
                    width: 80,
                    align: 'right',
                },
            );

            doc.text(
                Number(
                    item.total_credit,
                ).toFixed(2),
                col5,
                y,
                {
                    width: 60,
                    align: 'right',
                },
            );

            y += rowHeight;


            // ------------------------------------------
            // PAGE BREAK
            // ------------------------------------------

            if (y > 750) {

                doc.addPage();

                y = 50;
            }
        });


        // --------------------------------------------------
        // TOTALS
        // --------------------------------------------------

        const totalDebit =
            data.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.total_debit,
                    ),
                0,
            );

        const totalCredit =
            data.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.total_credit,
                    ),
                0,
            );

        y += 15;

        doc.moveTo(40, y)
            .lineTo(560, y)
            .stroke();

        y += 10;

        doc
            .font('Helvetica-Bold');

        doc.text(
            'TOTAL',
            col2,
            y,
        );

        doc.text(
            totalDebit.toFixed(2),
            col4,
            y,
            {
                width: 80,
                align: 'right',
            },
        );

        doc.text(
            totalCredit.toFixed(2),
            col5,
            y,
            {
                width: 60,
                align: 'right',
            },
        );


        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        y += 40;

        const balanced =
            totalDebit === totalCredit;

        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text(
                balanced
                    ? 'Trial Balance Matched'
                    : 'Trial Balance Not Matched',
                40,
                y,
            );

        doc.end();
    }

    async downloadBalanceSheetPdf(
        report: any,
        res: Response,
    ) {

        const doc =
            new PDFDocument({
                margin: 30,
                size: 'A4',
            });

        const items =
            report.items;

        const summary =
            report.summary;


        // --------------------------------------------------
        // RESPONSE HEADERS
        // --------------------------------------------------

        res.setHeader(
            'Content-Type',
            'application/pdf',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=balance-sheet.pdf',
        );

        doc.pipe(res);


        // --------------------------------------------------
        // TITLE
        // --------------------------------------------------

        doc
            .fontSize(20)
            .text(
                'Balance Sheet Report',
                {
                    align: 'center',
                },
            );

        doc.moveDown(2);


        // --------------------------------------------------
        // TABLE HEADER
        // --------------------------------------------------

        doc.fontSize(11);

        const startY = doc.y;

        doc.text('Code', 40, startY);
        doc.text('Name', 100, startY);
        doc.text('Type', 260, startY);
        doc.text('Debit', 340, startY);
        doc.text('Credit', 420, startY);
        doc.text('Balance', 500, startY);

        doc.moveDown();


        // --------------------------------------------------
        // TABLE ROWS
        // --------------------------------------------------

        items.forEach((item) => {

            const y = doc.y;

            doc.text(
                item.code,
                40,
                y,
            );

            doc.text(
                item.name,
                100,
                y,
                {
                    width: 140,
                },
            );

            doc.text(
                item.accountType,
                260,
                y,
            );

            doc.text(
                Number(
                    item.debit,
                ).toFixed(2),
                340,
                y,
            );

            doc.text(
                Number(
                    item.credit,
                ).toFixed(2),
                420,
                y,
            );

            doc.text(
                Number(
                    item.balance,
                ).toFixed(2),
                500,
                y,
            );

            doc.moveDown();
        });


        // --------------------------------------------------
        // SUMMARY
        // --------------------------------------------------

        doc.moveDown(2);

        doc
            .fontSize(13)
            .text(
                'Summary',
                {
                    underline: true,
                },
            );

        doc.moveDown();

        doc.text(
            `Total Assets: ${summary.totalAssets.toFixed(2)}`,
        );

        doc.text(
            `Total Liabilities: ${summary.totalLiabilities.toFixed(2)}`,
        );

        doc.text(
            `Total Equity: ${summary.totalEquity.toFixed(2)}`,
        );

        doc.text(
            `Total Liabilities + Equity: ${summary.totalLiabilitiesAndEquity.toFixed(2)}`,
        );


        doc.end();
    }

    async downloadProfitLossPdf(
        report: any,
        res: Response,
    ) {

        const doc =
            new PDFDocument({
                margin: 30,
                size: 'A4',
            });

        const items =
            report.items;

        const summary =
            report.summary;


        // --------------------------------------------------
        // RESPONSE HEADERS
        // --------------------------------------------------

        res.setHeader(
            'Content-Type',
            'application/pdf',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=profit-loss.pdf',
        );

        doc.pipe(res);


        // --------------------------------------------------
        // TITLE
        // --------------------------------------------------

        doc
            .fontSize(20)
            .text(
                'Profit & Loss Report',
                {
                    align: 'center',
                },
            );

        doc.moveDown(2);


        // --------------------------------------------------
        // TABLE HEADER
        // --------------------------------------------------

        doc.fontSize(11);

        const startY = doc.y;

        doc.text('Code', 40, startY);
        doc.text('Name', 100, startY);
        doc.text('Type', 260, startY);
        doc.text('Debit', 340, startY);
        doc.text('Credit', 420, startY);
        doc.text('Balance', 500, startY);

        doc.moveDown();


        // --------------------------------------------------
        // TABLE ROWS
        // --------------------------------------------------

        items.forEach((item) => {

            const y = doc.y;

            doc.text(
                item.code,
                40,
                y,
            );

            doc.text(
                item.name,
                100,
                y,
                {
                    width: 140,
                },
            );

            doc.text(
                item.accountType,
                260,
                y,
            );

            doc.text(
                Number(
                    item.debit,
                ).toFixed(2),
                340,
                y,
            );

            doc.text(
                Number(
                    item.credit,
                ).toFixed(2),
                420,
                y,
            );

            doc.text(
                Number(
                    item.balance,
                ).toFixed(2),
                500,
                y,
            );

            doc.moveDown();
        });


        // --------------------------------------------------
        // SUMMARY
        // --------------------------------------------------

        doc.moveDown(2);

        doc
            .fontSize(13)
            .text(
                'Summary',
                {
                    underline: true,
                },
            );

        doc.moveDown();

        doc.text(
            `Total Revenue: ${summary.totalRevenue.toFixed(2)}`,
        );

        doc.text(
            `Total Expense: ${summary.totalExpense.toFixed(2)}`,
        );

        doc.text(
            `Net Profit: ${summary.netProfit.toFixed(2)}`,
        );


        doc.end();
    }


}