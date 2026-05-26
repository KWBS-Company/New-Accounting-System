import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { PaginatedResponse } from 'src/common/dto/pagination.dto';
import { CreateAccountDto, ListAccountDto, UpdateAccountDto } from '../dto/account.dto';

@Injectable()
export class AccountService {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
    ) { }

    private async save(data: Partial<Account>): Promise<Account> {
        return this.accountRepository.save(data);
    }

    private async findById(id: string): Promise<Account | null> {
        return this.accountRepository.findOne({ where: { id, deletedAt: IsNull() }, relations: ['children'] });
    }

    private async findByParentId(parentId: string): Promise<Account[]> {
        const qb = this.accountRepository
            .createQueryBuilder('account')
            .where('account."deleted_at" IS NULL AND "account".parent_id = :id ', { id: parentId })
            .orderBy('account."created_at"', 'DESC');

        const parents = await qb.getMany();
        return parents;
    }

    private async findOrFail(id: string): Promise<Account> {
        const ledgerHead = await this.findById(id);
        if (!ledgerHead) throw new NotFoundException('Account not found');
        return ledgerHead;
    }

    private async update(id: string, data: Partial<Account>): Promise<Account> {
        await this.accountRepository.update(id, data);
        return this.findOrFail(id);
    }

    private async findAll(): Promise<Account[]> {
        return this.accountRepository.find({ where: { deletedAt: IsNull() } });
    }

    private async checkDuplicateAccountCode(code: string) {
        const qb = this.accountRepository
            .createQueryBuilder('ledgerhead')
            .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".code ILIKE :code ', { code: `${code}%` })
            .orderBy('ledgerhead."created_at"', 'DESC');

        const isExists = await qb.getExists();
        return isExists;
    }
    private async checkDuplicateAccountName(name: string) {
        const qb = this.accountRepository
            .createQueryBuilder('ledgerhead')
            .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".name ILIKE :name ', { name })
            .orderBy('ledgerhead."created_at"', 'DESC');

        const isExists = await qb.getExists();
        return isExists;
    }

    private async generateAccountCode(code: string): Promise<string> {
        // get parent ledger
        const normalizedPrefix = code.toUpperCase().replace(/[^A-Za-z]/g, '');

        // find latest child code
        const latestLedger = await this.accountRepository
            .createQueryBuilder('ledger')
            .where('ledger.code LIKE :prefix', {
                prefix: `${normalizedPrefix}%`,
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
    async createAccount(data: CreateAccountDto) {
        const { name, code, parentId,accountType } = data;

        const nameExistence = await this.checkDuplicateAccountName(name);

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
                await this.findById(parentId);

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
                    parentAccount.code,
                );

            newAccount.code = generatedCode;
            newAccount.parent = parentAccount;
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
        }

        newAccount.name = name;
        newAccount.accountType = accountType;

        await this.save(newAccount);

        return {
            message: 'Account created successfully.',
        };
    }

    async updateAccount(data: UpdateAccountDto, id: string) {
        const { name } = data;

        const account = await this.findById(id);

        if (!account) {
            throw new HttpException(
                {
                    message:
                        'Account not found.',
                },
                HttpStatus.NOT_FOUND,
            );
        }

        account.name = name;

        await this.save(account);

        return {
            message: 'Account name updated successfully.',
        };
    }

    async deleteAccount(id: string) {
        const account = await this.findById(id);

        if (!account) {
            throw new HttpException(
                { message: 'Account not found.' },
                HttpStatus.NOT_FOUND,
            );
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

    async findAccountById(id: string): Promise<Account | null> {
        return this.findById(id);
    }

    async listAccountWithPagination(query: ListAccountDto) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.accountRepository
            .createQueryBuilder('account')
            .where('account."deleted_at" IS NULL ')
            //   .leftJoinAndSelect('appointment.service', 'service')
            //   .leftJoinAndSelect('appointment.customer', 'customer')
            .orderBy('account."created_at"', 'DESC');

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
}
