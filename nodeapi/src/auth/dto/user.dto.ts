import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ListUserQuery {
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

export class InviteUserDto {
    @ApiProperty({ example: 'jane.doe@example.com' })
    @IsEmail()
    @MaxLength(255)
    email: string;

    @ApiProperty({ example: 'Jane' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    firstName: string;
}

export class ProfileCustomerUserDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    token: string;
    
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
}