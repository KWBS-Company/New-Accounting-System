import { Injectable } from "@nestjs/common";
import { User } from "src/auth/entities/user.entity";
import { AccountPDFService } from "./account.pdf.service";
import { ConfigService } from "@nestjs/config";
import { AccountReportService } from "./accounting_reports.service";
import { AccountReportQuery } from "../dto/accounting_reports.dto";
import { AccountExcelService } from "./account.excel.service";
import { trialBalancePdfDataMapper } from "../mapper/pdf.data.mapper";

@Injectable()
export class AccoutingReportGenerator {
    constructor(private readonly accountPdfService: AccountPDFService,
        private readonly accountExcelService: AccountExcelService,
        private readonly configService: ConfigService,
        private readonly accountReportService: AccountReportService
    ) { }

    async downloadTrialBalanceExcel(
        user: User,
        query: AccountReportQuery
    ) {
        const trialBalanceData = await this.accountReportService.generateTrialBalance(query, user);
        const bufferData = await this.accountExcelService.generateTBExcelBuffer(trialBalanceData);
        return bufferData;
    }

    async downloadProfitLossExcel(
        user: User,
        query: AccountReportQuery
    ) {

        const plData = await this.accountReportService.generateProfitAndLossReport(query, user);
        const bufferData = await this.accountExcelService.generatePLExcelBuffer(plData);
        return bufferData;
    }

    async downloadBalanceSheetExcel(
        user: User,
        query: AccountReportQuery
    ) {
        const bsData = await this.accountReportService.generateBalanceSheetReport(query, user);
        const bufferData = await this.accountExcelService.generateBSExcelBuffer(bsData);
        return bufferData;
    }

    async downloadTrialBalancePdf(
        user: User,
        query: AccountReportQuery
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');
        const trialBalanceData = await this.accountReportService.generateTrialBalance(query, user);
        const trialBalanceDataMapped = trialBalancePdfDataMapper(user, backendUrl, trialBalanceData);
        const buf = await this.accountPdfService.trialBalancePdfGenerator(trialBalanceDataMapped);
        return buf;
    }

    async downloadBalanceSheetPdf(
        user: User,
        query: AccountReportQuery
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');
        const data = await this.accountReportService.generateBalanceSheetReport(query, user);
        const buf = await this.accountPdfService.balanceSheetPdfGenerator(data, backendUrl, user);
        return buf;
    }

    async downloadProfitLossPdf(
        user: User,
        query: AccountReportQuery
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');
        const data = await this.accountReportService.generateProfitAndLossReport(query, user);
        const buf = await this.accountPdfService.profitAndLossPdfGenerator(data, backendUrl, user);
        return buf;
    }
}