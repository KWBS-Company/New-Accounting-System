import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AccountType } from "../types/account_types.enum";
import { User } from "src/auth/entities/user.entity";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { Roles } from "src/auth/decorators/roles.decorator";
import { RoleType } from "src/auth/entities/user_roles.entity";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { FiscalYearGuard } from "src/auth/guards/fiscal-year.guard";

@ApiTags('Account Types')
@Controller('account-types')
@UseGuards(RolesGuard, FiscalYearGuard)
@Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN, RoleType.CUSTOMER_USER)
export class AccountTypeController {
  constructor() { }

  @Get()
  @ApiOperation({ summary: 'Get all account types' })
  @ApiResponse({ status: 200, description: 'Get all account types' })
  async findAll(@CurrentUser() user: User) {
    const accountTypes = Object.values(AccountType).map(
      (type) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
        value: type,
      }),
    );

    return accountTypes;
  }
}