import { BadRequestException, Injectable } from "@nestjs/common";
import { CommonService } from "src/common/utils/common";
import { CellValue, Workbook } from 'exceljs';
import { TransactionType } from "../entities/transaction_types.entity";
import { AccountType } from "../types/account_types.enum";

@Injectable()
export class AccountExcelService {
    constructor(private readonly commonService: CommonService) {
    }

    async generateTransactionTemplate(transactionTypes: TransactionType[]) {
        const workbook = new Workbook();

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

        transactionTypes.forEach(
            (txnType, index) => {

                dropdownSheet.getCell(
                    `A${index + 1}`,
                ).value =
                    txnType.transactionType;
            },
        );

        // Ensure we always have at least one row so data-validation ranges are valid.
        // Excel will warn/recover if the range ends at row 0 (e.g. $A$1:$A$0).
        const safeTxnTypesLen = Math.max(transactionTypes.length, 1);
        if (transactionTypes.length === 0) {
            dropdownSheet.getCell('A1').value = '';
        }


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
                header: 'Transaction Type',
                key: 'transactionType',
                width: 35,
            },
            {
                header: 'Amount',
                key: 'amount',
                width: 20,
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
        // TRANSACTION TYPE DROPDOWN
        // --------------------------------------------------

        for (let i = 2; i <= 200; i++) {

            worksheet.getCell(`B${i}`)
                .dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [
                    `=DropdownData!$A$1:$A$${safeTxnTypesLen}`,
                ],
            };
        }

        const buf = await workbook.xlsx.writeBuffer();
        return buf;
    }

    private getCellString(cellValue: CellValue) {
        if (cellValue == null) {
            return '';
        }
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return String(cellValue).trim();
    }

    async getTransactionTemplateData(file: Express.Multer.File) {
        const workbook = new Workbook();

        await workbook.xlsx.load(file.buffer.buffer as ArrayBuffer);

        const worksheet =
            workbook.getWorksheet(
                'Transactions',
            );

        if (!worksheet) {
            throw new BadRequestException(
                'Transactions sheet not found',
            );
        }


        // ------------------------------------------
        // LOOP ROWS
        // ------------------------------------------
        const excelData: { amount: number, transactionTypeName: string, transactionDate: string, reference: string, description: string }[] = [];
        for (
            let rowNumber = 2;
            rowNumber <= worksheet.rowCount;
            rowNumber++
        ) {

            const row = worksheet.getRow(rowNumber);
            const transactionTypeName = this.getCellString(row.getCell(2).value);
            const amountValue = row.getCell(3).value;
            const amount = typeof amountValue === 'number' ? amountValue : Number(amountValue ?? 0);
            const transactionDate = this.getCellString(row.getCell(4).value);
            const reference = this.getCellString(row.getCell(5).value);
            const description = this.getCellString(row.getCell(6).value);

            // --------------------------------------
            // VALIDATION
            // --------------------------------------

            if (
                !amount &&
                !transactionTypeName
            ) {
                continue;
            }

            if (!amount) {
                throw new BadRequestException(
                    `Amount missing at row ${rowNumber}`,
                );
            }

            if (!transactionDate) {
                throw new BadRequestException(
                    `Transaction date at row ${rowNumber}`,
                );
            }

            if (!transactionTypeName) {
                throw new BadRequestException(
                    `Transaction Type missing at row ${rowNumber}`,
                );
            }

            excelData.push({ amount, transactionTypeName, transactionDate, reference, description })

        }

        return excelData;
    }

    async generateTBExcelBuffer(trialBalance: {
        items: {
            balance: number;
            id: string;
            name: string;
            code: string;
            accountType: AccountType;
            debit: number;
            credit: number;
        }[];
        summary: {
            totalCredit: number;
            totalDebit: number;
        };
    }) {
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Trial Balance');
        const summary = trialBalance.summary;
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

        trialBalance.items.forEach((item) => {

            worksheet.addRow({
                code: item.code,
                name: item.name,
                accountType:
                    item.accountType,
                total_debit:
                    item.debit,
                total_credit:
                    item.credit,
            });
        });

        // summary
        worksheet.addRow([]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Debit',
            summary.totalDebit,
        ]);

        worksheet.addRow([
            '',
            '',
            '',
            '',
            'Total Credit',
            summary.totalCredit,
        ]);

        worksheet.getRow(1).font = {
            bold: true,
        };

        const buffer = await workbook.xlsx.writeBuffer();

        return buffer;

    }

    async generatePLExcelBuffer(pl: {
        items: {
            balance: number;
            id: string;
            name: string;
            code: string;
            accountType: AccountType;
            debit: number;
            credit: number;
        }[];
        summary: {
            totalRevenue: number;
            totalExpense: number;
            netProfit: number;
        };
    }) {
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Profit & Loss');
        const items = pl.items;
        const summary = pl.summary;

        worksheet.mergeCells('A1:F1');

        worksheet.getCell('A1').value = 'Profit & Loss Report';

        worksheet.getCell('A1').font = {
            bold: true,
            size: 16,
        };

        // header
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

        items.forEach((item) => {
            worksheet.addRow({
                code: item.code,
                name: item.name,
                accountType: item.accountType,
                debit: item.debit,
                credit: item.credit,
                balance: item.balance,
            });
        });
        // summary
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

        const buffer = await workbook.xlsx.writeBuffer();

        return buffer;
    }

    async generateBSExcelBuffer(bs: {
        items: {
            balance: number;
            id: string;
            name: string;
            code: string;
            accountType: AccountType;
            debit: number;
            credit: number;
        }[];
        summary: {
            totalAssets: number;
            totalLiabilities: number;
            totalEquity: number;
            totalLiabilitiesAndEquity: number;
        };
    }) {
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Balance Sheet');
        const items = bs.items;
        const summary = bs.summary;

        // title
        worksheet.mergeCells('A1:F1');

        worksheet.getCell('A1').value = 'Balance Sheet Report';

        worksheet.getCell('A1').font = {
            bold: true,
            size: 16,
        };
        // header
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

        // data
        items.forEach((item) => {
            worksheet.addRow({
                code: item.code,
                name: item.name,
                accountType: item.accountType,
                debit: item.debit,
                credit: item.credit,
                balance: item.balance,
            });
        });
        // summary
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

        const buffer = await workbook.xlsx.writeBuffer();

        return buffer;
    }
}