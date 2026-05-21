import { TransactionRule, TransactionType } from "../types/transaction_types.enum";
// -------------------------------------------------------
// TRANSACTION RULES MAP
//
// For each transaction type, define which accounts are
// affected and whether they INCREASE or DECREASE.
//
// buildLine() will automatically resolve Debit/Credit
// based on the account type (Asset/Expense → Debit increases,
// Liability/Equity/Revenue → Credit increases).
//
// To add a new transaction:
//   1. Add value to TransactionType enum
//   2. Add a rule here with accountKey + increase flag
//   3. Pass the matching accounts when calling generateTransaction()
// -------------------------------------------------------


export const TRANSACTION_RULES: Record<TransactionType, TransactionRule> = {

    // ---------------------------------------------------
    // Owner deposits capital into business bank account
    //   Dr  Bank           (Asset ↑)
    //   Cr  Owner Equity   (Equity ↑)
    // ---------------------------------------------------
    [TransactionType.CAPITAL_DEPOSIT]: {
        description: 'Owner deposits capital into business',
        lines: [
            { accountKey: 'BANK', increase: true },
            { accountKey: 'OWNER_EQUITY', increase: true },
        ],
    },

    // ---------------------------------------------------
    // Customer pays outstanding invoice
    //   Dr  Bank                    (Asset ↑)
    //   Cr  Accounts Receivable     (Asset ↓)
    // ---------------------------------------------------
    [TransactionType.CUSTOMER_PAYMENT]: {
        description: 'Customer pays outstanding invoice',
        lines: [
            { accountKey: 'BANK', increase: true },
            { accountKey: 'ACCOUNTS_RECEIVABLE', increase: false },
        ],
    },

    // ---------------------------------------------------
    // Transfer physical cash into bank
    //   Dr  Bank   (Asset ↑)
    //   Cr  Cash   (Asset ↓)
    // ---------------------------------------------------
    [TransactionType.CASH_TO_BANK]: {
        description: 'Deposit cash into bank',
        lines: [
            { accountKey: 'BANK', increase: true },
            { accountKey: 'CASH', increase: false },
        ],
    },

    // ---------------------------------------------------
    // Pay an expense (e.g. rent, salary) from bank
    //   Dr  Expense Account   (Expense ↑)
    //   Cr  Bank              (Asset ↓)
    // ---------------------------------------------------
    [TransactionType.EXPENSE_PAYMENT]: {
        description: 'Pay expense from bank',
        lines: [
            { accountKey: 'EXPENSE_ACCOUNT', increase: true },
            { accountKey: 'BANK', increase: false },
        ],
    },

    // ---------------------------------------------------
    // Record a sale / service revenue
    //   Dr  Bank / Accounts Receivable   (Asset ↑)
    //   Cr  Sales Revenue                (Revenue ↑)
    // ---------------------------------------------------
    [TransactionType.SALES_REVENUE]: {
        description: 'Record sales revenue',
        lines: [
            { accountKey: 'ACCOUNTS_RECEIVABLE', increase: true },
            { accountKey: 'SALES_REVENUE', increase: true },
        ],
    },

    // ---------------------------------------------------
    // Purchase inventory/goods on credit
    //   Dr  Inventory         (Asset ↑)
    //   Cr  Accounts Payable  (Liability ↑)
    // ---------------------------------------------------
    [TransactionType.PURCHASE_ON_CREDIT]: {
        description: 'Purchase inventory on credit',
        lines: [
            { accountKey: 'INVENTORY', increase: true },
            { accountKey: 'ACCOUNTS_PAYABLE', increase: true },
        ],
    },

    // ---------------------------------------------------
    // Pay supplier outstanding balance
    //   Dr  Accounts Payable  (Liability ↓)
    //   Cr  Bank              (Asset ↓)
    // ---------------------------------------------------
    [TransactionType.PAY_SUPPLIER]: {
        description: 'Pay supplier from bank',
        lines: [
            { accountKey: 'ACCOUNTS_PAYABLE', increase: false },
            { accountKey: 'BANK', increase: false },
        ],
    },

    // ---------------------------------------------------
    // Withdraw cash from bank
    //   Dr  Cash   (Asset ↑)
    //   Cr  Bank   (Asset ↓)
    // ---------------------------------------------------
    [TransactionType.CASH_WITHDRAWAL]: {
        description: 'Withdraw cash from bank',
        lines: [
            { accountKey: 'CASH', increase: true },
            { accountKey: 'BANK', increase: false },
        ],
    },

    // ---------------------------------------------------
    // Receive a loan from bank/lender
    //   Dr  Bank          (Asset ↑)
    //   Cr  Loan Payable  (Liability ↑)
    // ---------------------------------------------------
    [TransactionType.LOAN_RECEIVED]: {
        description: 'Receive loan from lender',
        lines: [
            { accountKey: 'BANK', increase: true },
            { accountKey: 'LOAN_PAYABLE', increase: true },
        ],
    },

    // ---------------------------------------------------
    // Repay loan installment
    //   Dr  Loan Payable  (Liability ↓)
    //   Cr  Bank          (Asset ↓)
    // ---------------------------------------------------
    [TransactionType.LOAN_REPAYMENT]: {
        description: 'Repay loan installment',
        lines: [
            { accountKey: 'LOAN_PAYABLE', increase: false },
            { accountKey: 'BANK', increase: false },
        ],
    },
};