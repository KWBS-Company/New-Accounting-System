// important thing
export enum TransactionType {
    CAPITAL_DEPOSIT = 'CAPITAL_DEPOSIT',
    CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT',
    CASH_TO_BANK = 'CASH_TO_BANK',
    EXPENSE_PAYMENT = 'EXPENSE_PAYMENT',
    SALES_REVENUE = 'SALES_REVENUE',
    PURCHASE_ON_CREDIT = 'PURCHASE_ON_CREDIT',
    PAY_SUPPLIER = 'PAY_SUPPLIER',
    CASH_WITHDRAWAL = 'CASH_WITHDRAWAL',
    LOAN_RECEIVED = 'LOAN_RECEIVED',
    LOAN_REPAYMENT = 'LOAN_REPAYMENT',
}


export interface TransactionLineRule {
    accountKey: string;
    increase: boolean;
}

export interface TransactionRule {
    description: string;
    lines: TransactionLineRule[];
}