import { Module } from "@nestjs/common";
import { MCPGatewayController } from "./mcp-gateway.controller";
import { MCPGatewayService } from "./mcp-gateway.service";

@Module({
    imports: [],
    controllers: [MCPGatewayController],
    providers: [MCPGatewayService],
    exports: []
})
export class MCPGatewayModule {

}