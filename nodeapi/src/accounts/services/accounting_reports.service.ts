import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { PaginatedResponse } from 'src/common/dto/pagination.dto';
import { TransactionLine } from '../entities/transaction_lines.entity';
import { AccountReportQuery, ListAccountReportQuery } from '../dto/accounting_reports.dto';
import { Transaction } from '../entities/transactions.entity';
import { AccountType } from '../types/account_types.enum';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { TransactionType } from '../entities/transaction_types.entity';

@Injectable()
export class AccountReportService {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(Transaction)
        private readonly transactionRepository:
            Repository<Transaction>,   
        @InjectRepository(TransactionLine)
        private readonly transactionLineRepository:
                Repository<TransactionLine>,   
        @InjectRepository(TransactionType)
        private readonly transactionTypeRepository:
                        Repository<TransactionType>,   
        private readonly dataSource: DataSource,
    ) { }

    private async save(data: Partial<Account>): Promise<Account> {
        return this.accountRepository.save(data);
    }

    async listAllAccountsWithPagination(
        query: ListAccountReportQuery,
    ) {
    
        const page =
            query.page ?? 1;
    
        const pageSize =
            query.pageSize ?? 20;
    
        const qb =
            this.transactionRepository
                .createQueryBuilder('txn')
    
                .where(
                    'txn.deletedAt IS NULL',
                )
    
                .leftJoinAndSelect(
                    'txn.lines',
                    'lines',
                )
    
                .leftJoinAndSelect(
                    'lines.account',
                    'account',
                )
    
                .orderBy(
                    'txn.createdAt',
                    'DESC',
                );
    
    
        if (query.accountType) {
    
            qb.andWhere(
                'account.accountType = :accountType',
                {
                    accountType:
                        query.accountType,
                },
            );
        }
    
    
        if (query.search) {
    
            qb.andWhere(
                `
                (
                    account.code ILIKE :search
                    OR
                    account.name ILIKE :search
                )
                `,
                {
                    search:
                        `%${query.search}%`,
                },
            );
        }
    
    
        qb.skip(
            (page - 1) * pageSize,
        ).take(pageSize);
    
    
        const [data, total] =
            await qb.getManyAndCount();
    
        return new PaginatedResponse(
            data,
            total,
            page,
            pageSize,
        );
    }


    async generateTrialBalance(
        data: AccountReportQuery,
    ) {
    
        const {
            accountCode,
            accountType,
            transactionFrom,
            transactionTo,
        } = data;
    
        const qb = this.accountRepository
            .createQueryBuilder('a')
    
            .select([
                'a.id as id',
                'a.name as name',
                'a.code as code',
                'a.accountType as "accountType"',
    
                'COALESCE(SUM(tl.debit), 0) as total_debit',
    
                'COALESCE(SUM(tl.credit), 0) as total_credit',
            ])
    
            .innerJoin(
                'transaction_lines',
                'tl',
                'tl.account_id = a.id',
            )
    
            .innerJoin(
                'transactions',
                't',
                't.id = tl.transaction_id',
            )
    
            .where('a.deleted_at IS NULL')
            .andWhere('tl.deleted_at IS NULL')
            .andWhere('t.deleted_at IS NULL');
    
    
        // -----------------------------------------
        // FILTER: ACCOUNT CODE
        // -----------------------------------------
    
        if (accountCode) {
    
            qb.andWhere(
                'a.code ILIKE :accountCode',
                {
                    accountCode:
                        `%${accountCode}%`,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: ACCOUNT TYPE
        // -----------------------------------------
    
        if (accountType) {
    
            qb.andWhere(
                'a."accountType" = :accountType',
                {
                    accountType,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------
    
        if (transactionFrom) {
    
            qb.andWhere(
                't.transaction_date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------
    
        if (transactionTo) {
    
            qb.andWhere(
                't.transaction_date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }
    
    
        qb.groupBy('a.id')
            .addGroupBy('a.name')
            .addGroupBy('a.code')
            .addGroupBy('a."accountType"')
    
            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );
    
    
        return await qb.getRawMany();
    }

    async generateProfitAndLossReport(
        data: AccountReportQuery,
    ) {
    
        const {
            accountCode,
            transactionFrom,
            transactionTo,
        } = data;
    
        const qb = this.accountRepository
            .createQueryBuilder('a')
    
            .select([
                'a.id as id',
    
                'a.name as name',
    
                'a.code as code',
    
                'a.accountType as "accountType"',
    
                'COALESCE(SUM(tl.debit), 0) as debit',
    
                'COALESCE(SUM(tl.credit), 0) as credit',
            ])
    
            .innerJoin(
                'transaction_lines',
                'tl',
                'tl.account_id = a.id',
            )
    
            .innerJoin(
                'transactions',
                't',
                't.id = tl.transaction_id',
            )
    
            .where('a.deleted_at IS NULL')
    
            .andWhere('tl.deleted_at IS NULL')
    
            .andWhere('t.deleted_at IS NULL')
    
            .andWhere(
                `a."accountType" IN (
                    :...accountTypes
                )`,
                {
                    accountTypes: [
                        AccountType.REVENUE,
                        AccountType.EXPENSE,
                    ],
                },
            );
    
    
        // -----------------------------------------
        // FILTER: ACCOUNT CODE
        // -----------------------------------------
    
        if (accountCode) {
    
            qb.andWhere(
                'a.code ILIKE :accountCode',
                {
                    accountCode:
                        `%${accountCode}%`,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------
    
        if (transactionFrom) {
    
            qb.andWhere(
                't.transaction_date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------
    
        if (transactionTo) {
    
            qb.andWhere(
                't.transaction_date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }
    
    
        qb.groupBy('a.id')
    
            .addGroupBy('a.name')
    
            .addGroupBy('a.code')
    
            .addGroupBy('a."accountType"')
    
            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );
    
    
        const rows =
            await qb.getRawMany();
    
    
        // -----------------------------------------
        // CALCULATE BALANCE
        // -----------------------------------------
    
        const dataWithBalance =
            rows.map((row) => {
    
                let balance = 0;
    
                // -----------------------------
                // Revenue
                // credit - debit
                // -----------------------------
    
                if (
                    row.accountType ===
                    AccountType.REVENUE
                ) {
    
                    balance =
                        Number(row.credit)
                        -
                        Number(row.debit);
                }
    
                // -----------------------------
                // Expense
                // debit - credit
                // -----------------------------
    
                if (
                    row.accountType ===
                    AccountType.EXPENSE
                ) {
    
                    balance =
                        Number(row.debit)
                        -
                        Number(row.credit);
                }
    
                return {
                    ...row,
                    balance,
                };
            });
    
    
        // -----------------------------------------
        // TOTALS
        // -----------------------------------------
    
        const totalRevenue =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.REVENUE,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );
    
        const totalExpense =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.EXPENSE,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );
    
        const netProfit =
            totalRevenue - totalExpense;
    
    
        return {
            items: dataWithBalance,
    
            summary: {
                totalRevenue,
                totalExpense,
                netProfit,
            },
        };
    }

    async generateBalanceSheetReport(
        data: AccountReportQuery,
    ) {
    
        const {
            accountCode,
            transactionFrom,
            transactionTo,
        } = data;
    
        const qb = this.accountRepository
            .createQueryBuilder('a')
    
            .select([
                'a.id as id',
    
                'a.name as name',
    
                'a.code as code',
    
                'a.accountType as "accountType"',
    
                'COALESCE(SUM(tl.debit), 0) as debit',
    
                'COALESCE(SUM(tl.credit), 0) as credit',
            ])
    
            .innerJoin(
                'transaction_lines',
                'tl',
                'tl.account_id = a.id',
            )
    
            .innerJoin(
                'transactions',
                't',
                't.id = tl.transaction_id',
            )
    
            .where('a.deleted_at IS NULL')
    
            .andWhere('tl.deleted_at IS NULL')
    
            .andWhere('t.deleted_at IS NULL')
    
            .andWhere(
                `a."accountType" IN (
                    :...accountTypes
                )`,
                {
                    accountTypes: [
                        AccountType.ASSET,
                        AccountType.LIABILITY,
                        AccountType.EQUITY,
                    ],
                },
            );
    
    
        // -----------------------------------------
        // FILTER: ACCOUNT CODE
        // -----------------------------------------
    
        if (accountCode) {
    
            qb.andWhere(
                'a.code ILIKE :accountCode',
                {
                    accountCode:
                        `%${accountCode}%`,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------
    
        if (transactionFrom) {
    
            qb.andWhere(
                't.transaction_date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }
    
    
        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------
    
        if (transactionTo) {
    
            qb.andWhere(
                't.transaction_date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }
    
    
        qb.groupBy('a.id')
    
            .addGroupBy('a.name')
    
            .addGroupBy('a.code')
    
            .addGroupBy('a."accountType"')
    
            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );
    
    
        const rows =
            await qb.getRawMany();
    
    
        // -----------------------------------------
        // CALCULATE BALANCE
        // -----------------------------------------
    
        const dataWithBalance =
            rows.map((row) => {
    
                let balance = 0;
    
                // -----------------------------
                // Asset
                // debit - credit
                // -----------------------------
    
                if (
                    row.accountType ===
                    AccountType.ASSET
                ) {
    
                    balance =
                        Number(row.debit)
                        -
                        Number(row.credit);
                }
    
                // -----------------------------
                // Liability / Equity
                // credit - debit
                // -----------------------------
    
                if (
                    row.accountType ===
                        AccountType.LIABILITY
                    ||
                    row.accountType ===
                        AccountType.EQUITY
                ) {
    
                    balance =
                        Number(row.credit)
                        -
                        Number(row.debit);
                }
    
                return {
                    ...row,
                    balance,
                };
            });
    
    
        // -----------------------------------------
        // TOTALS
        // -----------------------------------------
    
        const totalAssets =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.ASSET,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );
    
        const totalLiabilities =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.LIABILITY,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );
    
        const totalEquity =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.EQUITY,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );
    
    
        return {
            items: dataWithBalance,
    
            summary: {
                totalAssets,
                totalLiabilities,
                totalEquity,
    
                totalLiabilitiesAndEquity:
                    totalLiabilities +
                    totalEquity,
            },
        };
    }


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



// ======================================================
// PDF DOWNLOAD
// ======================================================

async downloadTrialBalancePdf(
    data: any[],
    res: Response,
) {

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

async downloadJournalVoucher(
    transactionId: string,
    res: Response,
) {

    const txn =
        await this.transactionRepository.findOne({
            where: {
                id: transactionId,
                deletedAt: IsNull(),
            },

            relations: [
                'transactionType',
                'lines',
                'lines.account',
            ],
        });

    if (!txn) {
        throw new BadRequestException(
            'Transaction not found',
        );
    }

    const doc =
        new PDFDocument({
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
        `attachment; filename=journal-voucher-${txn.id}.pdf`,
    );

    doc.pipe(res);


    // --------------------------------------------------
    // TITLE
    // --------------------------------------------------

    doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(
            'JOURNAL VOUCHER',
            {
                align: 'center',
            },
        );

    doc.moveDown(2);


    // --------------------------------------------------
    // TRANSACTION DETAILS
    // --------------------------------------------------

    doc
        .fontSize(11)
        .font('Helvetica');

    doc.text(
        `Voucher No : ${txn.id}`,
    );

    doc.text(
        `Date : ${new Date(
            txn.transactionDate,
        ).toLocaleDateString()}`,
    );

    doc.text(
        `Reference : ${txn.reference || '-'}`,
    );

    doc.text(
        `Transaction Type : ${
            txn.transactionType?.name || '-'
        }`,
    );

    doc.moveDown(2);


    // --------------------------------------------------
    // TABLE HEADER
    // --------------------------------------------------

    const startY = doc.y;

    const col1 = 40;
    const col2 = 220;
    const col3 = 350;
    const col4 = 450;

    doc
        .font('Helvetica-Bold')
        .fontSize(11);

    doc.text(
        'Account',
        col1,
        startY,
    );

    doc.text(
        'Description',
        col2,
        startY,
    );

    doc.text(
        'Debit',
        col3,
        startY,
        {
            width: 80,
            align: 'right',
        },
    );

    doc.text(
        'Credit',
        col4,
        startY,
        {
            width: 80,
            align: 'right',
        },
    );

    // underline only
    doc.moveTo(
        40,
        startY + 18,
    )
        .lineTo(
            550,
            startY + 18,
        )
        .stroke();


    // --------------------------------------------------
    // TABLE ROWS
    // --------------------------------------------------

    let y = startY + 30;

    doc
        .font('Helvetica')
        .fontSize(10);

    txn.lines.forEach((line) => {

        doc.text(
            line.account.name,
            col1,
            y,
            {
                width: 160,
            },
        );

        doc.text(
            line.description || '-',
            col2,
            y,
            {
                width: 110,
            },
        );

        doc.text(
            Number(
                line.debit || 0,
            ).toFixed(2),
            col3,
            y,
            {
                width: 80,
                align: 'right',
            },
        );

        doc.text(
            Number(
                line.credit || 0,
            ).toFixed(2),
            col4,
            y,
            {
                width: 80,
                align: 'right',
            },
        );

        y += 26;


        // --------------------------------------------------
        // PAGE BREAK
        // --------------------------------------------------

        if (y > 760) {

            doc.addPage();

            y = 50;
        }
    });


    // --------------------------------------------------
    // TOTALS
    // --------------------------------------------------

    const totalDebit =
        txn.lines.reduce(
            (sum, line) =>
                sum + Number(line.debit),
            0,
        );

    const totalCredit =
        txn.lines.reduce(
            (sum, line) =>
                sum + Number(line.credit),
            0,
        );

    y += 10;

    doc.moveTo(40, y)
        .lineTo(550, y)
        .stroke();

    y += 10;

    doc
        .font('Helvetica-Bold')
        .fontSize(11);

    doc.text(
        'TOTAL',
        col1,
        y,
    );

    doc.text(
        totalDebit.toFixed(2),
        col3,
        y,
        {
            width: 80,
            align: 'right',
        },
    );

    doc.text(
        totalCredit.toFixed(2),
        col4,
        y,
        {
            width: 80,
            align: 'right',
        },
    );


    // --------------------------------------------------
    // BALANCE STATUS
    // --------------------------------------------------

    y += 40;

    doc
        .font('Helvetica')
        .fontSize(10);

    doc.text(
        totalDebit === totalCredit
            ? 'Voucher Balanced'
            : 'Voucher Not Balanced',
        40,
        y,
    );


    // --------------------------------------------------
    // SIGNATURES
    // --------------------------------------------------

    y += 70;

    doc
        .font('Helvetica')
        .fontSize(10);

    doc.text(
        'Prepared By',
        60,
        y,
    );

    doc.text(
        'Approved By',
        350,
        y,
    );


    // --------------------------------------------------
    // END DOCUMENT
    // --------------------------------------------------

    doc.end();
}


async downloadTransactionTemplate(
    res: Response,
) {

    // --------------------------------------------------
    // FETCH FROM DATABASE
    // --------------------------------------------------

    const accounts =
        await this.accountRepository.find({
            where: {
                deletedAt: IsNull(),
            },
            order: {
                name: 'ASC',
            },
        });

    const transactionTypes =
        await this.transactionTypeRepository.find({
            where: {
                deletedAt: IsNull(),
            },
            order: {
                name: 'ASC',
            },
        });


    // --------------------------------------------------
    // WORKBOOK
    // --------------------------------------------------

    const workbook =
        new ExcelJS.Workbook();

    const worksheet =
        workbook.addWorksheet(
            'Transactions',
        );

    const dropdownSheet =
        workbook.addWorksheet(
            'DropdownData',
        );

    // hide dropdown sheet
    dropdownSheet.state = 'hidden';


    // --------------------------------------------------
    // ADD DROPDOWN DATA
    // --------------------------------------------------

    accounts.forEach(
        (account, index) => {

            dropdownSheet.getCell(
                `A${index + 1}`,
            ).value = account.name;
        },
    );

    transactionTypes.forEach(
        (txnType, index) => {

            dropdownSheet.getCell(
                `B${index + 1}`,
            ).value =
                txnType.transactionType;
        },
    );


    // --------------------------------------------------
    // MAIN SHEET COLUMNS
    // --------------------------------------------------

    worksheet.columns = [
        {
            header: 'SN',
            key: 'sn',
            width: 10,
        },
        {
            header: 'Account Name',
            key: 'accountName',
            width: 35,
        },
        {
            header: 'Amount',
            key: 'amount',
            width: 20,
        },
        {
            header: 'Transaction Type',
            key: 'transactionType',
            width: 35,
        },
        {
            header: 'Transaction Date',
            key: 'transactionDate',
            width: 35,
        },
        {
            header: 'Reference',
            key: 'reference',
            width: 30,
        },
        {
            header: 'Description',
            key: 'description',
            width: 30,
        },
    ];


    // --------------------------------------------------
    // HEADER STYLE
    // --------------------------------------------------

    worksheet.getRow(1).font = {
        bold: true,
    };

    worksheet.getRow(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
    };


    // --------------------------------------------------
    // SERIAL NUMBERS
    // --------------------------------------------------

    for (let i = 2; i <= 200; i++) {

        worksheet.getCell(`A${i}`).value =
            i - 1;
    }


    // --------------------------------------------------
    // ACCOUNT NAME DROPDOWN
    // --------------------------------------------------

    for (let i = 2; i <= 200; i++) {

        worksheet.getCell(`B${i}`)
            .dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [
                    `=DropdownData!$A$1:$A$${accounts.length}`,
                ],
            };
    }


    // --------------------------------------------------
    // TRANSACTION TYPE DROPDOWN
    // --------------------------------------------------

    for (let i = 2; i <= 200; i++) {

        worksheet.getCell(`D${i}`)
            .dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [
                    `=DropdownData!$B$1:$B$${transactionTypes.length}`,
                ],
            };
    }


    // --------------------------------------------------
    // RESPONSE HEADERS
    // --------------------------------------------------

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
        'Content-Disposition',
        'attachment; filename=transaction-template.xlsx',
    );


    // --------------------------------------------------
    // DOWNLOAD
    // --------------------------------------------------

    await workbook.xlsx.write(res);

    res.end();
}
    
}
