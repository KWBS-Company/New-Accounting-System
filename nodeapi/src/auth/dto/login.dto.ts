import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'jane.doe@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'StrongP@ss123' })
    @IsString()
    @IsNotEmpty()
    password: string;
}

export class VerifyEmailDto {
    @ApiProperty({
        description: 'Email verification token sent in the email link',
    })
    @IsString()
    @IsNotEmpty()
    token: string;
}

export class ResendVerificationDto {
    @ApiProperty({ example: 'jane.doe@example.com' })
    @IsEmail()
    email: string;
}
