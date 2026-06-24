import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
    CreateTransactionRuleDto,
    ListTransactionRuleQuery,
    UpdateTransactionRuleDto,
} from '../dto/transaction_rules.dto';
import { TransactionRuleService } from '../services/transaction_rules.service';
import { User } from 'src/auth/entities/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { RoleType } from 'src/auth/entities/user_roles.entity';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { FiscalYearGuard } from 'src/auth/guards/fiscal-year.guard';

@ApiTags('Transaction Rule')
@Controller('transaction-rules')
@UseGuards(RolesGuard, FiscalYearGuard)
@Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
export class TransactionRuleController {
    constructor(
        private readonly transactionRuleService: TransactionRuleService,
    ) {}
    @Post()
    async create(
        @Body() data: CreateTransactionRuleDto,
        @CurrentUser() user: User,
    ) {
        return this.transactionRuleService.createTransactionRule(data, user);
    }

    @Get()
    async list(
        @Query() data: ListTransactionRuleQuery,
        @CurrentUser() user: User,
    ) {
        return this.transactionRuleService.listTransactionRulesWithPagination(
            data,
            user,
        );
    }

    @Get(':id')
    async getDetail(@Param('id') id: string, @CurrentUser() user: User) {
        return this.transactionRuleService.findById(id, user);
    }

    @Delete(':id')
    async delete(@Param('id') id: string, @CurrentUser() user: User) {
        return this.transactionRuleService.deleteTransactionRule(id, user);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() data: UpdateTransactionRuleDto,
        @CurrentUser() user: User,
    ) {
        return this.transactionRuleService.updateTransactionRule(
            id,
            data,
            user,
        );
    }
}
