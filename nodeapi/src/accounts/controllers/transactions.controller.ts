import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { CreateTransactionDto, ListTransactionQuery } from "../dto/transactions.dto";
import { TransactionService } from "../services/transactions.service";
import { FileInterceptor } from "@nestjs/platform-express";


@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
    constructor(private readonly txnService: TransactionService) { }

    @Post()
    async create(@Body() data: CreateTransactionDto) {
        return this.txnService.create(data);
    }

    @Put(':id')
    async update(@Body() data: CreateTransactionDto, @Param('id') id: string) {
        return this.txnService.update(id,data);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.txnService.delete(id);
    }

    @Get(':id')
    async findById(@Param('id') id: string){
        return this.txnService.findById(id);
    }

    @Get()
    async findAll(@Query() query: ListTransactionQuery) {
        return this.txnService.listTransactionsWithPagination(query);
    }

    @Post('upload-excel')
    @UseInterceptors(
        FileInterceptor('file'),
    )
    async uploadExcel(
        @UploadedFile() file: Express.Multer.File,
    ) {

        return this.txnService
            .uploadExcel(file);
    }
}