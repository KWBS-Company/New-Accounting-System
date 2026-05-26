import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateIf } from "class-validator";

// export class ListLedgerHeadDto {
//     @ApiPropertyOptional()
//     @IsOptional()
//     @IsString()
//     search?: string;

//     @ApiPropertyOptional({ enum: LedgerHeadType })
//     @IsOptional()
//     @IsEnum(LedgerHeadType)
//     ledgerHeadType?: LedgerHeadType;

//     @ApiPropertyOptional({ default: 1 })
//     @IsOptional()
//     @Type(() => Number)
//     page?: number = 1;

//     @ApiPropertyOptional({ default: 20 })
//     @IsOptional()
//     @Type(() => Number)
//     pageSize?: number = 20;
// }


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
}

// export class UpdateLedgerHeadDto {
//     @ApiProperty()
//     @IsString()
//     @IsNotEmpty()
//     name: string;
//   }