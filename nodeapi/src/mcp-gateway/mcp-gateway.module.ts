import { Module } from "@nestjs/common";
import { MCPGatewayController } from "./mcp-gateway.controller";
import { MCPGatewayService } from "./mcp-gateway.service";
import { AccountModule } from "src/accounts/account.module";
import { AuthModule } from "src/auth/auth.module";

@Module({
    imports: [AccountModule, AuthModule],
    controllers: [MCPGatewayController],
    providers: [MCPGatewayService],
    exports: []
})
export class MCPGatewayModule {

}