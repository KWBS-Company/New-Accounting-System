import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { CustomerService } from 'src/customer/services/customer.service';
import { RoleType } from 'src/auth/entities/user_roles.entity';
import { UserRolesService } from 'src/auth/user_roles.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly customerService: CustomerService,
    private readonly userRolesService: UserRolesService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string; userId: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    const customer = await this.customerService.create({
      ...dto,
      companyName: dto.companyName,
      companyEmail: dto.companyEmail,
      companyAddress: dto.companyAddress,
      companyPhone: dto.companyPhone,
    });

    await this.userRolesService.create({
      userId: user.id,
      customerId: customer.id,
      roleType: RoleType.CUSTOMER_ADMIN,
    });

    await this.sendVerificationEmail(user);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    user: Partial<User>;
  }> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.userRoles[0].roleType,
    };

    const accessToken = this.jwtService.sign(payload);

    const { password, ...safe } = user;
    return { accessToken, user: safe };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('jwt.verificationSecret'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified' };
    }

    await this.usersService.update(user.id, { isEmailVerified: true });
    return { message: 'Email verified successfully. You may now log in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    // Return generic response to avoid email enumeration
    if (!user || user.isEmailVerified) {
      return {
        message:
          'If an unverified account exists for this email, a new verification link has been sent.',
      };
    }
    await this.sendVerificationEmail(user);
    return {
      message:
        'If an unverified account exists for this email, a new verification link has been sent.',
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.getOrThrow<string>('jwt.verificationSecret'),
        // cast: @nestjs/jwt@11 types expiresIn via ms's StringValue template-literal
        expiresIn: this.configService.getOrThrow<string>(
          'jwt.verificationExpiresIn',
        ) as any,
      },
    );

    const frontendUrl = this.configService.getOrThrow<string>('app.frontendUrl');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        user.fullName,
        verificationUrl,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${err.message}`,
      );
      // Don't throw — verification can be resent
    }
  }
}
