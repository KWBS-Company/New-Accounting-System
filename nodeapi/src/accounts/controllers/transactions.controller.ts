import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { CreateTransactionDto, ListTransactionQuery } from "../dto/transactions.dto";
import { TransactionService } from "../services/transactions.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { User } from "src/auth/entities/user.entity";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";


@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
    constructor(private readonly txnService: TransactionService) { }

    @Post()
    async create(@Body() data: CreateTransactionDto, @CurrentUser() user: User) {
        return this.txnService.create(data,user);
    }

    @Put(':id')
    async update(@Body() data: CreateTransactionDto, @Param('id') id: string, @CurrentUser() user: User) {
        return this.txnService.update(id, data,user);
    }

    @Delete(':id')
    async delete(@Param('id') id: string, @CurrentUser() user: User) {
        return this.txnService.delete(id,user);
    }

    @Get(':id')
    async findById(@Param('id') id: string, @CurrentUser() user: User) {
        return this.txnService.findById(id,user);
    }

    @Get()
    async findAll(@Query() query: ListTransactionQuery, @CurrentUser() user: User) {
        return this.txnService.listTransactionsWithPagination(query,user);
    }

    @Post('upload-excel')
    @UseInterceptors(
        FileInterceptor('file'),
    )
    async uploadExcel(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: User
    ) {

        return this.txnService
            .uploadExcel(file,user);
    }
}