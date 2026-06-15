import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { CreateTransactionDto, ListTransactionQuery, PreviewTransactionLineDto, UpdateTransactionDto } from "../dto/transactions.dto";
import { TransactionService } from "../services/transactions.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { User } from "src/auth/entities/user.entity";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { Roles } from "src/auth/decorators/roles.decorator";
import { RoleType } from "src/auth/entities/user_roles.entity";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Response } from "express";


@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(RolesGuard)
@Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
export class TransactionController {
    constructor(private readonly txnService: TransactionService) { }

    @Post()
    async create(@Body() data: CreateTransactionDto, @CurrentUser() user: User) {
        return this.txnService.create(data, user);
    }

    @Get('download/template')
    async downloadTransactionTemplate(
        @Res() res: Response,
        @CurrentUser() user: User
    ) {

        const buffer = await this.txnService
            .downloadTransactionTemplate(
                user
            );
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=transaction-template.xlsx',
        );
        res.end(buffer);
    }

    @Get(':id/download')
    async downloadJournalVoucher(
        @Param('id') id: string,
        @Res() res: Response,
        @CurrentUser() user: User
    ) {

        const bufferData = await this.txnService
            .downloadJournalVoucher(
                id,
                user
            );
        res.header('Content-Type', 'application/pdf');
        res.attachment(`journal_voucher_${id}.pdf`);
        res.send(bufferData);
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
            .uploadExcel(file, user);
    }

    @Put(':id')
    async update(@Body() data: UpdateTransactionDto, @Param('id') id: string, @CurrentUser() user: User) {
        return this.txnService.update(id, data, user);
    }

    @Delete(':id')
    async delete(@Param('id') id: string, @CurrentUser() user: User) {
        return this.txnService.delete(id, user);
    }

    @Get(':id')
    async findById(@Param('id') id: string, @CurrentUser() user: User) {
        return this.txnService.findById(id, user);
    }

    @Post('preview-lines')
    async preview(@Body() dto: PreviewTransactionLineDto, @CurrentUser() user: User) {
        return this.txnService.previewTransactionLine(dto, user);
    }

    @Get()
    async findAll(@Query() query: ListTransactionQuery, @CurrentUser() user: User) {
        return this.txnService.listTransactionsWithPagination(query, user);
    }
}