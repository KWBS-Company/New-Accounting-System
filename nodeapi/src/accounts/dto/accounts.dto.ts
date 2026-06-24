import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateIf } from "class-validator";
import { AccountType } from "../types/account_types.enum";
import { TransformFnParams, Type } from "class-transformer";
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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  showChildAccountOnly?: boolean = false;
}


export class CreateAccountDto {

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType, required: false })
  @Transform(({ obj, value }: TransformFnParams) => {
    if ((obj as CreateAccountDto).parentId) {
      return undefined;
    }
    return value as AccountType;
  })
  @ValidateIf((o: CreateAccountDto) => !o.parentId)
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiPropertyOptional()
  @Transform(({ obj, value }: TransformFnParams) => {
    if ((obj as CreateAccountDto).parentId) {
      return undefined;
    }
    return value as string;
  })
  @ValidateIf((o: CreateAccountDto) => !o.parentId)
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