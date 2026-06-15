import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

export class ListTransactionQuery {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  transactionFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  transactionTo?: Date;
}

export class UploadTransactionExcelDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  file: any;
}

export class PreviewTransactionLineDto {

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;


  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  transactionTypeId: string;
}

// new dto

export class CreateLineDto {

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  credit: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  debit: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  description: string;

}

export class UpdateLineDto {

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  lineId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  credit: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  debit: number;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  description: string;
}

export class CreateTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    example: '2026-05-15T10:00:00.000Z',
    description: 'Transaction date (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  transactionDate: string;

  @ApiProperty({
    type: [CreateLineDto],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateLineDto)
  lines: CreateLineDto[];
}

export class UpdateTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    example: '2026-05-15T10:00:00.000Z',
    description: 'Transaction date (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  transactionDate: string;

  @ApiProperty({
    type: [UpdateLineDto],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => UpdateLineDto)
  lines: UpdateLineDto[];
}