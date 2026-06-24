import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber } from 'class-validator';

export class InterestDto {
    @ApiProperty({
        example: '2026-05-15T10:00:00.000Z',
        description: 'Loan Taken Date (ISO 8601)',
    })
    @IsDateString()
    @IsNotEmpty()
    loanTakenDate: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    interestRateInPercentage: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    amount: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    compoundingDays: number;
}
