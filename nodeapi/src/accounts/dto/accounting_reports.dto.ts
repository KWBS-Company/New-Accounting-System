import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AccountType } from '../types/account_types.enum';
import { Type } from 'class-transformer';

export class ListAccountReportQuery {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: AccountType })
    @IsOptional()
    @IsEnum(AccountType)
    accountType?: AccountType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDate()
    transactionFrom?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDate()
    transactionTo?: Date;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    pageSize?: number = 20;
}

export class AccountReportQuery {
    @ApiPropertyOptional({ enum: AccountType })
    @IsOptional()
    @IsEnum(AccountType)
    accountType?: AccountType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDate()
    transactionFrom?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDate()
    transactionTo?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    fiscalYearId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    accountCode?: string;
}
