import { CompanyInfo, FiscalYear } from './account_company.types';

export interface TransactionType {
    name: string;
}

export interface JournalLine {
    account: { name: string };
    description?: string;
    debit: number;
    credit: number;
}

export interface JournalTransaction {
    serialNumber: string;
    transactionDate: string; // ISO date string e.g. "2024-12-31"
    reference?: string;
    transactionType: TransactionType;
    lines: JournalLine[];
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
}

export interface JournalVoucherData {
    company: CompanyInfo & {
        transactionCurrencyCode?: string;
        fiscalStartDate?: string;
        fiscalEndDate?: string;
    };
    fiscalYear?: FiscalYear;
    txn: JournalTransaction;
}
