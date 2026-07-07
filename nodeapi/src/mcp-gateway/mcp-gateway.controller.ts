import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/auth/guards/api-key.guard';
import { MCPDataDto } from './mcp_data.dto';
import { MCPGatewayService } from './mcp-gateway.service';
import { Public } from 'src/auth/decorators/public.decorator';

@ApiTags('mcp-gateway')
@Controller('mcp-gateway')
export class MCPGatewayController {
  constructor(private mcpGatewayService: MCPGatewayService) { }

  @UseGuards(ApiKeyGuard)
  @Public()
  @Post('/data')
  async mcpData(@Body() mcpDataDto: MCPDataDto) {
    return this.mcpGatewayService.requestMCPData(mcpDataDto);
  }
}
