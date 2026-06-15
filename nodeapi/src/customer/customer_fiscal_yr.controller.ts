import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { User } from "src/auth/entities/user.entity";
import { FiscalYearService } from "./customer_fiscal_yr.service";

@Controller('customer-fiscal-years')
@ApiTags('Customer Fiscal Year')
@UseGuards(RolesGuard)

export class CustomerFiscalYearController {
    constructor(private readonly customerFiscalYearService: FiscalYearService) { }

    @Get('')
    async listCustomerFiscalYears(@CurrentUser() user: User) {
        return await this.customerFiscalYearService.findAllByCustomerId(user.userRoles[0].customerId);
    }

    @Patch('')
    async patchFiscalYear(@CurrentUser() user: User) {
        return await this.customerFiscalYearService.patchCurrentFiscalYear(user);
    }

}