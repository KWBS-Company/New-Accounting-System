import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleType } from '../entities/user_roles.entity';
import { User } from '../entities/user.entity';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}
    private logger = new Logger('Authorization Middleware');

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!requiredRoles || requiredRoles.length === 0) return true;

        const { user } = context
            .switchToHttp()
            .getRequest<Request & { user?: User }>();
        if (!user) {
            this.logger.debug('User not authenticated');
            throw new ForbiddenException('User not authenticated');
        }

        const userRoles = user.userRoles;
        if (userRoles.length === 0) {
            this.logger.debug('Roles not assigned');
            throw new ForbiddenException(
                'Current user is not assigned with any roles',
            );
        }

        const currentRole = userRoles[0].roleType;

        if (!requiredRoles.includes(currentRole)) {
            this.logger.debug('Insufficient permissions');
            throw new ForbiddenException('Insufficient permissions');
        }
        return true;
    }
}
