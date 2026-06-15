import { Module } from '@nestjs/common';
import { Customer } from './entities/customer.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerFiscalYear } from './entities/company.fiscal.entity';
import { FiscalYearService } from './customer_fiscal_yr.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerFiscalYear])],
  controllers: [CustomerController],
  providers: [CustomerService, FiscalYearService],
  exports: [CustomerService, FiscalYearService],
})
export class CustomerModule { }