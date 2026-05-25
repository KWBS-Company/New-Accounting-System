import { AccountKey } from "../services/transaction_rules.service";

// important thing
export enum TransactionType {
    MONTHLY_DEPOSIT = 'MONTHLY_DEPOSIT',
    LATE_FINE_DEPOSIT = 'LATE_FINE_DEPOSIT',
    INTEREST_RECIEVED_FROM_BANK = 'INTEREST_RECIEVED_FROM_BANK',
    INTEREST_RECIEVED_OF_LOAN = 'INTEREST_RECIEVED_OF_LOAN',
    REFUND_MEMBER= 'REFUND_MEMBER',
    AGM_EXPENSES ='AGM_ EXPENSES',
    OFFICE_EQUIPMENT = 'OFFICE_EQUIPMENT',
    FOOD_EXPENSES = 'FOOD_EXPENSES',
    LOAN_TAKEN = 'INTEREST_TAKEN'
}


export interface TransactionLineRule {
    accountKey: AccountKey;
    increase: boolean;
}

export interface TransactionRule {
    description: string;
    lines: TransactionLineRule[];
}