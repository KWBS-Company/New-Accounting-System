import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Request } from 'express';
import { FiscalYearStatus } from 'src/customer/types/fiscal_years.status.types';

@Injectable()
export class FiscalYearGuard implements CanActivate {
    constructor() { }
    private logger = new Logger('Fiscal Year Guard');

    canActivate(context: ExecutionContext): boolean {

        const { user } = context.switchToHttp().getRequest<Request & { user?: User }>();
        if (!user) {
            this.logger.debug('User not authenticated');
            throw new ForbiddenException('User not authenticated');
        }

        const userRoles = user.userRoles;
        const fiscalYears = userRoles[0].customer.fiscalYears;
        const currentFiscalYr = fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            this.logger.debug('Fiscal yr is not setup');
            throw new ForbiddenException('Your company is not setup with fiscal yr.');
        }

        return true;
    }
}
