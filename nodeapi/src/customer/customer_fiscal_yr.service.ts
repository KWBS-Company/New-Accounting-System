import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomerFiscalYear } from "./entities/company.fiscal.entity";

@Injectable()
export class FiscalYearService {
    constructor(@InjectRepository(CustomerFiscalYear)
    private readonly customerFiscalYearRepository: Repository<CustomerFiscalYear>) { }

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
}