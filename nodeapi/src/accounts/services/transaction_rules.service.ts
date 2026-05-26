// import {
//     TransactionRule,
//     TransactionType,
//   } from "../types/transaction_types.enum";
  
  
//   // =======================================================
//   // POSTING ROLES
//   // =======================================================
  
//   export enum AccountKey {
  
//     // -----------------------------------------
//     // CASH / BANK
//     // -----------------------------------------
  
//     BANK_ACCOUNT = 'BANK_ACCOUNT',
  
  
//     // -----------------------------------------
//     // MEMBER
//     // -----------------------------------------
  
//     MEMBER_SAVINGS_ACCOUNT =
//       'MEMBER_SAVINGS_ACCOUNT',
  
  
//     // -----------------------------------------
//     // REVENUE
//     // -----------------------------------------
  
//     FINE_REVENUE_ACCOUNT =
//       'FINE_REVENUE_ACCOUNT',
  
//     INTEREST_INCOME_ACCOUNT =
//       'INTEREST_INCOME_ACCOUNT',
  
//     LOAN_INTEREST_REVENUE_ACCOUNT =
//       'LOAN_INTEREST_REVENUE_ACCOUNT',
  
  
//     // -----------------------------------------
//     // EXPENSES
//     // -----------------------------------------
  
//     AGM_EXPENSE_ACCOUNT =
//       'AGM_EXPENSE_ACCOUNT',
  
//     FOOD_EXPENSE_ACCOUNT =
//       'FOOD_EXPENSE_ACCOUNT',
  
  
//     // -----------------------------------------
//     // ASSET
//     // -----------------------------------------
  
//     OFFICE_EQUIPMENT_ACCOUNT =
//       'OFFICE_EQUIPMENT_ACCOUNT',
  
  
//     // -----------------------------------------
//     // LIABILITY
//     // -----------------------------------------
  
//     LOAN_PAYABLE_ACCOUNT =
//       'LOAN_PAYABLE_ACCOUNT',
//   }
  
  
//   // =======================================================
//   // TRANSACTION RULES MAP
//   // =======================================================
  
//   export const TRANSACTION_RULES:
//   Record<TransactionType, TransactionRule> = {
  
//     // ---------------------------------------------------
//     // Monthly Deposit
//     // Dr Bank
//     // Cr Member Savings
//     // ---------------------------------------------------
  
//     [TransactionType.MONTHLY_DEPOSIT]: {
//       description: 'Monthly member deposit',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.MEMBER_SAVINGS_ACCOUNT,
  
//           increase: true,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Late Fine Deposit
//     // Dr Bank
//     // Cr Fine Revenue
//     // ---------------------------------------------------
  
//     [TransactionType.LATE_FINE_DEPOSIT]: {
//       description: 'Late fine deposit',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.FINE_REVENUE_ACCOUNT,
  
//           increase: true,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Interest Received From Bank
//     // Dr Bank
//     // Cr Interest Income
//     // ---------------------------------------------------
  
//     [TransactionType.INTEREST_RECIEVED_FROM_BANK]: {
//       description: 'Interest received from bank',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.INTEREST_INCOME_ACCOUNT,
  
//           increase: true,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Interest Received Of Loan
//     // Dr Bank
//     // Cr Loan Interest Revenue
//     // ---------------------------------------------------
  
//     [TransactionType.INTEREST_RECIEVED_OF_LOAN]: {
//       description: 'Interest received of loan',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.LOAN_INTEREST_REVENUE_ACCOUNT,
  
//           increase: true,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Refund Member
//     // Dr Member Savings
//     // Cr Bank
//     // ---------------------------------------------------
  
//     [TransactionType.REFUND_MEMBER]: {
//       description: 'Refund member amount',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.MEMBER_SAVINGS_ACCOUNT,
  
//           increase: false,
//         },
  
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: false,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // AGM Expenses
//     // Dr AGM Expense
//     // Cr Bank
//     // ---------------------------------------------------
  
//     [TransactionType.AGM_EXPENSES]: {
//       description: 'AGM expenses payment',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.AGM_EXPENSE_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: false,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Office Equipment Purchase
//     // Dr Office Equipment Asset
//     // Cr Bank
//     // ---------------------------------------------------
  
//     [TransactionType.OFFICE_EQUIPMENT]: {
//       description: 'Office equipment purchase',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.OFFICE_EQUIPMENT_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: false,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Food Expenses
//     // Dr Food Expense
//     // Cr Bank
//     // ---------------------------------------------------
  
//     [TransactionType.FOOD_EXPENSES]: {
//       description: 'Food expenses payment',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.FOOD_EXPENSE_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: false,
//         },
//       ],
//     },
  
  
//     // ---------------------------------------------------
//     // Loan Taken
//     // Dr Bank
//     // Cr Loan Payable
//     // ---------------------------------------------------
  
//     [TransactionType.LOAN_TAKEN]: {
//       description: 'Loan taken from lender',
  
//       lines: [
//         {
//           accountKey:
//             AccountKey.BANK_ACCOUNT,
  
//           increase: true,
//         },
  
//         {
//           accountKey:
//             AccountKey.LOAN_PAYABLE_ACCOUNT,
  
//           increase: true,
//         },
//       ],
//     },
//   };