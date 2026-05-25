import { ApiTags } from "@nestjs/swagger";
import { LedgerHead } from "../entities/ledger_head.entity";
import { LedgerHeadService } from "../services/ledger_head.service";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Public } from "src/auth/decorators/public.decorator";
import { CreateLedgerHeadDto, ListLedgerHeadDto, UpdateLedgerHeadDto } from "../dto/ledger_head.dto";
import { CreateTransactionDto } from "../dto/transaction.dto";
import { TransactionService } from "../services/journal_transaction.service";


@ApiTags('Transactions')
@Controller('journal-transactions')
@Public()
export class TransactionController {
    constructor(private readonly txnService: TransactionService) { }

    @Post()
    async create(@Body() data: CreateTransactionDto) {
        return this.txnService.create(data);
    }

    // @Patch(':id')
    // async update(@Body() data: UpdateLedgerHeadDto, @Param('id') id: string) {
    //     return this.ledgerHeadService.update(data, id);
    // }

    // @Delete(':id')
    // async delete(@Param('id') id: string) {
    //     return this.ledgerHeadService.delete(id);
    // }

    // @Get(':id')
    // async findById(@Param('id') id: string): Promise<LedgerHead | null> {
    //     return this.ledgerHeadService.findById(id);
    // }

    // @Get()
    // @Public()
    // async findAll(@Query() query: ListLedgerHeadDto) {
    //     return this.ledgerHeadService.findAllWithPagination(query);
    // }
}