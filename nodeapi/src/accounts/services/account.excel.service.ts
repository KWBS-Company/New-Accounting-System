import { BadRequestException, Injectable } from "@nestjs/common";
import { CommonService } from "src/common/utils/common";
import { Workbook } from 'exceljs';
import { TransactionType } from "../entities/transaction_types.entity";

@Injectable()
export class AccountExcelService {
    private workbook: Workbook;
    constructor(private readonly commonService: CommonService) {
        this.workbook = new Workbook();
    }

    async generateTransactionTemplate(transactionTypes: TransactionType[]) {
        const workbook = this.workbook;

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


    async getTransactionTemplateData(file: Express.Multer.File) {
        const workbook = this.workbook;
        const buffer = file.buffer as any;
        await workbook.xlsx.load(
            buffer
        );

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
        let excelData: { amount: number, transactionTypeName: string, transactionDate: string, reference: string, description: string }[] = [];
        for (
            let rowNumber = 2;
            rowNumber <= worksheet.rowCount;
            rowNumber++
        ) {

            const row =
                worksheet.getRow(
                    rowNumber,
                );

            const transactionTypeName =
                row.getCell(2).value?.toString()?.trim();

            const amount =
                Number(
                    row.getCell(3).value,
                );

            const transactionDate =
                row.getCell(4).value?.toString()?.trim();

            const reference =
                row.getCell(5).value?.toString()?.trim() || '';

            const description =
                row.getCell(6).value?.toString()?.trim() || '';

            
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
}