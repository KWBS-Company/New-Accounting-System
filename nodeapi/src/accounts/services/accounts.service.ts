import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { PaginatedResponse } from 'src/common/dto/pagination.dto';
import { CreateAccountDto, ListAccountDto, UpdateAccountDto } from '../dto/accounts.dto';
import { User } from 'src/auth/entities/user.entity';
import { TransactionRule } from '../entities/transaction_rules.entity';
import { TransactionLine } from '../entities/transaction_lines.entity';
import { AccountType } from '../types/account_types.enum';

@Injectable()
export class AccountService {
    private logger = new Logger(AccountService.name);
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(TransactionRule)
        private readonly transactionRuleRepository: Repository<TransactionRule>,
        @InjectRepository(TransactionLine)
        private readonly transactionLineRepository: Repository<TransactionLine>,
        private readonly dataSource: DataSource
    ) { }

    private async save(data: Partial<Account>): Promise<Account> {
        return this.accountRepository.save(data);
    }

    private async findById(id: string, customerId: string): Promise<Account> {
        const data = await this.accountRepository.findOne({ where: { id, deletedAt: IsNull(), customer: { id: customerId, deletedAt: IsNull() } }, relations: ['children'] });
        if (!data) {
            throw new NotFoundException('Account not found');
        }
        return data;
    }

    private async checkDuplicateAccountCode(code: string, customerId: string, filterId: string | undefined) {
        if (!filterId) {
            const qb = this.accountRepository
                .createQueryBuilder('ledgerhead')
                .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".code ILIKE :code AND "ledgerhead"."customer_id" = :customerId ', { code: `${code}%`, customerId })
                .orderBy('ledgerhead."created_at"', 'DESC');

            const isExists = await qb.getExists();
            return isExists;
        } else {
            const qb = this.accountRepository
                .createQueryBuilder('ledgerhead')
                .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".code ILIKE :code AND "ledgerhead"."customer_id" = :customerId AND "ledgerhead".id <> :filterId ', { code: `${code}%`, customerId, filterId })
                .orderBy('ledgerhead."created_at"', 'DESC');

            const isExists = await qb.getExists();
            return isExists;
        }

    }
    private async checkDuplicateAccountName(name: string, customerId: string, filterId: string | undefined) {
        if (!filterId) {
            const qb = this.accountRepository
                .createQueryBuilder('ledgerhead')
                .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".name ILIKE :name AND "ledgerhead"."customer_id" = :customerId ', { name, customerId })
                .orderBy('ledgerhead."created_at"', 'DESC');

            const isExists = await qb.getExists();
            return isExists;
        } else {
            const qb = this.accountRepository
                .createQueryBuilder('ledgerhead')
                .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".name ILIKE :name AND "ledgerhead"."customer_id" = :customerId AND "ledgerhead".id <> :filterId ', { name, customerId, filterId })
                .orderBy('ledgerhead."created_at"', 'DESC');

            const isExists = await qb.getExists();
            return isExists;
        }
    }

    private async generateAccountCode(code: string, customerId: string): Promise<string> {
        // get parent ledger
        const normalizedPrefix = code.toUpperCase().replace(/[^A-Za-z]/g, '');

        // find latest child code
        const latestLedger = await this.accountRepository
            .createQueryBuilder('ledger')
            .where('ledger.code LIKE :prefix AND ledger."customer_id" = :customerId ', {
                prefix: `${normalizedPrefix}%`,
                customerId
            })
            .orderBy(
                `CAST(SUBSTRING(ledger.code FROM '[0-9]+$') AS INTEGER)`,
                'DESC',
            )
            .getOne();

        let nextNumber = 1;

        if (latestLedger) {
            // remove prefix and get numeric part
            const currentNumber = parseInt(
                latestLedger.code.replace(normalizedPrefix, ''),
                10,
            );

            nextNumber = currentNumber + 1;
        }

        // example:
        // parent: AA
        // child: AA0001
        const generatedCode = `${normalizedPrefix}${String(
            nextNumber,
        ).padStart(4, '0')}`;

        return generatedCode;
    }

    // FOR CONTROLLER
    async createAccount(data: CreateAccountDto, user: User) {
        const { name, code, parentId, accountType } = data;

        const customerId = user.userRoles[0].customerId;

        const nameExistence = await this.checkDuplicateAccountName(name, customerId, '');

        if (nameExistence) {
            throw new HttpException(
                {
                    message:
                        'Account name already exists.',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        const newAccount = new Account();

        /**
         * CHILD LEDGER
         */
        if (parentId) {
            const parentAccount =
                await this.findById(parentId, customerId);

            if (!parentAccount) {
                throw new HttpException(
                    {
                        message:
                            'Parent account not found in the database.',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            // generate from parent
            const generatedCode =
                await this.generateAccountCode(
                    parentAccount.code, customerId
                );

            newAccount.code = generatedCode;
            newAccount.parent = parentAccount;
            newAccount.accountType = parentAccount.accountType;
        }

        /**
         * ROOT LEDGER
         */
        else {
            if (!code) {
                throw new HttpException(
                    {
                        message:
                            'Code must be there',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }
            const normalizedCode = code.toUpperCase();

            const isExists =
                await this.checkDuplicateAccountCode(
                    normalizedCode,
                    customerId,
                    ''
                );

            if (isExists) {
                throw new HttpException(
                    {
                        message:
                            'Account code prefix already exists.',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // root ledger starts from 0001
            newAccount.code = `${normalizedCode}0001`;
            newAccount.accountType = accountType;
        }

        newAccount.name = name;
        newAccount.customer = user.userRoles[0].customer;

        await this.save(newAccount);

        return {
            message: 'Account created successfully.',
        };
    }

    // async updateAccount(data: UpdateAccountDto, id: string, user: User) {
    //     const { name, code, parentId, accountType } = data;

    //     const customerId = user.userRoles[0].customerId;

    //     const account = await this.findById(id, customerId);

    //     if (!account) {
    //         throw new NotFoundException('Account not found');
    //     }

    //     const nameExistence = await this.checkDuplicateAccountName(name, customerId, id);

    //     if (nameExistence) {
    //         throw new HttpException(
    //             {
    //                 message:
    //                     'Account name already exists.',
    //             },
    //             HttpStatus.BAD_REQUEST,
    //         );
    //     }

    //     /**
    //      * CHILD LEDGER
    //      */
    //     if (parentId) {
    //         const parentAccount =
    //             await this.findById(parentId, customerId);

    //         if (!parentAccount) {
    //             throw new HttpException(
    //                 {
    //                     message:
    //                         'Parent account not found in the database.',
    //                 },
    //                 HttpStatus.NOT_FOUND,
    //             );
    //         }

    //         // generate from parent
    //         const generatedCode =
    //             await this.generateAccountCode(
    //                 parentAccount.code, customerId
    //             );

    //         account.code = generatedCode;
    //         account.parent = parentAccount;
    //         account.accountType = parentAccount.accountType;
    //     }

    //     /**
    //      * ROOT LEDGER
    //      */
    //     else {
    //         if (!code) {
    //             throw new HttpException(
    //                 {
    //                     message:
    //                         'Code must be there',
    //                 },
    //                 HttpStatus.NOT_FOUND,
    //             );
    //         }
    //         const normalizedCode = code.toUpperCase();

    //         const isExists =
    //             await this.checkDuplicateAccountCode(
    //                 normalizedCode,
    //                 customerId,
    //                 id
    //             );

    //         if (isExists) {
    //             throw new HttpException(
    //                 {
    //                     message:
    //                         'Account code prefix already exists.',
    //                 },
    //                 HttpStatus.BAD_REQUEST,
    //             );
    //         }

    //         // root ledger starts from 0001
    //         account.code = `${normalizedCode}0001`;
    //         account.accountType = accountType;
    //         account.parentId = null;
    //     }

    //     account.name = name;

    //     await this.save(account);

    //     return {
    //         message: 'Account updated successfully.',
    //     };
    // }

    async updateAccount(data: UpdateAccountDto, id: string, user: User) {
        const { name } = data;

        const customerId = user.userRoles[0].customerId;

        const account = await this.findById(id, customerId);

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        const nameExistence = await this.checkDuplicateAccountName(name, customerId, id);

        if (nameExistence) {
            throw new HttpException(
                {
                    message:
                        'Account name already exists.',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        account.name = name;

        await this.save(account);

        return {
            message: 'Account updated successfully.',
        };
    }

    async deleteAccount(id: string, user: User) {
        const customerId = user.userRoles[0].customerId;
        const account = await this.findById(id, customerId);

        if (!account) {
            throw new HttpException(
                { message: 'Account not found.' },
                HttpStatus.NOT_FOUND,
            );
        }

        // safety check
        const accountUsesInTransactionRules = await this.transactionRuleRepository.find({ where: { deletedAt: IsNull(), accountId: account.id } });

        if (accountUsesInTransactionRules.length > 0) {
            this.logger.debug('Cannot delete the account since it is being used in transaction rules');
            throw new BadRequestException('Cannot delete the account since it is being used in transaction rules')
        }

        const accountUsesInTransactionLines = await this.transactionLineRepository.find({ where: { deletedAt: IsNull(), accountId: account.id } });

        if (accountUsesInTransactionLines.length > 0) {
            this.logger.debug('Cannot delete the account since it is being used in transaction lines');
            throw new BadRequestException('Cannot delete the account since it is being used in transaction lines')
        }

        const now = new Date();

        // soft delete current ledger
        account.deletedAt = now;
        await this.save(account);

        // get children (not siblings)
        await Promise.all(
            account.children.map((child) => {
                child.deletedAt = now;
                return this.save(child);
            }),
        );

        return {
            message: 'Account deleted successfully.',
        };
    }

    async findAccountById(id: string, user: User): Promise<Account | null> {
        const customerId = user.userRoles[0].customerId;
        return this.findById(id, customerId);
    }

    async listAccountWithPagination(query: ListAccountDto, user: User) {
        const customerId = user.userRoles[0].customerId;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.accountRepository
            .createQueryBuilder('account')
            .where('account."deleted_at" IS NULL AND account.customerId = :customerId', { customerId })
            //   .leftJoinAndSelect('appointment.service', 'service')
            //   .leftJoinAndSelect('appointment.customer', 'customer')
            .orderBy('account."parent_id"', 'ASC', 'NULLS FIRST')
            .addOrderBy('account.name', 'ASC')

        if (query.accountType) {
            qb.andWhere('account."accountType" = :accountType', { accountType: query.accountType });
        }

        if (query.search) {
            qb.andWhere('( account."code" ILIKE :search OR account."name" ILIKE :search )', { search: `%${query.search}%` })
        }

        qb.skip((page - 1) * pageSize).take(pageSize);

        const [data, total] = await qb.getManyAndCount();
        return new PaginatedResponse(data, total, page, pageSize);
    }


    async seedDefaultAccounts(customerId: string) {
        const accounts = await this.accountRepository.find({ where: { deletedAt: IsNull(), customerId: customerId } });

        if (accounts.length > 0) {
            this.logger.debug('No need to add default because, accounts are already seeded here.')
            return;
        }
        const newAcc = [
            {
                name: 'Current Assets',
                code: 'CA0001',
                accountType: AccountType.ASSET,
                parentId: null,
                customerId,
            },
            {
                name: 'Fixed Assets',
                code: 'FA0001',
                accountType: AccountType.ASSET,
                parentId: null,
                customerId,
            },
            {
                name: 'Other Assets',
                code: 'OA0001',
                accountType: AccountType.ASSET,
                parentId: null,
                customerId,
            },
            {
                name: 'Current Liabilities',
                code: 'CL0001',
                accountType: AccountType.LIABILITY,
                parentId: null,
                customerId,
            },
            {
                name: 'Long-Term Liabilities',
                code: 'LTL0001',
                accountType: AccountType.LIABILITY,
                parentId: null,
                customerId,
            },
            {
                name: 'Owner Capital',
                code: 'OC0001',
                accountType: AccountType.EQUITY,
                parentId: null,
                customerId,
            },
            {
                name: 'Retained Earnings (Last year Profit)',
                code: 'RE0001',
                accountType: AccountType.EQUITY,
                parentId: null,
                customerId,
            },
            {
                name: 'General Reserve',
                code: 'GR0001',
                accountType: AccountType.EQUITY,
                parentId: null,
                customerId,
            },
            {
                name: 'Common Stock',
                code: 'CS0001',
                accountType: AccountType.EQUITY,
                parentId: null,
                customerId,
            },
            {
                name: 'Treasury Stock',
                code: 'TS0001',
                accountType: AccountType.EQUITY,
                parentId: null,
                customerId,
            },
            {
                name: 'Revenue Accounts',
                code: 'RA0001',
                accountType: AccountType.REVENUE,
                parentId: null,
                customerId,
            },
            {
                name: 'Expense Accounts',
                code: 'EA0001',
                accountType: AccountType.EXPENSE,
                parentId: null,
                customerId,
            },
        ];

        await this.dataSource.transaction(async (manager) => {
            await manager.insert(Account, newAcc);
        });
    }
}
