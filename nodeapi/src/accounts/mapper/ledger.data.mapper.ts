import { User } from 'src/auth/entities/user.entity';
import { Account } from '../entities/accounts.entity';
import { LedgerData, LedgerPDFData } from '../types/ledger.types';
import { FiscalYearStatus } from 'src/customer/types/fiscal_years.status.types';
import { BadRequestException } from '@nestjs/common';

export const ledgerDataMapper = (
    account: Account,
    openingBalance: number,
): LedgerData => {
    const transactionLines = account.lines.map((l) => {
        return {
            transactionDate: new Date(
                l.transaction.transactionDate,
            ).toISOString(),
            fiscalYear: l.transaction.fiscalYear.name,
            fiscalYearId: l.transaction.fiscalYear.id,
            startDate: new Date(
                l.transaction.fiscalYear.startDate,
            ).toISOString(),
            endDate: new Date(l.transaction.fiscalYear.endDate).toISOString(),
            debit: l.debit,
            credit: l.credit,
            balance: l.debit - l.credit,
            serialNumber: l.transaction.serialNumber,
            description: l.description,
        };
    });

    const totalBalance = transactionLines.reduce(
        (sum, l) => sum + l.balance,
        0,
    );
    const totalDebit = transactionLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = transactionLines.reduce((sum, l) => sum + l.credit, 0);
    return {
        ledger: {
            id: account.id,
            name: account.name,
            accountType: account.accountType,
            code: account.code,
        },
        lines: transactionLines,
        summary: {
            openingBalance,
            totalBalance: totalBalance,
            totalDebit,
            totalCredit,
            closingBalance: totalBalance + openingBalance,
        },
    };
};

export const ledgerPdfDataMapper = (
    user: User,
    backendUrl: string,
    ledger: LedgerData,
) => {
    const company = user.userRoles[0].customer;
    const currentFiscalYr = company.fiscalYears.find(
        (fy) => fy.status === FiscalYearStatus.OPEN,
    );
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const context: LedgerPDFData = {
        company: {
            name: company.companyName,
            logoImage: company.companyLogo
                ? `${backendUrl}${company.companyLogo}`
                : undefined,
            phone: company.companyPhone,
            email: company.companyEmail,
            website: company.companyWebsite,
            address: company.companyAddress,
            panNumber: company.panNumber,
            vatNumber: company.vatNumber,
        },
        fiscalYear: {
            start: new Date(currentFiscalYr.startDate).toLocaleDateString(),
            end: new Date(currentFiscalYr.endDate).toLocaleDateString(),
        },
        reportDate: new Date().toLocaleDateString(),
        fromDate: new Date(currentFiscalYr.startDate).toLocaleDateString(),
        toDate: new Date(currentFiscalYr.endDate).toLocaleDateString(),
        currency: company.transactionCurrencyCode,
        ledger: ledger.ledger,
        summary: ledger.summary,
        lines: ledger.lines,
    };

    return context;
};
