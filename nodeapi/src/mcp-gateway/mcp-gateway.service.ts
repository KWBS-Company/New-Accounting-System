import { Injectable } from "@nestjs/common";
import { MCPDataDto } from "./mcp_data.dto";

@Injectable()
export class MCPGatewayService {
    constructor() { }

    async requestMCPData(mcpDataDto: MCPDataDto) {
        return { message: 'data recieved' };
    }
}