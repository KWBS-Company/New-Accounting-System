import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountReportService } from '../services/accounting_reports.service';
import { AccountReportQuery } from '../dto/accounting_reports.dto';
import { Response } from 'express';
import { User } from 'src/auth/entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AccoutingReportGenerator } from '../services/accounting_report_generators.service';
import { FiscalYearGuard } from 'src/auth/guards/fiscal-year.guard';

@ApiTags('Accounting Report')
@Controller('account-reports')
@UseGuards(RolesGuard, FiscalYearGuard)
export class AccountReportController {
    constructor(
        private readonly accountReportService: AccountReportService,
        private readonly accountReportGenerator: AccoutingReportGenerator,
    ) {}

    @Get('trial-balance')
    async generateTrialBalance(
        @Query() data: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        return this.accountReportService.generateTrialBalance(data, user);
    }

    @Get('pl')
    async generateProfitAndLoss(
        @Query() data: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        return this.accountReportService.generateProfitAndLossReport(
            data,
            user,
        );
    }

    @Get('balance-sheet')
    async generateBalanceSheet(
        @Query() data: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        return this.accountReportService.generateBalanceSheetReport(data, user);
    }

    @Get('trial-balance/excel')
    async downloadExcelTB(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        const bufferData =
            await this.accountReportGenerator.downloadTrialBalanceExcel(
                user,
                query,
            );

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=trial-balance.xlsx',
        );

        res.send(bufferData);
    }

    // PL
    @Get('pl/excel')
    async downloadExcelPL(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        const bufferData =
            await this.accountReportGenerator.downloadProfitLossExcel(
                user,
                query,
            );

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=profit-loss.xlsx',
        );

        res.send(bufferData);
    }

    // balance-sheet
    @Get('balance-sheet/excel')
    async downloadExcelBS(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        const bufferData =
            await this.accountReportGenerator.downloadBalanceSheetExcel(
                user,
                query,
            );

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=balance-sheet.xlsx',
        );

        res.send(bufferData);
    }

    @Get('pl/pdf')
    async downloadPdfPL(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        const buff = await this.accountReportGenerator.downloadProfitLossPdf(
            user,
            query,
        );
        res.setHeader('Content-Type', 'application/pdf');

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=profit-loss.pdf',
        );

        res.send(buff);
    }

    @Get('trial-balance/pdf')
    async downloadPdfTB(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        const bufferData =
            await this.accountReportGenerator.downloadTrialBalancePdf(
                user,
                query,
            );

        res.setHeader('Content-Type', 'application/pdf');

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=trial-balance.pdf',
        );

        res.send(bufferData);
    }

    @Get('balance-sheet/pdf')
    async downloadPdfBS(
        @Res() res: Response,
        @Query() query: AccountReportQuery,
        @CurrentUser() user: User,
    ) {
        const buf = await this.accountReportGenerator.downloadBalanceSheetPdf(
            user,
            query,
        );

        res.setHeader('Content-Type', 'application/pdf');

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=balance-sheet.pdf',
        );

        res.send(buf);
    }
}
