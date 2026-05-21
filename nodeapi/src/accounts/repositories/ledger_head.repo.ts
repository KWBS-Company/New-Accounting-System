import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { LedgerHead } from '../entities/ledger_head.entity';
import { PaginatedResponse } from 'src/common/dto/pagination.dto';
import { ListLedgerHeadDto } from '../dto/ledger_head.dto';

@Injectable()
export class LedgerHeadRepository {
    constructor(
        @InjectRepository(LedgerHead)
        private readonly ledgerHeadRepository: Repository<LedgerHead>,
    ) { }

    async save(data: Partial<LedgerHead>): Promise<LedgerHead> {
        return this.ledgerHeadRepository.save(data);
    }

    async findById(id: string): Promise<LedgerHead | null> {
        return this.ledgerHeadRepository.findOne({ where: { id, deletedAt: IsNull() }, relations: ['children'] });
    }

    async findByParentId(parentId: string): Promise<LedgerHead[]> {
        const qb = this.ledgerHeadRepository
            .createQueryBuilder('ledgerhead')
            .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".parent_id = :id ', { id: parentId })
            .orderBy('ledgerhead."created_at"', 'DESC');

        const parents = await qb.getMany();
        return parents;
    }

    async findOrFail(id: string): Promise<LedgerHead> {
        const ledgerHead = await this.findById(id);
        if (!ledgerHead) throw new NotFoundException('Ledger head not found');
        return ledgerHead;
    }

    async update(id: string, data: Partial<LedgerHead>): Promise<LedgerHead> {
        await this.ledgerHeadRepository.update(id, data);
        return this.findOrFail(id);
    }

    async findAll(): Promise<LedgerHead[]> {
        return this.ledgerHeadRepository.find({ where: { deletedAt: IsNull() } });
    }

    async findAllWithPagination(query: ListLedgerHeadDto): Promise<PaginatedResponse<LedgerHead>> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.ledgerHeadRepository
            .createQueryBuilder('ledgerhead')
            .where('ledgerhead."deleted_at" IS NULL ')
            //   .leftJoinAndSelect('appointment.service', 'service')
            //   .leftJoinAndSelect('appointment.customer', 'customer')
            .orderBy('ledgerhead."created_at"', 'DESC');

        if (query.ledgerHeadType) {
            qb.andWhere('ledgerhead."ledgerHeadType" = :ledgerHeadType', { ledgerHeadType: query.ledgerHeadType });
        }

        if (query.search) {
            qb.andWhere('( ledgerhead."code" ILIKE :search OR ledgerhead."name" ILIKE :search )', { search: `%${query.search}%` })
        }

        qb.skip((page - 1) * pageSize).take(pageSize);

        const [data, total] = await qb.getManyAndCount();
        return new PaginatedResponse(data, total, page, pageSize);
    }

    async checkDuplicateLedgerCode(code: string) {
        const qb = this.ledgerHeadRepository
            .createQueryBuilder('ledgerhead')
            .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".code ILIKE :code ', { code: `${code}%` })
            .orderBy('ledgerhead."created_at"', 'DESC');

        const isExists = await qb.getExists();
        return isExists;
    }
    async checkDuplicateLedgerName(name: string) {
        const qb = this.ledgerHeadRepository
            .createQueryBuilder('ledgerhead')
            .where('ledgerhead."deleted_at" IS NULL AND "ledgerhead".name ILIKE :name ', { name })
            .orderBy('ledgerhead."created_at"', 'DESC');

        const isExists = await qb.getExists();
        return isExists;
    }

    async generateLedgerCode(code: string): Promise<string> {
        // get parent ledger
        const normalizedPrefix = code.toUpperCase().replace(/[^A-Za-z]/g, '');

        // find latest child code
        const latestLedger = await this.ledgerHeadRepository
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
}
