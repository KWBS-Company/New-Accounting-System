import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, IsNull, Repository } from "typeorm";
import { CustomerFiscalYear } from "./entities/company.fiscal.entity";
import { FiscalYearStatus } from "./types/fiscal_years.status.types";
import { Account } from "src/accounts/entities/accounts.entity";
import { TransactionLine } from "src/accounts/entities/transaction_lines.entity";
import { AccountType } from "src/accounts/types/account_types.enum";
import { Transaction } from "src/accounts/entities/transactions.entity";
import { CommonService } from "src/common/utils/common";
import { User } from "src/auth/entities/user.entity";

@Injectable()
export class FiscalYearService {
  constructor(@InjectRepository(CustomerFiscalYear)
  private readonly customerFiscalYearRepository: Repository<CustomerFiscalYear>,
    private readonly dataSource: DataSource,
    private readonly commonService: CommonService) { }

  async save(data: Partial<CustomerFiscalYear>): Promise<CustomerFiscalYear> {
    return this.customerFiscalYearRepository.save(data);
  }
  async update(id: string, data: Partial<CustomerFiscalYear>) {
    await this.customerFiscalYearRepository.update(id, data);
  }
  async create(data: Partial<CustomerFiscalYear>): Promise<CustomerFiscalYear> {
    const customer = this.customerFiscalYearRepository.create(data);
    return this.customerFiscalYearRepository.save(customer);
  }

  async findById(id: string): Promise<CustomerFiscalYear | null> {
    return this.customerFiscalYearRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<CustomerFiscalYear[]> {
    return this.customerFiscalYearRepository.find();
  }

  async findAllByCustomerId(customerId: string): Promise<CustomerFiscalYear[]> {
    return this.customerFiscalYearRepository.find({ where: { deletedAt: IsNull(), customerId: customerId } });
  }

  async patchCurrentFiscalYear(user: User) {
    const customerId = user.userRoles[0].customerId;
    const fiscalYrStartDate = user.userRoles[0].customer.fiscalStartDate;
    await this.dataSource.transaction(async (manager) => {
      const currentFiscalYear = await manager.findOne(CustomerFiscalYear, { where: { deletedAt: IsNull(), customerId: customerId, status: FiscalYearStatus.OPEN }, relations: ['transactions'] });
      if (!currentFiscalYear) {
        throw new BadRequestException('Fiscal year has been set up yet.')
      }

      const transactionIds = currentFiscalYear.transactions.map(t => t.id);
      const transactionLines = await manager.find(TransactionLine, { where: { deletedAt: IsNull(), transactionId: In(transactionIds) }, relations: ['account'] });

      const incomes = transactionLines.filter(tl => tl.account.accountType === AccountType.REVENUE);
      const liabilities = transactionLines.filter(tl => tl.account.accountType === AccountType.LIABILITY);
      const expenses = transactionLines.filter(tl => tl.account.accountType === AccountType.EXPENSE);
      const assets = transactionLines.filter(tl => tl.account.accountType === AccountType.ASSET);
      const equities = transactionLines.filter(tl => tl.account.accountType === AccountType.EQUITY);

      const dataWithBalancePL =
        [...incomes, ...expenses].map((row) => {
          let balance = 0;
          if (row.account.accountType === AccountType.REVENUE) {
            balance = Number(row.credit) - Number(row.debit);
          }
          if (row.account.accountType === AccountType.EXPENSE) {
            balance = Number(row.debit) - Number(row.credit);
          }

          return {
            ...row,
            balance,
          };
        });

      const totalRevenue = dataWithBalancePL.filter((x) => x.account.accountType === AccountType.REVENUE).reduce((sum, x) => sum + Number(x.balance), 0);
      const totalExpense = dataWithBalancePL.filter((x) => x.account.accountType === AccountType.EXPENSE).reduce((sum, x) => sum + Number(x.balance), 0);
      const netProfit = totalRevenue - totalExpense;


      const dataWithBalanceBS =
        [...equities, ...assets, ...liabilities].map((row) => {

          let balance = 0;
          if (row.account.accountType === AccountType.ASSET) {
            balance = Number(row.debit) - Number(row.credit);
          }

          if (row.account.accountType === AccountType.LIABILITY || row.account.accountType === AccountType.EQUITY) {
            balance = Number(row.credit) - Number(row.debit);
          }

          return {
            ...row,
            balance,
          };
        });

      const totalAssets = dataWithBalanceBS.filter((x) => x.account.accountType === AccountType.ASSET).reduce((sum, x) => sum + Number(x.balance), 0);

      const totalLiabilities = dataWithBalanceBS.filter((x) => x.account.accountType === AccountType.LIABILITY).reduce((sum, x) => sum + Number(x.balance), 0);

      const totalEquity = dataWithBalanceBS.filter((x) => x.account.accountType === AccountType.EQUITY).reduce((sum, x) => sum + Number(x.balance), 0);


      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;
      if (totalLiabilitiesAndEquity !== totalAssets) {
        throw new BadRequestException('Cannot close fiscal yr since current liabilities and assets is not equal');
      }

      const parentGeneralReserve = await manager.findOne(Account, { where: { deletedAt: IsNull(), customerId, code: 'GR0001' } });
      if (!parentGeneralReserve) {
        throw new BadRequestException('General Reserve account not found');
      }
      let retAccount: Account;
      let currentYearEarningAccount = await manager.findOne(Account, { where: { deletedAt: IsNull(), customerId, code: 'CYE0001' } });

      if (!currentYearEarningAccount) {
        const newAccount = manager.create(Account, {
          customerId: customerId,
          name: 'Current Year Earnings',
          code: 'CYE0001',
          parentId: null,
          accountType: AccountType.EQUITY
        })

        retAccount = await manager.save(Account, newAccount);
      } else {
        retAccount = currentYearEarningAccount;
      }

      const newTransaction = manager.create(Transaction, { customerId: customerId, fiscalYearId: currentFiscalYear.id, amount: Math.abs(netProfit), transactionDate: new Date() });


      if (netProfit > 0) {
        // profit transaction
        // dr=> CYE
        //  cr=> GR
        const retTransaction = await manager.save(Transaction, newTransaction);
        const CYELine = manager.create(TransactionLine, { transactionId: retTransaction.id, debit: Math.abs(netProfit), credit: 0, description: 'Net profit transferred to General Reserve account', accountId: retAccount.id });
        const GA = manager.create(TransactionLine, { transactionId: retTransaction.id, debit: 0, credit: Math.abs(netProfit), description: 'Net profit transferred to General Reserve account', accountId: parentGeneralReserve.id });

        await manager.save(TransactionLine, CYELine);
        await manager.save(TransactionLine, GA);
      } else if (netProfit < 0) {
        // loss
        const retTransaction = await manager.save(Transaction, newTransaction);
        const CYELine = manager.create(TransactionLine, { transactionId: retTransaction.id, debit: 0, credit: Math.abs(netProfit), description: 'Net loss transferred to General Reserve account', accountId: retAccount.id });
        const GA = manager.create(TransactionLine, { transactionId: retTransaction.id, debit: Math.abs(netProfit), credit: 0, description: 'Net loss transferred to General Reserve account', accountId: parentGeneralReserve.id });

        await manager.save(TransactionLine, CYELine);
        await manager.save(TransactionLine, GA);

      }
      const currentDate = new Date();
      const fiscalYrEndDate = new Date(currentFiscalYear.endDate);
      fiscalYrEndDate.setHours(23, 59, 59, 999);
      if (currentDate < fiscalYrEndDate) {
        throw new BadRequestException('Cannot closed current fiscal yr since end date is not crossed');
      }

      await manager.update(CustomerFiscalYear, currentFiscalYear.id, { status: FiscalYearStatus.CLOSED });


      // create new fiscal yr

      const { startDate, endDate, name } = this.commonService.getFiscalYearDates(fiscalYrStartDate);

      const newFY = manager.create(CustomerFiscalYear, { customerId, name, startDate, endDate, status: FiscalYearStatus.OPEN });

      await manager.save(CustomerFiscalYear, newFY);
    })



  }
}