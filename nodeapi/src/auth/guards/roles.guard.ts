import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleType } from '../entities/user_roles.entity';
import { User } from '../entities/user.entity';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<Request & { user?: User }>();
    if (!user) throw new ForbiddenException('User not authenticated');

    if (!requiredRoles.includes(user.userRoles[0].roleType)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
