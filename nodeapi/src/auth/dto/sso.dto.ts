import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class SignUpSSODto {
    @ApiProperty({ example: 'Authorization code' })
    @IsString()
    @IsNotEmpty()
    authorizationCode: string;

    @ApiProperty({ example: 'Company Name' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    companyName: string;

    @ApiProperty({ example: 'company@example.com' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    companyEmail: string;

    @ApiProperty({ example: '123 Main St, Anytown, USA' })
    @IsString()
    @IsNotEmpty()
    companyAddress: string;

    @ApiProperty({ example: '+1234567890' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    companyPhone: string;

    @ApiProperty({ example: 'https://www.example.com', required: false })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    companyWebsite: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    transactionCurrencyCode: string;

    @ApiProperty({ example: 7 })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(12)
    fiscalStartMonth: number;

    @ApiProperty({ example: 16 })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(31)
    fiscalStartDay: number;

    @ApiProperty({ example: 7 })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(12)
    fiscalEndMonth: number;

    @ApiProperty({ example: 15 })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(31)
    fiscalEndDay: number;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    vatNumber: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    panNumber: string;
}


export class SignInSSODto {
    @ApiProperty({ example: 'Authorization code' })
    @IsString()
    @IsNotEmpty()
    authorizationCode: string;
}