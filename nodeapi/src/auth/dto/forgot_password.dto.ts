import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
    @ApiProperty({ example: 'jane.doe@example.com' })
    @IsEmail()
    email: string;
}


export class ResetPasswordDto {
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


    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    token: string;
}