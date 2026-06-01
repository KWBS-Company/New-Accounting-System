import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AccountType } from "../types/account_types.enum";

@ApiTags('Account Types')
@Controller('account-types')
export class AccountTypeController {
  constructor() { }

  @Get()
  @ApiOperation({ summary: 'Get all account types' })
  @ApiResponse({ status: 200, description: 'Get all account types' })
  async findAll() {
    const accountTypes = Object.values(AccountType).map(
      (type) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
        value: type,
      }),
    );

    return accountTypes;
  }
}