import { Account } from "../entities/accounts.entity";
import { LedgerData } from "../types/account.types";

export const ledgerDataMapper = (account: Account, openingBalance: number): LedgerData => {
    const transactionLines = account.lines.map(l => {
        return {
            transactionDate: new Date(l.transaction.transactionDate).toISOString(),
            fiscalYear: l.transaction.fiscalYear.name,
            fiscalYearId: l.transaction.fiscalYear.id,
            startDate: new Date(l.transaction.fiscalYear.startDate).toISOString(),
            endDate: new Date(l.transaction.fiscalYear.endDate).toISOString(),
            debit: l.debit,
            credit: l.credit,
            balance: l.debit - l.credit,
            serialNumber: l.transaction.serialNumber,
            description: l.description
        }
    });

    const totalBalance = transactionLines.reduce((sum, l) => sum + l.balance, 0);
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
            closingBalance: totalBalance + openingBalance
        }
    }
}