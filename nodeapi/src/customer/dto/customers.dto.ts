import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class ListCustomerQuery {
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

export class UpdateCustomerDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  companyEmail: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  companyAddress: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  companyPhone: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyWebsite: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transactionCurrencyCode: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vatNumber: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  panNumber: string;
}