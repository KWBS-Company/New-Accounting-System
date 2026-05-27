import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

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
}


export class CreateTransactionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  transactionTypeId: string;

  @ApiProperty({
    example: '2026-05-15T10:00:00.000Z',
    description: 'Transaction date (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  transactionDate: string;
}


export class UploadTransactionExcelDto {
  @ApiProperty({
      type: 'string',
      format: 'binary',
  })
  file: any;
}