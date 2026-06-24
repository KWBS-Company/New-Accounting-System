import { Module } from '@nestjs/common';
import { Customer } from './entities/customer.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerFiscalYear } from './entities/company.fiscal.entity';
import { FiscalYearService } from './customer_fiscal_yr.service';
import { CommonService } from 'src/common/utils/common';
import { CustomerFiscalYearController } from './customer_fiscal_yr.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Customer, CustomerFiscalYear])],
    controllers: [CustomerController, CustomerFiscalYearController],
    providers: [CustomerService, FiscalYearService, CommonService],
    exports: [CustomerService, FiscalYearService],
})
export class CustomerModule {}
