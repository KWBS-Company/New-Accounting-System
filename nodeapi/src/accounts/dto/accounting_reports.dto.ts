import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AccountType } from "../types/account_types.enum";
import { Type } from "class-transformer";

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
    @IsDateString()
    transactionFrom?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
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
    @IsDateString()
    transactionFrom?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    transactionTo?: Date;


    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    accountCode?: string;
}