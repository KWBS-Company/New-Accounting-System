import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AccountService } from "../services/accounts.service";
import { CreateAccountDto, ListAccountDto, UpdateAccountDto } from "../dto/accounts.dto";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { User } from "src/auth/entities/user.entity";


@ApiTags('Account')
@Controller('accounts')
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

    @Get()
    async findAll(@Query() query: ListAccountDto, @CurrentUser() user: User) {
        return this.accountService.listAccountWithPagination(query, user);
    }
}