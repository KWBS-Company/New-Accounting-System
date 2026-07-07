import { BadRequestException, Injectable } from '@nestjs/common';
import { MCPDataDto } from './mcp_data.dto';
import { UserService } from 'src/auth/users.service';
import { AccountMCPService } from 'src/accounts/services/account_mcp.service';
import { ActionType } from './mcp.types';
import { FiscalYearService } from 'src/customer/customer_fiscal_yr.service';

@Injectable()
export class MCPGatewayService {
    constructor(
        private readonly userService: UserService,
        private readonly accountMcpService: AccountMCPService,
        private readonly customerFiscalYearService: FiscalYearService,
    ) {}

    async requestMCPData(mcpDataDto: MCPDataDto) {
        const user = await this.userService.findUserByCustomerId(
            mcpDataDto.customerId,
        );
        if (!user) {
            throw new BadRequestException('Invalid customer id');
        }

        switch (mcpDataDto.actionType) {
            case ActionType.LIST_ACCOUNT:
                return this.accountMcpService.listAccounts(mcpDataDto);

            case ActionType.GET_ACCOUNT_BALANCE:
                return this.accountMcpService.getBalance(mcpDataDto);

            case ActionType.GET_ACCOUNT_DETAIL:
                return this.accountMcpService.getAccountDetailByKeyAndFilter(
                    mcpDataDto,
                );

            case ActionType.LIST_FISCALYEAR:
                return this.customerFiscalYearService.findAllByCustomerId(
                    mcpDataDto.customerId,
                );

            default:
                throw new BadRequestException();
        }
    }
}
