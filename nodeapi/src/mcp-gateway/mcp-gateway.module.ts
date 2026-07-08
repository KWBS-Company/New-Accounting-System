import { Module } from '@nestjs/common';
import { MCPGatewayController } from './mcp-gateway.controller';
import { MCPGatewayService } from './mcp-gateway.service';
import { AccountModule } from 'src/accounts/account.module';
import { AuthModule } from 'src/auth/auth.module';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
    imports: [AccountModule, AuthModule, CustomerModule],
    controllers: [MCPGatewayController],
    providers: [MCPGatewayService],
    exports: [],
})
export class MCPGatewayModule {}
