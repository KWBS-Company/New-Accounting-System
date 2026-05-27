import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "src/auth/decorators/public.decorator";
import { AccountReportService } from "../services/accounting_reports.service";
import { AccountReportQuery, ListAccountReportQuery } from "../dto/accounting_reports.dto";
import { Response } from "express";

@ApiTags('Accounting Report')
@Controller('account-reports')
@Public()
export class AccountReportController {
    constructor(private readonly accountReportService: AccountReportService) { }

    @Get()
    async findAll(@Query() data: ListAccountReportQuery) {
        return this.accountReportService.listAllAccountsWithPagination(data)
    }

    @Get('trial-balance')
    async generateTrialBalance(@Query() data: AccountReportQuery) {
        return this.accountReportService.generateTrialBalance(data)
    }

    @Get('pl')
    async generateProfitAndLoss(@Query() data: AccountReportQuery) {
        return this.accountReportService.generateProfitAndLossReport(data)
    }

    @Get('balance-sheet')
    async generateBalanceSheet(@Query() data: AccountReportQuery) {
        return this.accountReportService.generateBalanceSheetReport(data)
    }

    @Get('trial-balance/excel')
    async downloadExcelTB(
        @Res() res: Response,
        @Query() query: AccountReportQuery
    ) {

        const data =
            await this.accountReportService.generateTrialBalance(query)

        return this.accountReportService
            .downloadTrialBalanceExcel(
                data,
                res,
            );
    }

    @Get('trial-balance/pdf')
    async downloadPdfTB(
        @Res() res: Response,
        @Query() query: AccountReportQuery
    ) {

        const data =
            await this.accountReportService.generateTrialBalance(query)

        return this.accountReportService
            .downloadTrialBalancePdf(
                data,
                res,
            );
    }

    // PL
    @Get('pl/excel')
    async downloadExcelPL(
        @Res() res: Response,
        @Query() query: AccountReportQuery
    ) {

        const data =
            await this.accountReportService.generateProfitAndLossReport(query)

        return this.accountReportService
            .downloadProfitLossExcel(
                data,
                res,
            );
    }

    @Get('pl/pdf')
    async downloadPdfPL(
        @Res() res: Response,
        @Query() query: AccountReportQuery
    ) {

        const data =
            await this.accountReportService.generateProfitAndLossReport(query)

        return this.accountReportService
            .downloadProfitLossPdf(
                data,
                res,
            );
    }

    // balance-sheet
    @Get('balance-sheet/excel')
    async downloadExcelBS(
        @Res() res: Response,
        @Query() query: AccountReportQuery
    ) {

        const data =
            await this.accountReportService.generateBalanceSheetReport(query)

        return this.accountReportService
            .downloadBalanceSheetExcel(
                data,
                res,
            );
    }

    @Get('balance-sheet/pdf')
    async downloadPdfBS(
        @Res() res: Response,
        @Query() query: AccountReportQuery
    ) {

        const data =
            await this.accountReportService.generateBalanceSheetReport(query)

        return this.accountReportService
            .downloadBalanceSheetPdf(
                data,
                res,
            );
    }

    @Get(':id/journal-voucher')
    async downloadJournalVoucher(
        @Param('id') id: string,
        @Res() res: Response,
    ) {

        return this.accountReportService
            .downloadJournalVoucher(
                id,
                res,
            );
    }


    @Get('transaction-template')
    async downloadTransactionTemplate(
        @Res() res: Response,
    ) {

        return this.accountReportService
            .downloadTransactionTemplate(
                res,
            );
    }

}