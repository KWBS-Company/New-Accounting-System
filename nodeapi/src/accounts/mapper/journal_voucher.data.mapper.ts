import { User } from 'src/auth/entities/user.entity';
import { JournalVoucherData } from '../types/journal_voucher.types';
import { Transaction } from '../entities/transactions.entity';
import { FiscalYearStatus } from 'src/customer/types/fiscal_years.status.types';
import { BadRequestException } from '@nestjs/common';

export const JVPdfDataMapper = (
    user: User,
    backendUrl: string,
    txnData: Transaction,
) => {
    const totalDebit = txnData.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = txnData.lines.reduce((s, l) => s + Number(l.credit), 0);
    const company = user.userRoles[0].customer;
    const currentFiscalYr = company.fiscalYears.find(
        (fy) => fy.status === FiscalYearStatus.OPEN,
    );
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const context: JournalVoucherData = {
        company: {
            logoImage: company.companyLogo
                ? `${backendUrl}${company.companyLogo}`
                : undefined,
            name: company.companyName,
            phone: company.companyPhone,
            email: company.companyEmail,
            website: company.companyWebsite,
            address: company.companyAddress,
            panNumber: company.panNumber,
            vatNumber: company.vatNumber,
        },
        txn: {
            serialNumber: txnData.serialNumber.toString(),
            transactionDate: txnData.transactionDate.toDateString(), // ISO date string e.g. "2024-12-31"
            reference: txnData.reference,
            transactionType: { name: txnData.lines[0].description },
            lines: txnData.lines.map((l) => ({
                account: { name: l.account.name },
                description: l.description,
                debit: l.debit,
                credit: l.credit,
            })),
            totalDebit: totalDebit,
            totalCredit: totalCredit,
            isBalanced: totalDebit === totalCredit,
        },
    };
    return context;
};
