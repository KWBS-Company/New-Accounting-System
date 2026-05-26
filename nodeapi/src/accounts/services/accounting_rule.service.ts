// import { Injectable, BadRequestException } from '@nestjs/common';
// import { LedgerHeadType } from '../types/account_types.enum';
// import { LedgerHead } from '../entities/accounts.entity';
// import { TransactionType } from '../types/transaction_types.enum';
// import { TRANSACTION_RULES } from './transaction_rules.service';
// import { LedgerHeadRepository } from '../repositories/account_heads.repo';

// export interface RawJournalLine {
//   ledgerHeadId: string;
//   ledgerCode: string;
//   debit: number;
//   credit: number;
//   description?: string;
// }

// @Injectable()
// export class AccountingRuleEngineService {

//   constructor(private readonly ledgerHeadRepository:LedgerHeadRepository){

//   }

//   // ----------------------------
//   // Account type → normal side
//   // ----------------------------

//   private readonly debitIncreaseTypes = [
//     LedgerHeadType.ASSET,
//     LedgerHeadType.EXPENSE,
//   ];

//   // ----------------------------
//   // Build a single journal line
//   // ----------------------------

//   private buildLine(params: {
//     ledgerHead: LedgerHead;
//     amount: number;
//     increase: boolean;
//     description?: string;
//   }): RawJournalLine {

//     const { ledgerHead, amount, increase, description } = params;

//     let debit = 0;
//     let credit = 0;

//     const increasesWithDebit = this.debitIncreaseTypes.includes(ledgerHead.ledgerHeadType);

//     if (increase) {
//       increasesWithDebit ? (debit = amount) : (credit = amount);
//     } else {
//       increasesWithDebit ? (credit = amount) : (debit = amount);
//     }

//     return {
//       ledgerHeadId:   ledgerHead.id,
//       ledgerCode: ledgerHead.code,
//       debit,
//       credit,
//       description,
//     };
//   }

//   // ----------------------------
//   // Generate journal lines
//   // from transaction type + accounts map
//   // ----------------------------

//   async generateJournalLines(params: {
//     transactionType: TransactionType;
//     amount: number;
//     description?: string;
//   }) {

//     const { transactionType, amount, description } = params;

//     // Lookup rule from the map
//     const rule = TRANSACTION_RULES[transactionType];

//     if (!rule) {
//       throw new BadRequestException(
//         `Unsupported transaction type: ${transactionType}`,
//       );
//     }

//     // Build each line from the rule
//     const lines = await Promise.all(rule.lines.map(async(lineRule) => {
//       // const ledgerHead = await this.
//       const ledgerHead = await this.ledgerHeadRepository.findByAccountKey(lineRule.accountKey)
//       if (!ledgerHead) {
//         throw new BadRequestException(
//           `Account key "${lineRule.accountKey}" not found in provided accounts map.` +
//           ` Required by transaction type: ${transactionType}`,
//         );
//       }

//       return this.buildLine({
//         ledgerHead,
//         amount,
//         increase: lineRule.increase,
//         description,
//       });
//     }));

//     // Validate before returning
//     this.validateBalance(lines);

//     return lines;
//   }

//   // ----------------------------
//   // Validate double-entry balance
//   // ----------------------------

//   validateBalance(lines: RawJournalLine[]): void {
//     const totalDebit  = lines.reduce((sum, l) => sum + Number(l.debit),  0);
//     const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

//     if (Math.abs(totalDebit - totalCredit) > 0.001) {
//       throw new BadRequestException(
//         `Journal entry is not balanced. ` +
//         `Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`,
//       );
//     }
//   }

//   // ----------------------------
//   // Get required account keys
//   // for a given transaction type
//   // ----------------------------

//   getRequiredAccountKeys(transactionType: TransactionType): string[] {
//     const rule = TRANSACTION_RULES[transactionType];
//     if (!rule) return [];
//     return rule.lines.map((l) => l.accountKey);
//   }
// }