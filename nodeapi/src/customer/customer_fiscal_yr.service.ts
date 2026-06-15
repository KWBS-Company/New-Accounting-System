import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { CustomerFiscalYear } from "./entities/company.fiscal.entity";
import { FiscalYearStatus } from "./types/fiscal_years.status.types";
import { Account } from "src/accounts/entities/accounts.entity";

@Injectable()
export class FiscalYearService {
  constructor(@InjectRepository(CustomerFiscalYear)
  private readonly customerFiscalYearRepository: Repository<CustomerFiscalYear>,
    private readonly dataSource: DataSource) { }

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

  async patchCurrentFiscalYear(customerId: string) {

    await this.dataSource.transaction(async (manager) => {
      const currentFiscalYear = await manager.findOne(CustomerFiscalYear, { where: { deletedAt: IsNull(), customerId: customerId, status: FiscalYearStatus.OPEN } });
      if (!currentFiscalYear) {
        throw new BadRequestException('Fiscal year has been set up yet.')
      }

      currentFiscalYear.status = FiscalYearStatus.CLOSED;
      await manager.save(CustomerFiscalYear, currentFiscalYear);

      const account = await manager.findOne(Account, { where: { deletedAt: IsNull(), customerId, name: 'General Reserve' } });

    })



  }
}