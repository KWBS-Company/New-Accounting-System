import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateIf } from "class-validator";
import { AccountType } from "../types/account_types.enum";
import { Type } from "class-transformer";
import { Transform } from 'class-transformer';

export class ListAccountDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: AccountType })
    @IsOptional()
    @IsEnum(AccountType)
    accountType?: AccountType;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    pageSize?: number = 20;
}


export class CreateAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  accountType: AccountType;

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

export class UpdateAccountDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;
  }