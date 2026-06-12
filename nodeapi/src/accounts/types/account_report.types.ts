// ─────────────────────────────────────────────────────────────────────────────
//  Domain types
// ─────────────────────────────────────────────────────────────────────────────

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
    balance:string;
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