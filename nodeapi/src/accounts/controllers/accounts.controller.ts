import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccountService } from "../services/accounts.service";
import { CreateAccountDto, ListAccountDto, UpdateAccountDto } from "../dto/accounts.dto";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { User } from "src/auth/entities/user.entity";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/auth/decorators/roles.decorator";
import { RoleType } from "src/auth/entities/user_roles.entity";


@ApiTags('Account')
@Controller('accounts')
@UseGuards(RolesGuard)
@Roles(RoleType.CUSTOMER_ADMIN, RoleType.SUPER_ADMIN)
export class AccountController {
    constructor(private readonly accountService: AccountService) { }

    @Post()
    async create(@Body() data: CreateAccountDto, @CurrentUser() user: User) {
        return this.accountService.createAccount(data, user);
    }

    @Patch(':id')
    async update(@Body() data: UpdateAccountDto, @Param('id') id: string, @CurrentUser() user: User) {
        return this.accountService.updateAccount(data, id, user);
    }

    @Delete(':id')
    async delete(@Param('id') id: string, @CurrentUser() user: User) {
        return this.accountService.deleteAccount(id, user);
    }

    @Get(':id')
    async findById(@Param('id') id: string, @CurrentUser() user: User) {
        return this.accountService.findAccountById(id, user);
    }

    @Get(':id/transaction-lines')
    async getAccountTransactionLine(@Param('id') id: string, @CurrentUser() user: User) {
        return this.accountService.findAccountByIdWithLines(id, user);
    }

    @Get()
    async findAll(@Query() query: ListAccountDto, @CurrentUser() user: User) {
        return this.accountService.listAccountWithPagination(query, user);
    }
}