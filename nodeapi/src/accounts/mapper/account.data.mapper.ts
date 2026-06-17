import { Account } from "../entities/accounts.entity";

export const ledgerDataMapper = (account: Account) => {
    const transactionLines = account.lines.map(l => {
        return {
            transactionDate: l.transaction.transactionDate,
            fiscalYear: l.transaction.fiscalYear.name,
            fiscalYearId: l.transaction.fiscalYear.id,
            startDate: l.transaction.fiscalYear.startDate,
            endDate: l.transaction.fiscalYear.endDate,
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
        name: account.name,
        accountType: account.accountType,
        code: account.code,
        lines: transactionLines,
        summary: {
            totalBalance,
            totalDebit,
            totalCredit,
        }
    }
}