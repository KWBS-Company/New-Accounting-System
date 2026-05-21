import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { LedgerHeadType } from "../types/ledger_head_types.enum";
import { Public } from "src/auth/decorators/public.decorator";

@ApiTags('Ledger Head Types')
@Controller('ledger-head-types')
export class LedgerHeadTypesController {
    constructor() {}

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get all ledger head types' })
    @ApiResponse({ status: 200, description: 'Get all ledger head types' })
    async findAll() {
        const ledgerHeadTypeOptions = Object.values(LedgerHeadType).map(
            (type) => ({
              label: type,
              value: type,
            }),
          );
          
        return ledgerHeadTypeOptions;
    }
}