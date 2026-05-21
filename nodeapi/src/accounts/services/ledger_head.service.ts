import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { LedgerHeadRepository } from "../repositories/ledger_head.repo";
import { LedgerHead } from "../entities/ledger_head.entity";
import { CreateLedgerHeadDto, ListLedgerHeadDto, UpdateLedgerHeadDto } from "../dto/ledger_head.dto";

@Injectable()
export class LedgerHeadService {
    constructor(private readonly ledgerHeadRepo: LedgerHeadRepository) { }

    async create(data: CreateLedgerHeadDto) {
        const { name, code, parentId, ledgerHeadType } = data;

        const nameExistence = await this.ledgerHeadRepo.checkDuplicateLedgerName(name);

        if (nameExistence) {
            throw new HttpException(
                {
                    message:
                        'Ledger name already exists.',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        const newLedgerHead = new LedgerHead();

        /**
         * CHILD LEDGER
         */
        if (parentId) {
            const parentLedgerHead =
                await this.ledgerHeadRepo.findById(parentId);

            if (!parentLedgerHead) {
                throw new HttpException(
                    {
                        message:
                            'Parent ledger head not found in the database.',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            // generate from parent
            const generatedCode =
                await this.ledgerHeadRepo.generateLedgerCode(
                    parentLedgerHead.code,
                );

            newLedgerHead.code = generatedCode;
            newLedgerHead.parent = parentLedgerHead;
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
                await this.ledgerHeadRepo.checkDuplicateLedgerCode(
                    normalizedCode,
                );

            if (isExists) {
                throw new HttpException(
                    {
                        message:
                            'Ledger code prefix already exists.',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // root ledger starts from 0001
            newLedgerHead.code = `${normalizedCode}0001`;
        }

        newLedgerHead.name = name;
        newLedgerHead.ledgerHeadType = ledgerHeadType;

        await this.ledgerHeadRepo.save(newLedgerHead);

        return {
            message: 'Ledger head created successfully.',
        };
    }

    async update(data: UpdateLedgerHeadDto, id: string) {
        const { name } = data;

        const ledgerHead = await this.ledgerHeadRepo.findById(id);

        if (!ledgerHead) {
            throw new HttpException(
                {
                    message:
                        'Ledger not found.',
                },
                HttpStatus.NOT_FOUND,
            );
        }

        ledgerHead.name = name;

        await this.ledgerHeadRepo.save(ledgerHead);

        return {
            message: 'Ledger name updated successfully.',
        };
    }

    async delete(id: string) {
        const ledgerHead = await this.ledgerHeadRepo.findById(id);

        if (!ledgerHead) {
            throw new HttpException(
                { message: 'Ledger not found.' },
                HttpStatus.NOT_FOUND,
            );
        }

        const now = new Date();

        // soft delete current ledger
        ledgerHead.deletedAt = now;
        await this.ledgerHeadRepo.save(ledgerHead);

        // get children (not siblings)
            await Promise.all(
                ledgerHead.children.map((child) => {
                    child.deletedAt = now;
                    return this.ledgerHeadRepo.save(child);
                }),
            );

        return {
            message: 'Ledger head deleted successfully.',
        };
    }

    async findById(id: string): Promise<LedgerHead | null> {
        return this.ledgerHeadRepo.findById(id);
    }

    async findAllWithPagination(query: ListLedgerHeadDto) {
        return this.ledgerHeadRepo.findAllWithPagination(query);
    }
}