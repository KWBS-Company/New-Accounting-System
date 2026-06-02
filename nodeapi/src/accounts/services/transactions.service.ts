import {
    BadRequestException,
    Injectable,
    NotFoundException
} from "@nestjs/common";

import { CreateTransactionDto, ListTransactionQuery }
    from "../dto/transactions.dto";

import { Transaction }
    from "../entities/transactions.entity";

import { InjectRepository }
    from "@nestjs/typeorm";

import {
    DataSource,
    IsNull,
    Repository
} from "typeorm";

import { AccountType }
    from "../types/account_types.enum";

import { Account }
    from "../entities/accounts.entity";

import { TransactionType }
    from "../entities/transaction_types.entity";

import { TransactionRule }
    from "../entities/transaction_rules.entity";

import { TransactionLine }
    from "../entities/transaction_lines.entity";
import { PaginatedResponse } from "src/common/dto/pagination.dto";

import * as ExcelJS from 'exceljs';
import { User } from "src/auth/entities/user.entity";
import { Response } from "express";
import PDFDocument from 'pdfkit';

@Injectable()
export class TransactionService {

    constructor(

        @InjectRepository(Transaction)
        private readonly txnRepository:
            Repository<Transaction>,

        @InjectRepository(TransactionType)
        private readonly txnTypeRepository:
            Repository<TransactionType>,

        @InjectRepository(Account)
        private readonly accountRepository:
            Repository<Account>,

        @InjectRepository(TransactionLine)
        private readonly txnLineRepository:
            Repository<TransactionLine>,

        private readonly dataSource: DataSource,

    ) { }


    // ----------------------------
    // Account type → normal side
    // ----------------------------

    private readonly debitIncreaseTypes = [
        AccountType.ASSET,
        AccountType.EXPENSE,
    ];


    // ----------------------------
    // Build a single journal line
    // ----------------------------

    private buildLine(params: {
        account: Account;
        amount: number;
        increase: boolean;
        description?: string;
    }) {

        const {
            account,
            amount,
            increase,
            description,
        } = params;

        let debit = 0;
        let credit = 0;

        const increasesWithDebit =
            this.debitIncreaseTypes.includes(
                account.accountType,
            );

        if (increase) {

            increasesWithDebit
                ? (debit = amount)
                : (credit = amount);

        } else {

            increasesWithDebit
                ? (credit = amount)
                : (debit = amount);
        }

        return {
            account,
            debit,
            credit,
            description,
        };
    }


    // ----------------------------
    // Generate journal lines
    // ----------------------------

    async generateJournalLines(params: {
        rules: TransactionRule[];
        amount: number;
        description?: string;
    }) {

        const {
            rules,
            amount,
            description,
        } = params;

        const lines = await Promise.all(
            rules.map(async (lineRule) => {

                const account =
                    await this.accountRepository.findOne({
                        where: {
                            id: lineRule.accountId,
                            deletedAt: IsNull(),
                        },
                    });

                if (!account) {

                    throw new BadRequestException(
                        'Account not found',
                    );
                }

                return this.buildLine({
                    account,
                    amount,
                    increase: lineRule.increase,
                    description,
                });
            }),
        );

        this.validateBalance(lines);

        return lines;
    }


    // ----------------------------
    // Validate double-entry balance
    // ----------------------------

    validateBalance(lines: any[]): void {

        const totalDebit =
            lines.reduce(
                (sum, l) =>
                    sum + Number(l.debit),
                0,
            );

        const totalCredit =
            lines.reduce(
                (sum, l) =>
                    sum + Number(l.credit),
                0,
            );

        if (
            Math.abs(
                totalDebit - totalCredit,
            ) > 0.001
        ) {

            throw new BadRequestException(
                `Journal entry is not balanced. ` +
                `Total Debit: ${totalDebit}, ` +
                `Total Credit: ${totalCredit}`,
            );
        }
    }


    async save(
        data: Partial<Transaction>,
    ): Promise<Transaction> {

        return this.txnRepository.save(data);
    }


    async create(
        data: CreateTransactionDto,
        user: User
    ) {

        const {
            description,
            reference,
            transactionTypeId,
            amount,
            transactionDate
        } = data;
        const customerId = user.userRoles[0].customerId;

        await this.dataSource.transaction(
            async (manager) => {

                const newTxn =
                    new Transaction();

                newTxn.reference =
                    reference;

                newTxn.customerId = customerId;

                newTxn.amount = Number(amount);

                newTxn.transactionDate =
                    new Date(transactionDate);


                const txnType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                id: transactionTypeId,
                                deletedAt: IsNull(),
                                customerId: customerId
                            },

                            relations: [
                                'rules',
                            ],
                        },
                    );

                if (!txnType) {

                    throw new BadRequestException(
                        'Transaction type not found',
                    );
                }

                newTxn.transactionType =
                    txnType;


                const transactionLines =
                    await this.generateJournalLines({
                        rules: txnType.rules,
                        amount: Number(amount),
                        description,
                    });


                await manager.save(
                    Transaction,
                    newTxn,
                );


                for (const line of transactionLines) {

                    const newTxnLine =
                        new TransactionLine();

                    newTxnLine.account =
                        line.account;

                    newTxnLine.credit =
                        line.credit;

                    newTxnLine.debit =
                        line.debit;

                    newTxnLine.transaction =
                        newTxn;

                    newTxnLine.description =
                        description;

                    await manager.save(
                        TransactionLine,
                        newTxnLine,
                    );
                }


                return newTxn;
            },
        );

        return { message: 'Transaction created successfully' }
    }

    async findById(id: string, user: User) {
        const customerId = user.userRoles[0].customerId;
        const data = await this.txnRepository.findOne({ where: { id: id, deletedAt: IsNull(), customerId: customerId }, relations: ['lines', 'lines.account'] });
        if (!data) {
            throw new NotFoundException('Transaction not found');
        }
        return data;
    }

    async delete(
        id: string,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;

        await this.dataSource.transaction(
            async (manager) => {

                const txn =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                                customerId: customerId
                            },

                            relations: [
                                'lines',
                            ],
                        },
                    );

                if (!txn) {

                    throw new BadRequestException(
                        'Transaction not found',
                    );
                }

                txn.deletedAt =
                    new Date();


                await manager.save(
                    Transaction,
                    txn,
                );


                for (const line of txn.lines) {
                    line.deletedAt = new Date();

                    await manager.save(
                        TransactionLine,
                        line,
                    );
                }
            },
        );

        return { message: 'Transaction deleted successfully' }
    }


    async listTransactionsWithPagination(
        query: ListTransactionQuery,
        user: User,
    ) {
        const customerId = user.userRoles[0].customerId;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.txnRepository
            .createQueryBuilder('txn')
            .leftJoinAndSelect('txn.transactionType', 'type', 'type.deletedAt IS NULL AND type.customerId = :customerId', { customerId })
            .where(
                'txn.deletedAt IS NULL AND txn.customerId = :customerId',
                { customerId },
            )
            .orderBy('txn.createdAt', 'DESC');

        if (query.search) {
            qb.andWhere(
                `(
                    txn.reference ILIKE :search
                    OR type.name ILIKE :search
                )`,
                {
                    search: `%${query.search}%`,
                },
            );
        }

        qb.skip((page - 1) * pageSize)
            .take(pageSize);

        const [data, total] = await qb.getManyAndCount();

        return new PaginatedResponse(
            data,
            total,
            page,
            pageSize,
        );
    }


    async update(
        id: string,
        data: CreateTransactionDto,
        user: User
    ) {

        const {
            description,
            reference,
            transactionTypeId,
            amount,
            transactionDate
        } = data;

        const customerId = user.userRoles[0].customerId;

        await this.dataSource.transaction(
            async (manager) => {


                const txn =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                                customerId
                            },

                            relations: [
                                'lines',
                            ],
                        },
                    );

                if (!txn) {
                    throw new BadRequestException('Transaction not found to update.');
                }

                txn.reference =
                    reference;

                txn.amount = Number(amount)

                txn.transactionDate =
                    new Date(transactionDate);


                const txnType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                id: transactionTypeId,
                                deletedAt: IsNull(),
                                customerId
                            },

                            relations: [
                                'rules',
                            ],
                        },
                    );

                if (!txnType) {

                    throw new BadRequestException(
                        'Transaction type not found',
                    );
                }

                txn.transactionType =
                    txnType;


                const transactionLines =
                    await this.generateJournalLines({
                        rules: txnType.rules,
                        amount: Number(amount),
                        description,
                    });


                await manager.save(
                    Transaction,
                    txn,
                );

                for (const line of txn.lines) {

                    line.deletedAt =
                        new Date();

                    await manager.save(
                        TransactionLine,
                        line,
                    );
                }

                for (const line of transactionLines) {

                    const newTxnLine =
                        new TransactionLine();

                    newTxnLine.account =
                        line.account;

                    newTxnLine.credit =
                        line.credit;

                    newTxnLine.debit =
                        line.debit;

                    newTxnLine.transaction =
                        txn;

                    newTxnLine.description =
                        description;

                    await manager.save(
                        TransactionLine,
                        newTxnLine,
                    );
                }
            },
        );

        return { message: 'Transaction updated successfully' }
    }

    // --------------------------------------------------
    // UPLOAD EXCEL
    // --------------------------------------------------

    async uploadExcel(
        file: Express.Multer.File,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;

        if (!file) {
            throw new BadRequestException(
                'File is required',
            );
        }

        const workbook =
            new ExcelJS.Workbook();

        await workbook.xlsx.load(
            file.buffer as any,
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

        const queryRunner =
            this.dataSource.createQueryRunner();

        await queryRunner.connect();

        await queryRunner.startTransaction();

        try {

            // ------------------------------------------
            // LOOP ROWS
            // ------------------------------------------

            for (
                let rowNumber = 2;
                rowNumber <= worksheet.rowCount;
                rowNumber++
            ) {

                const row =
                    worksheet.getRow(
                        rowNumber,
                    );

                const amount =
                    Number(
                        row.getCell(3).value,
                    );

                const transactionTypeName =
                    row.getCell(4).value?.toString()?.trim();

                const transactionDate =
                    row.getCell(5).value?.toString()?.trim();

                const reference =
                    row.getCell(6).value?.toString()?.trim();

                const description =
                    row.getCell(7).value?.toString()?.trim();


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


                // --------------------------------------
                // FIND TRANSACTION TYPE
                // --------------------------------------

                const txnType =
                    await queryRunner.manager.findOne(
                        TransactionType,
                        {
                            where: {
                                transactionType:
                                    transactionTypeName,
                                deletedAt: IsNull(),
                                customerId
                            },

                            relations: [
                                'rules',
                                'rules.account',
                            ],
                        },
                    );

                if (!txnType) {
                    throw new BadRequestException(
                        `Transaction type not found at row ${rowNumber}`,
                    );
                }


                // --------------------------------------
                // CREATE TRANSACTION
                // --------------------------------------

                const txn =
                    new Transaction();

                txn.reference =
                    reference || '';


                txn.transactionDate =
                    new Date(transactionDate);

                txn.customerId = customerId;

                txn.transactionType =
                    txnType;

                await queryRunner.manager.save(
                    Transaction,
                    txn,
                );


                // --------------------------------------
                // CREATE LINES
                // --------------------------------------

                for (const rule of txnType.rules) {

                    let debit = 0;
                    let credit = 0;

                    const ruleAccount =
                        await queryRunner.manager.findOne(
                            Account,
                            {
                                where: {
                                    id: rule.accountId,
                                    customerId
                                },
                            },
                        );

                    if (!ruleAccount) {
                        throw new BadRequestException(
                            `Rule account not found`,
                        );
                    }

                    const debitIncreaseTypes = [
                        'ASSET',
                        'EXPENSE',
                    ];

                    const increasesWithDebit =
                        debitIncreaseTypes.includes(
                            ruleAccount.accountType,
                        );

                    if (rule.increase) {

                        increasesWithDebit
                            ? debit = amount
                            : credit = amount;

                    } else {

                        increasesWithDebit
                            ? credit = amount
                            : debit = amount;
                    }

                    const txnLine =
                        new TransactionLine();

                    txnLine.transaction =
                        txn;

                    txnLine.account =
                        ruleAccount;

                    txnLine.debit =
                        debit;

                    txnLine.credit =
                        credit;

                    txnLine.description =
                        description || '';

                    await queryRunner.manager.save(
                        TransactionLine,
                        txnLine,
                    );
                }
            }

            // ------------------------------------------
            // COMMIT
            // ------------------------------------------

            await queryRunner.commitTransaction();

            return {
                success: true,
                message:
                    'Excel uploaded successfully',
            };

        } catch (error) {

            // ------------------------------------------
            // ROLLBACK
            // ------------------------------------------

            await queryRunner.rollbackTransaction();

            throw error;

        } finally {

            await queryRunner.release();
        }
    }

    async downloadTransactionTemplate(
        res: Response,
        user: User
    ) {

        // --------------------------------------------------
        // FETCH FROM DATABASE
        // --------------------------------------------------
        const customerId = user.userRoles[0].customerId;
        const accounts =
            await this.accountRepository.find({
                where: {
                    deletedAt: IsNull(),
                    customerId
                },
                order: {
                    name: 'ASC',
                },
            });

        const transactionTypes =
            await this.txnTypeRepository.find({
                where: {
                    deletedAt: IsNull(),
                    customerId
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

        // Ensure we always have at least one row so data-validation ranges are valid.
        // Excel will warn/recover if the range ends at row 0 (e.g. $A$1:$A$0).
        const safeAccountsLen = Math.max(accounts.length, 1);
        const safeTxnTypesLen = Math.max(transactionTypes.length, 1);
        if (accounts.length === 0) {
            dropdownSheet.getCell('A1').value = '';
        }
        if (transactionTypes.length === 0) {
            dropdownSheet.getCell('B1').value = '';
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
                    `=DropdownData!$A$1:$A$${safeAccountsLen}`,
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
                    `=DropdownData!$B$1:$B$${safeTxnTypesLen}`,
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

        const buf = await workbook.xlsx.writeBuffer();
        res.end(Buffer.from(buf));
    }

    async downloadJournalVoucher(
        transactionId: string,
        res: Response,
        user: User
    ) {

        const customerId = user.userRoles[0].customerId;
        const txn =
            await this.txnRepository.findOne({
                where: {
                    id: transactionId,
                    deletedAt: IsNull(),
                    customerId
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
            `Transaction Type : ${txn.transactionType?.name || '-'
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
}