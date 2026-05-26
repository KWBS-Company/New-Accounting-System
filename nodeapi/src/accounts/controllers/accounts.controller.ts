import { ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Public } from "src/auth/decorators/public.decorator";
import { AccountService } from "../services/accounts.service";
import { CreateAccountDto, ListAccountDto, UpdateAccountDto } from "../dto/account.dto";


@ApiTags('Account')
@Controller('accounts')
@Public()
export class AccountController {
    constructor(private readonly accountService: AccountService) { }

    @Post()
    async create(@Body() data: CreateAccountDto) {
        return this.accountService.createAccount(data);
    }

    @Patch(':id')
    async update(@Body() data: UpdateAccountDto, @Param('id') id: string) {
        return this.accountService.updateAccount(data, id);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.accountService.deleteAccount(id);
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.accountService.findAccountById(id);
    }

    @Get()
    async findAll(@Query() query:ListAccountDto) {
        return this.accountService.listAccountWithPagination(query);
    }
}