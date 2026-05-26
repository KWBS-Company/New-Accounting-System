import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "src/auth/decorators/public.decorator";
import { CreateTransactionRuleDto, ListTransactionRuleQuery, UpdateTransactionRuleDto } from "../dto/transaction_rules.dto";
import { TransactionRuleService } from "../services/transaction_rules.service";

@ApiTags('Transaction Rule')
@Controller('transaction-rules')
@Public()
export class TransactionRuleController {
    constructor(private readonly transactionRuleService: TransactionRuleService) {
    }
    @Post()
    async create(@Body() data: CreateTransactionRuleDto) {
        return this.transactionRuleService.createTransactionRule(data);
    }

    @Get()
    async list(@Query() data: ListTransactionRuleQuery) {
        return this.transactionRuleService.listTransactionRulesWithPagination(data);
    }

    @Get(':id')
    async getDetail(@Param('id') id: string) {
        return this.transactionRuleService.findById(id);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.transactionRuleService.deleteTransactionRule(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: UpdateTransactionRuleDto) {
        return this.transactionRuleService.updateTransactionRule(id, data);
    }
}