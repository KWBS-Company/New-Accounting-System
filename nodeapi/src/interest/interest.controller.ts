import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InterestDto } from "./dto/interest.dto";
import { InterestService } from "./interest.service";

@ApiTags('Interest Calculator')
@Controller('/interest')
export class InterestController {
    constructor(private readonly interestService: InterestService) { }

    @Post()
    async calculateLoanInterest(@Body() dto: InterestDto) {
        return await this.interestService.interestCalculate(dto)
    }

}