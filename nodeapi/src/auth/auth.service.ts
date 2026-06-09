import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
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
import { JwtPayload } from './strategies/jwt.strategy';
import { RoleType, UserRole } from 'src/auth/entities/user_roles.entity';
import { DataSource } from 'typeorm';
import { Customer } from 'src/customer/entities/customer.entity';
import { QueueService } from 'src/queue/queue.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot_password.dto';
import { ChangePasswordDto } from './dto/change_password.dto';
import { ProfileDto } from './dto/profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService
  ) { }

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; userId: string }> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.saltRounds,
    );

    const result = await this.dataSource.transaction(
      async (manager) => {
        const user = manager.create(
          User,
          {
            ...dto,
            password: hashedPassword,
          },
        );

        const retUser = await manager.save(User, user);

        const customer = manager.create(
          Customer,
          {
            companyName: dto.companyName,
            companyEmail: dto.companyEmail,
            companyAddress: dto.companyAddress,
            companyPhone: dto.companyPhone,
          },
        );
        await manager.save(Customer, customer);

        const userRole = manager.create(
          UserRole,
          {
            userId: user.id,
            customerId: customer.id,
            roleType: RoleType.CUSTOMER_ADMIN,
          },
        );

        await manager.save(UserRole, userRole);

        const url = await this.sendVerificationEmail(retUser);

        return { user: retUser, url };
      },
    );

    // Usually keep external operations outside transaction
    await this.queueService.addEmailToQueue(result.user.email, 'verify-email', { firstName: result.user.firstName, verificationUrl: result.url })

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      userId: result.user.id,
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
    await this.usersService.update(user.id, { lastLoginDate: new Date() });
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
    if (!user) {
      return {
        message:
          'User not found',
      };
    }
    if (user.isEmailVerified) {
      return {
        message:
          'Account is already verified',
      };
    }
    const url = await this.sendVerificationEmail(user);
    // Usually keep external operations outside transaction
    await this.queueService.addEmailToQueue(user.email, 'verify-email', { firstName: user.firstName, verificationUrl: url })
    return {
      message:
        'If an unverified account exists for this email, a new verification link has been sent.',
    };
  }

  private async sendVerificationEmail(user: User) {
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
    return verificationUrl;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, password } = resetPasswordDto;
    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('jwt.verificationSecret'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset password Url token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const hashedPassword = await bcrypt.hash(
      password,
      this.saltRounds,
    );
    await this.usersService.update(user.id, { password: hashedPassword });
    return { message: 'Password reset successfully now.' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.usersService.findByEmail(email, false);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }
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
    const resetPasswordUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.queueService.addEmailToQueue(user.email, 'reset-password', { firstName: user.firstName, resetPasswordUrl: resetPasswordUrl })

    return { message: 'Email has been sent to reset password' };
  }

  async changePassword(user: User, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    let checkPassword: boolean = false;
    if (user.password) {
      try {
        checkPassword = await bcrypt.compare(currentPassword, user.password);
      } catch (error) {
        this.logger.error(error);
        checkPassword = false;
      }

      if (!checkPassword) {
        throw new BadRequestException(
          'Please enter your correct current password to confirm your identity and update your password.',
        );
      }

      if (currentPassword === newPassword) {
        throw new HttpException(
          'New password cannot be the same as your current password. Please choose a different one.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const hashedPassword = await bcrypt.hash(
      newPassword,
      this.saltRounds,
    );

    await this.usersService.update(user.id, { password: hashedPassword });
    return { message: 'Your passsword has been changed successfully.' };
  }


  async updateProfile(user: User, profileDto: ProfileDto) {
    const { firstName, lastName, phone } = profileDto;
    await this.usersService.update(user.id, { firstName: firstName, lastName: lastName, phone: phone });
    return { message: 'Your profile has been changed successfully.' };
  }


  async uploadProfilePicture(
    file: Express.Multer.File,
    user: User,
  ) {
    const backendUrl = this.configService.getOrThrow<string>('app.backendUrl');
    await this.usersService.update(user.id, { avatarUrl: `/uploads/${file.filename}` })
    return {
      message: `Profile picture uploaded successfully`,
      avatarUrl: `${backendUrl}/uploads/${file.filename}`,
    };
  }
}
