import { ApiTags } from "@nestjs/swagger";
import { LedgerHead } from "../entities/ledger_head.entity";
import { LedgerHeadService } from "../services/ledger_head.service";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Public } from "src/auth/decorators/public.decorator";
import { CreateLedgerHeadDto, ListLedgerHeadDto, UpdateLedgerHeadDto } from "../dto/ledger_head.dto";


@ApiTags('Ledger Head')
@Controller('ledger-heads')
@Public()
export class LedgerHeadController {
    constructor(private readonly ledgerHeadService: LedgerHeadService) { }

    @Post()
    async create(@Body() data: CreateLedgerHeadDto) {
        return this.ledgerHeadService.create(data);
    }

    @Patch(':id')
    async update(@Body() data: UpdateLedgerHeadDto, @Param('id') id: string) {
        return this.ledgerHeadService.update(data, id);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.ledgerHeadService.delete(id);
    }

    @Get(':id')
    async findById(@Param('id') id: string): Promise<LedgerHead | null> {
        return this.ledgerHeadService.findById(id);
    }

    @Get()
    @Public()
    async findAll(@Query() query: ListLedgerHeadDto) {
        return this.ledgerHeadService.findAllWithPagination(query);
    }
}