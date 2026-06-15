import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({
    example: 'StrongP@ss123',
    description:
      'Must be at least 8 characters and contain uppercase, lowercase, number, and special character',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=.,])/, {
    message:
      'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

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

  @ApiProperty({ example: '2023-10-12' })
  @IsDate()
  @IsNotEmpty()
  fiscalStartDate: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vatNumber: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  panNumber: string;
}
