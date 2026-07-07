import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { ActionType, ReportType } from './mcp.types';
import { Type } from 'class-transformer';
export class QueryFilterDto {
    @IsOptional()
    fiscalYear?: string;

    @IsOptional()
    fromDate?: Date;

    @IsOptional()
    toDate?: Date;

    @IsOptional()
    @IsEnum(ReportType)
    reportType?: ReportType;

    @IsOptional()
    showChild?: boolean;
}

export class MCPDataDto {
    @IsEnum(ActionType)
    @IsNotEmpty()
    actionType: ActionType;

    @ValidateNested()
    @Type(() => QueryFilterDto)
    filters?: QueryFilterDto;

    @IsNotEmpty()
    @IsUUID()
    customerId: string;

    @IsNotEmpty()
    @IsString()
    key: string;

    @IsNotEmpty()
    @IsString()
    value: string;
}
