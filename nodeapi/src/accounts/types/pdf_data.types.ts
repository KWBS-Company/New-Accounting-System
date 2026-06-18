// ─────────────────────────────────────────────────────────────────────────────
//  Domain types
// ─────────────────────────────────────────────────────────────────────────────

import { LedgerBasic, LedgerLine, LedgerSummary } from "./account.types";

export interface CompanyInfo {
    name: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    vatNumber?: string;
    panNumber?: string;
    /** Pass a pre-embedded PDFImage if you want a real logo rendered */
    logoImage?: string
}

export interface FiscalYear {
    start: string;
    end: string;
}

export interface AccountRow {
    code: string;
    name: string;
    balance: string;
    accountType: string;
    debit: string;
    credit: string;
}

export interface Totals {
    debit: string;
    credit: string;
}

export interface TrialBalanceData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
    reportDate: string;
    asOf: string;
    currency?: string;
    accounts: AccountRow[];
    totals: Totals;
    isMatched: boolean;
}


// ─────────────────────────────────────────────────────────────────────────────
//  P&L domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface PLLineItem {
    code: string;
    name: string;
    accountType: string;
    /** Numeric value – positive number, formatting handled by renderer */
    balance: number;
}

export interface PLSummary {
    totalRevenue: number;
    totalExpense: number;
    /** Absolute value of net profit/loss */
    netProfitAbs: number;
}

export interface ProfitLossData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
    reportDate: string;
    asOf: string;
    currency?: string;
    revenues: PLLineItem[];
    expenses: PLLineItem[];
    summary: PLSummary;
    /** true = profit, false = loss */
    isProfit: boolean;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Journal Voucher domain types
// ─────────────────────────────────────────────────────────────────────────────

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
    transactionDate: string;   // ISO date string e.g. "2024-12-31"
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
// ─────────────────────────────────────────────────────────────────────────────
//  Balance Sheet domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface BSLineItem {
    code: string;
    name: string;
    accountType: string;
    balance: number;
}

export interface BSSummary {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    currentYearNetPL: number;
}

export interface BalanceSheetData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
    reportDate: string;
    asOf: string;
    currency?: string;
    assets: BSLineItem[];
    liabilities: BSLineItem[];
    equity: BSLineItem[];
    summary: BSSummary;
    isBalanced: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ledger
// ─────────────────────────────────────────────────────────────────────────────

export interface LedgerPDFData {
    company: CompanyInfo;
    fiscalYear: FiscalYear;
    reportDate: string;
    fromDate: string;
    toDate: string;
    currency: string;
    summary: LedgerSummary;
    lines: LedgerLine[];
    ledger: LedgerBasic;
}
