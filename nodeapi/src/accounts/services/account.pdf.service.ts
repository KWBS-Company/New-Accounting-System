import { Injectable } from "@nestjs/common";
import { CommonService } from "src/common/utils/common";
import { Transaction } from "../entities/transactions.entity";
import { User } from "src/auth/entities/user.entity";
import { AccountType } from "../types/account_types.enum";

@Injectable()
export class AccountPDFService {
    constructor(private readonly commonService: CommonService) { }

    async journalVoucherPdfGenerator(txnData: Transaction, backendUrl: string, user: User) {

        const totalDebit = txnData.lines.reduce((s, l) => s + Number(l.debit), 0);
        const totalCredit = txnData.lines.reduce((s, l) => s + Number(l.credit), 0);
        const company = user.userRoles[0].customer;
        const context = {
            backendUrl: backendUrl,
            company: {
                ...user.userRoles[0].customer,   // name, companyLogo, vatNumber, panNumber,
                // fiscalStartDate, fiscalEndDate,
                // transactionCurrencyCode
                phone: company.companyPhone,
                email: company.companyEmail,
                website: company.companyWebsite,
                address: company.companyAddress,
            },
            txn: {
                ...txnData,
                totalDebit,
                totalCredit,
                isBalanced: totalDebit === totalCredit,
            },
        };
        const html = await this.commonService.generateTemplate(
            'journal-voucher.hbs',
            context,
        );
        const pdfBuffer = await this.commonService.pdfGenerateByHtml(html);
        return pdfBuffer;
    }

    async trialBalancePdfGenerator(trialBalance: any[], backendUrl: string, user: User) {
        const company = user.userRoles[0].customer;
        const debit = trialBalance.reduce((prev, curr) => prev + Number(curr.totalDebit), 0);
        const credit = trialBalance.reduce((prev, curr) => prev + Number(curr.totalCredit), 0);
        const context = {
            company: {
                logoUrl: company.companyLogo ? `${backendUrl}${company.companyLogo}` : null,
                phone: company.companyLogo,
                email: company.companyEmail,
                website: company.companyWebsite,
                address: company.companyAddress,
                pan: company.panNumber,
                vat: company.vatNumber
            },
            fiscalYear: {
                start: new Date(company.fiscalStartDate).toLocaleDateString(),
                end: new Date(company.fiscalEndDate).toLocaleDateString()
            },
            reportDate: new Date().toLocaleDateString(),
            asOf: new Date().toLocaleDateString(),
            accounts: trialBalance,
            totals: {
                debit: debit,
                credit: credit
            },
            currency: company.transactionCurrencyCode,
            isMatched: debit === credit
        }

        const html = await this.commonService.generateTemplate(
            'trial-balance.hbs',
            context,
        );
        const pdfBuffer = await this.commonService.pdfGenerateByHtml(html);
        return pdfBuffer;

    }

    async balanceSheetPdfGenerator(bs: {
        items: any[];
        summary: {
            totalAssets: number;
            totalLiabilities: number;
            totalEquity: number;
            totalLiabilitiesAndEquity: number;
        };
    }, backendUrl: string, user: User) {
        const company = user.userRoles[0].customer;
        const equities = bs.items.find(it => it.accountType === AccountType.EQUITY);
        const assets = bs.items.find(it => it.accountType === AccountType.ASSET);
        const liabilities = bs.items.find(it => it.accountType === AccountType.LIABILITY);
        const context = {
            company: {
                companyLogo: company.companyLogo ? `${backendUrl}${company.companyLogo}` : null,
                phone: company.companyLogo,
                email: company.companyEmail,
                website: company.companyWebsite,
                address: company.companyAddress,
                panNumber: company.panNumber,
                vatNumber: company.vatNumber,
                transactionCurrencyCode: company.transactionCurrencyCode

            },
            fiscalYear: {
                start: new Date(company.fiscalStartDate).toLocaleDateString(),
                end: new Date(company.fiscalEndDate).toLocaleDateString()
            },
            reportDate: new Date().toLocaleDateString(),
            asOf: new Date().toLocaleDateString(),
            equity: equities,
            liabilities,
            assets,
            summary: bs.summary,
            currency: company.transactionCurrencyCode,
            isMatched: bs.summary.totalAssets === bs.summary.totalLiabilitiesAndEquity
        }

        const html = await this.commonService.generateTemplate(
            'balance-sheet.hbs',
            context,
        );
        const pdfBuffer = await this.commonService.pdfGenerateByHtml(html);
        return pdfBuffer;

    }
}