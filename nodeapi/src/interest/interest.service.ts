import { Injectable } from '@nestjs/common';
import { InterestDto } from './dto/interest.dto';

@Injectable()
export class InterestService {
    constructor() {}

    async interestCalculate(dto: InterestDto) {
        const {
            amount,
            loanTakenDate,
            compoundingDays,
            interestRateInPercentage,
        } = dto;
        const currentDate = new Date();
        const initialDate = new Date(loanTakenDate);
        const thresholdPeriod = compoundingDays;
        const currentYr = currentDate.getFullYear();
        const interestRate = interestRateInPercentage / 100;
        const start = new Date(currentYr, 0, 1); // Jan 1
        const end = new Date(currentYr + 1, 0, 1); // Jan 1 next year
        const diffMsForYr = end.getTime() - start.getTime();
        const noOfDaysInYear = diffMsForYr / (1000 * 60 * 60 * 24);
        const diffLoanTakenMs = currentDate.getTime() - initialDate.getTime();
        const noOfDays = Math.floor(diffLoanTakenMs / (1000 * 60 * 60 * 24));
        const noOfTimesCompounded = noOfDaysInYear / thresholdPeriod;
        const timeDays = noOfDays / noOfDaysInYear;
        const compoundedAmount =
            amount *
            Math.pow(
                1 + interestRate / noOfTimesCompounded,
                noOfTimesCompounded * timeDays,
            );
        const sumInterest = Math.round(compoundedAmount - amount);
        return { sumInterest, compoundedAmount: Math.round(compoundedAmount) };
    }
}
