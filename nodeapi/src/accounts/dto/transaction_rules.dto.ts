import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsString,
    IsUUID,
    ValidateNested,
    ArrayMinSize,
    IsOptional,
} from 'class-validator';

import { Type } from 'class-transformer';

// ======================================================
// RULE LINE DTO
// ======================================================

export class CreateRuleDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    accountId: string;

    @ApiProperty()
    @IsBoolean()
    @IsNotEmpty()
    increase: boolean;
}

export class UpdateRuleDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    ruleId: string;

    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    accountId: string;

    @ApiProperty()
    @IsBoolean()
    @IsNotEmpty()
    increase: boolean;
}

// ======================================================
// CREATE TRANSACTION RULE DTO
// ======================================================

export class CreateTransactionRuleDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    transactionType: string;

    @ApiProperty({
        type: [CreateRuleDto],
    })
    @IsArray()
    @ArrayMinSize(2)
    @ValidateNested({ each: true })
    @Type(() => CreateRuleDto)
    rules: CreateRuleDto[];
}

export class UpdateTransactionRuleDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    transactionType: string;

    @ApiProperty({
        type: [UpdateRuleDto],
    })
    @IsArray()
    @ArrayMinSize(2)
    @ValidateNested({ each: true })
    @Type(() => UpdateRuleDto)
    rules: UpdateRuleDto[];
}

export class ListTransactionRuleQuery {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    pageSize?: number = 20;
}
