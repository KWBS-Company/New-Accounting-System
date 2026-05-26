import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Public } from "src/auth/decorators/public.decorator";
import { CreateTransactionDto } from "../dto/transaction.dto";
import { TransactionService } from "../services/transactions.service";


@ApiTags('Transactions')
@Controller('transactions')
@Public()
export class TransactionController {
    constructor(private readonly txnService: TransactionService) { }

    @Post()
    async create(@Body() data: CreateTransactionDto) {
        return this.txnService.save(data);
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