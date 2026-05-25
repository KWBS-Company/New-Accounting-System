import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateIf } from "class-validator";
import { LedgerHeadType } from "../types/ledger_head_types.enum";
import { Type } from "class-transformer";
import { Transform } from 'class-transformer';
import { AccountKey } from "../services/transaction_rules.service";

export class ListLedgerHeadDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: LedgerHeadType })
    @IsOptional()
    @IsEnum(LedgerHeadType)
    ledgerHeadType?: LedgerHeadType;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    pageSize?: number = 20;
}


export class CreateLedgerHeadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: LedgerHeadType })
  @IsEnum(LedgerHeadType)
  ledgerHeadType: LedgerHeadType;


  @ApiProperty({ enum: AccountKey })
  @IsEnum(AccountKey)
  accountKey: AccountKey;

  @ApiPropertyOptional()
  @Transform(({ obj, value }) => {
    // ignore code if parentId exists
    if (obj.parentId) {
      return undefined;
    }

    return value;
  })
  @ValidateIf((o) => !o.parentId)
  @IsNotEmpty({
    message: 'Code is required when parentId is not provided',
  })
  @IsString()
  @Matches(/^[A-Z]+$/, {
    message: 'Code must contain only uppercase alphabetical letters',
  })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateLedgerHeadDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
  }