import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";

import { InjectRepository }
    from "@nestjs/typeorm";

import { TransactionRule }
    from "../entities/transaction_rules.entity";

import {
    DataSource,
    IsNull,
    Not,
    Repository,
} from "typeorm";

import { TransactionType }
    from "../entities/transaction_types.entity";

import { CreateTransactionRuleDto, ListTransactionRuleQuery, UpdateTransactionRuleDto }
    from "../dto/transaction_rules.dto";

import { Account }
    from "../entities/accounts.entity";
import { PaginatedResponse } from "src/common/dto/pagination.dto";
import { User } from "src/auth/entities/user.entity";
import { Transaction } from "../entities/transactions.entity";


@Injectable()
export class TransactionRuleService {
    private logger = new Logger(TransactionRuleService.name);
    constructor(

        @InjectRepository(TransactionType)
        private readonly transactionTypeRepository:
            Repository<TransactionType>,

        private readonly dataSource: DataSource,

    ) { }


    async createTransactionRule(
        transactionRuleDto: CreateTransactionRuleDto,
        user: User
    ) {

        const {
            name,
            rules,
            transactionType,
            description,
        } = transactionRuleDto;


        const customerId = user.userRoles[0].customerId;

        await this.dataSource.transaction(
            async (manager) => {

                const nameExists =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                deletedAt: IsNull(),
                                customerId: customerId,
                                transactionType:
                                    transactionType,
                            },
                        },
                    );

                if (nameExists) {

                    throw new ConflictException(
                        'Transaction type is already registered',
                    );
                }


                const newTransactionType =
                    new TransactionType();

                newTransactionType.name = name;

                newTransactionType.transactionType =
                    transactionType;

                newTransactionType.description =
                    description;

                newTransactionType.customerId = customerId;

                await manager.save(
                    TransactionType,
                    newTransactionType,
                );


                for (const rule of rules) {

                    const account =
                        await manager.findOne(
                            Account,
                            {
                                where: {
                                    deletedAt: IsNull(),
                                    id: rule.accountId,
                                    customerId: customerId
                                },
                            },
                        );

                    if (!account) {

                        throw new BadRequestException(
                            'Account not found',
                        );
                    }


                    const newTransactionRule =
                        new TransactionRule();

                    newTransactionRule.account =
                        account;

                    newTransactionRule.increase =
                        rule.increase;

                    newTransactionRule.transactionType =
                        newTransactionType;

                    await manager.save(
                        TransactionRule,
                        newTransactionRule,
                    );
                }
            },
        );

        return { message: 'Transaction rule created' }


    }


    async findById(id: string, user: User) {
        const customerId = user.userRoles[0].customerId;
        const data = await this.transactionTypeRepository.findOne({ where: { id: id, deletedAt: IsNull(), customerId: customerId }, relations: ['rules'] });
        if (!data) {
            throw new NotFoundException('Transaction rule not found');
        }
        return data;
    }

    async listTransactionRulesWithPagination(query: ListTransactionRuleQuery, user: User) {
        const customerId = user.userRoles[0].customerId;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.transactionTypeRepository
            .createQueryBuilder('rule')
            .where('rule."deleted_at" IS NULL AND rule.customerId = :customerId', { customerId })
            .orderBy('rule."created_at"', 'DESC');

        if (query.search) {
            qb.andWhere('( rule."name" ILIKE :search OR rule."transaction_type" ILIKE :search )', { search: `%${query.search}%` })
        }

        qb.skip((page - 1) * pageSize).take(pageSize);

        const [data, total] = await qb.getManyAndCount();
        return new PaginatedResponse(data, total, page, pageSize);
    }


    async deleteTransactionRule(
        id: string,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;
        await this.dataSource.transaction(
            async (manager) => {

                const txnTypeUses = await manager.find(Transaction, { where: { deletedAt: IsNull(), transactionTypeId: id } });

                if (txnTypeUses.length > 0) {
                    this.logger.debug('Cannot delete this transaction type because it is being used');
                    throw new BadRequestException('Cannot delete this transaction type because it is being used')
                }

                const transactionType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                deletedAt: IsNull(),
                                id:
                                    id,
                                customerId: customerId
                            },
                            relations: ['rules']
                        },
                    );

                if (!transactionType) {

                    throw new BadRequestException(
                        'Transaction type is already deleted',
                    );
                }



                transactionType.deletedAt =
                    new Date();

                await manager.save(
                    TransactionType,
                    transactionType,
                );


                for (const rule of transactionType.rules) {

                    rule.deletedAt = new Date();

                    await manager.save(
                        TransactionRule,
                        rule,
                    );
                }
            },
        );

        return { message: 'Transaction rule deleted' }
    }


    async updateTransactionRule(
        id: string,
        transactionRuleDto: UpdateTransactionRuleDto,
        user: User
    ) {

        const {
            name,
            rules,
            transactionType,
            description,
        } = transactionRuleDto;

        const customerId = user.userRoles[0].customerId;

        await this.dataSource.transaction(
            async (manager) => {

                const transactionTypeData =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                deletedAt: IsNull(),
                                id:
                                    id,
                                customerId: customerId
                            },
                            relations: ['rules']
                        },
                    );

                if (!transactionTypeData) {

                    throw new NotFoundException(
                        'Transaction type not found',
                    );
                }

                const nameExists =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                deletedAt: IsNull(),
                                transactionType:
                                    transactionType,
                                customerId: customerId,
                                id: Not(id)
                            },
                        },
                    );

                if (nameExists) {

                    throw new ConflictException(
                        'Transaction type is already registered',
                    );
                }

                transactionTypeData.name = name;

                transactionTypeData.transactionType =
                    transactionType;

                transactionTypeData.description =
                    description;

                await manager.save(
                    TransactionType,
                    transactionTypeData,
                );


                for (const rule of rules) {

                    const transactionRule =
                        await manager.findOne(
                            TransactionRule,
                            {
                                where: {
                                    deletedAt: IsNull(),
                                    id:
                                        rule.ruleId
                                },
                            },
                        );

                    if (!transactionRule) {

                        throw new NotFoundException(
                            'Rule not found to update',
                        );
                    }

                    const account =
                        await manager.findOne(
                            Account,
                            {
                                where: {
                                    deletedAt: IsNull(),
                                    id: rule.accountId,
                                    customerId: customerId
                                },
                            },
                        );

                    if (!account) {

                        throw new BadRequestException(
                            'Account not found',
                        );
                    }


                    transactionRule.account =
                        account;

                    transactionRule.increase =
                        rule.increase;

                    transactionRule.transactionType =
                        transactionTypeData;

                    await manager.save(
                        TransactionRule,
                        transactionRule,
                    );
                }
            },
        );

        return { message: 'Transaction rule updated' }


    }
}