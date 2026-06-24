import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class ChangePasswordDto {
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
    @IsOptional()
    currentPassword: string;

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
    newPassword: string;
}
