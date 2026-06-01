import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AccountReportService } from "../services/accounting_reports.service";
import { AccountReportQuery, ListAccountReportQuery } from "../dto/accounting_reports.dto";
import { Response } from "express";
import { User } from "src/auth/entities/user.entity";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/auth/decorators/roles.decorator";
import { RoleType } from "src/auth/entities/user_roles.entity";
import { AccoutingReportGenerator } from "../services/accounting_report_generators.service";

@ApiTags('Accounting Report')
@Controller('account-reports')
@UseGuards(RolesGuard)
export class AccountReportController {
    constructor(private readonly accountReportService: AccountReportService,
        private readonly accountReportGenerator: AccoutingReportGenerator
    ) { }

    @Get()
    @Roles(RoleType.CUSTOMER_ADMIN)
    async findAll(@Query() data: ListAccountReportQuery, @CurrentUser() user: User) {
        return this.accountReportService.listAllAccountsWithPagination(data, user)
    } x

    @Get('trial-balance')
    async generateTrialBalance(@Query() data: AccountReportQuery, @CurrentUser() user: User) {
        return this.accountReportService.generateTrialBalance(data, user)
    }

    @Get('pl')
    async generateProfitAndLoss(@Query() data: AccountReportQuery, @CurrentUser() user: User) {
        return this.accountReportService.generateProfitAndLossReport(data, user)
    }

    @Get('balance-sheet')
    async generateBalanceSheet(@Query() data: AccountReportQuery, @CurrentUser() user: User) {
        return this.accountReportService.generateBalanceSheetReport(data, user)
    }

    @Get('trial-balance/excel')
    async downloadExcelTB(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User
    ) {

        const data =
            await this.accountReportService.generateTrialBalance(query, user)

        return this.accountReportGenerator
            .downloadTrialBalanceExcel(
                data,
                res,
            );
    }

    @Get('trial-balance/pdf')
    async downloadPdfTB(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User
    ) {

        const data =
            await this.accountReportService.generateTrialBalance(query, user)

        return this.accountReportGenerator
            .downloadTrialBalancePdf(
                data,
                res,
            );
    }

    // PL
    @Get('pl/excel')
    async downloadExcelPL(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User
    ) {

        const data =
            await this.accountReportService.generateProfitAndLossReport(query, user)

        return this.accountReportGenerator
            .downloadProfitLossExcel(
                data,
                res,
            );
    }

    @Get('pl/pdf')
    async downloadPdfPL(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User
    ) {

        const data =
            await this.accountReportService.generateProfitAndLossReport(query, user)

        return this.accountReportGenerator
            .downloadProfitLossPdf(
                data,
                res,
            );
    }

    // balance-sheet
    @Get('balance-sheet/excel')
    async downloadExcelBS(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User
    ) {

        const data =
            await this.accountReportService.generateBalanceSheetReport(query, user)

        return this.accountReportGenerator
            .downloadBalanceSheetExcel(
                data,
                res,
            );
    }

    @Get('balance-sheet/pdf')
    async downloadPdfBS(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User
    ) {

        const data =
            await this.accountReportService.generateBalanceSheetReport(query, user)

        return this.accountReportGenerator
            .downloadBalanceSheetPdf(
                data,
                res,
            );
    }
}