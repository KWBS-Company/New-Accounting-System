import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from '../entities/accounts.entity';
import {
    Between,
    ILike,
    IsNull,
    LessThanOrEqual,
    MoreThanOrEqual,
    Repository,
} from 'typeorm';
import { TransactionRule } from '../entities/transaction_rules.entity';
import { TransactionLine } from '../entities/transaction_lines.entity';
import { AccountPDFService } from './account.pdf.service';
import { ConfigService } from '@nestjs/config';
import { MCPDataDto } from 'src/mcp-gateway/mcp_data.dto';

// only for accounting system
@Injectable()
export class AccountMCPService {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(TransactionRule)
        private readonly transactionRuleRepository: Repository<TransactionRule>,
        @InjectRepository(TransactionLine)
        private readonly transactionLineRepository: Repository<TransactionLine>,
        private readonly pdfService: AccountPDFService,
        private readonly configService: ConfigService,
    ) {}

    async getAccountDetailByKeyAndFilter(dto: MCPDataDto) {
        const customerId = dto.customerId;
        if (dto.key.toLocaleLowerCase().includes('id')) {
            return await this.accountRepository.findOne({
                where: { deletedAt: IsNull(), id: dto.value, customerId },
                relations: ['children'],
            });
        } else if (dto.key.toLocaleLowerCase().includes('code')) {
            return await this.accountRepository.findOne({
                where: {
                    deletedAt: IsNull(),
                    code: ILike(dto.value),
                    customerId,
                },
                relations: ['children'],
            });
        } else if (dto.key.toLocaleLowerCase().includes('name')) {
            return await this.accountRepository.findOne({
                where: {
                    deletedAt: IsNull(),
                    name: ILike(dto.value),
                    customerId,
                },
                relations: ['children'],
            });
        }
    }

    async listAccounts(dto: MCPDataDto) {
        const customerId = dto.customerId;
        return this.accountRepository.find({
            where: { deletedAt: IsNull(), customerId },
            relations: ['children'],
        });
    }

    async getBalance(dto: MCPDataDto) {
        const customerId = dto.customerId;
        let account: Account | null = null;

        const { fromDate, toDate, fiscalYear } = dto?.filters || {};

        const transactionDateCondition =
            fromDate && toDate
                ? Between(fromDate, toDate)
                : fromDate
                  ? MoreThanOrEqual(fromDate)
                  : toDate
                    ? LessThanOrEqual(toDate)
                    : undefined;

        if (dto.key.toLocaleLowerCase().includes('id')) {
            account = await this.accountRepository.findOne({
                where: {
                    deletedAt: IsNull(),
                    id: dto.value,
                    customerId,
                    lines: {
                        deletedAt: IsNull(),
                        transaction: {
                            deletedAt: IsNull(),
                            customerId,
                            transactionDate: transactionDateCondition
                                ? transactionDateCondition
                                : undefined,
                            customer: {
                                deletedAt: IsNull(),
                                id: customerId,
                                fiscalYears: {
                                    name: fiscalYear,
                                    deletedAt: IsNull(),
                                },
                            },
                        },
                    },
                },
                relations: ['children', 'lines'],
            });
        } else if (dto.key.toLocaleLowerCase().includes('code')) {
            account = await this.accountRepository.findOne({
                where: {
                    deletedAt: IsNull(),
                    code: ILike(dto.value),
                    customerId,
                    lines: {
                        deletedAt: IsNull(),
                        transaction: {
                            deletedAt: IsNull(),
                            customerId,
                            transactionDate: transactionDateCondition
                                ? transactionDateCondition
                                : undefined,
                            customer: {
                                deletedAt: IsNull(),
                                id: customerId,
                                fiscalYears: {
                                    name: fiscalYear,
                                    deletedAt: IsNull(),
                                },
                            },
                        },
                    },
                },
                relations: ['children', 'lines'],
            });
        } else if (dto.key.toLocaleLowerCase().includes('name')) {
            account = await this.accountRepository.findOne({
                where: {
                    deletedAt: IsNull(),
                    name: ILike(dto.value),
                    customerId,
                    lines: {
                        deletedAt: IsNull(),
                        transaction: {
                            deletedAt: IsNull(),
                            customerId,
                            transactionDate: transactionDateCondition
                                ? transactionDateCondition
                                : undefined,
                            customer: {
                                deletedAt: IsNull(),
                                id: customerId,
                                fiscalYears: {
                                    name: fiscalYear,
                                    deletedAt: IsNull(),
                                },
                            },
                        },
                    },
                },
                relations: ['children', 'lines'],
            });
        }

        if (!account) {
            throw new NotFoundException('Account not found');
        }

        const balance = account.lines
            .map((l) => l.debit - l.credit)
            .reduce((cur, prev) => cur + prev, 0);

        return { balance, isCredit: balance < 0 ? true : false };
    }
}
