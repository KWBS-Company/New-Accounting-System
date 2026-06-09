import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private logger = new Logger('Authentication Middleware');
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      this.logger.debug('User not found');
      throw new UnauthorizedException('Current user not found');
    }
    if (!user.isActive) {
      this.logger.debug('User not active');
      throw new UnauthorizedException('Current user is inactive');
    }
    if (!user.isEmailVerified) {
      this.logger.debug('User email not verified');
      throw new UnauthorizedException('Current user email not verified');
    }
    const userRoles = user.userRoles;

    if (userRoles.length === 0) {
      this.logger.debug('Roles not assigned');
      throw new UnauthorizedException('Current user is not assigned with any roles');
    }
    return user;
  }
}
