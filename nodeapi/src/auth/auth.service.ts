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
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RoleType, UserRole } from 'src/auth/entities/user_roles.entity';
import { DataSource, IsNull } from 'typeorm';
import { Customer } from 'src/customer/entities/customer.entity';
import { QueueService } from 'src/queue/queue.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot_password.dto';
import { ChangePasswordDto } from './dto/change_password.dto';
import { ProfileDto } from './dto/profile.dto';
import { SignUpSSODto } from './dto/sso.dto';
import { AccountService } from 'src/accounts/services/accounts.service';
import { CommonService } from 'src/common/utils/common';
import { CustomerFiscalYear } from 'src/customer/entities/company.fiscal.entity';
import { FiscalYearStatus } from 'src/customer/types/fiscal_years.status.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
    private readonly accountService: AccountService,
    private readonly commonService: CommonService
  ) { }

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; userId: string }> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const saltRound = this.commonService.generateSalt();

    const hashedPassword = await this.commonService.hash(dto.password, saltRound);

    const result = await this.dataSource.transaction(
      async (manager) => {
        const user = manager.create(
          User,
          {
            ...dto,
            salt: saltRound,
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
            transactionCurrencyCode: dto.transactionCurrencyCode,
            companyWebsite: dto.companyWebsite,
            fiscalStartDate: dto.fiscalStartDate
          },
        );
        await manager.save(Customer, customer);

        const currentFiscalYear = await manager.findOneBy(CustomerFiscalYear, {
          status: FiscalYearStatus.OPEN,
          customerId: customer.id,
          deletedAt: IsNull()
        });

        if (!currentFiscalYear) {
          const fiscalYrDates = this.commonService.getFiscalYearDates(dto.fiscalStartDate);

          const customerFiscalYear = manager.create(CustomerFiscalYear, {
            name: fiscalYrDates.name,
            startDate: fiscalYrDates.startDate,
            endDate: fiscalYrDates.endDate,
            status: FiscalYearStatus.OPEN,
            customerId: customer.id
          })

          await manager.save(CustomerFiscalYear, customerFiscalYear);
        } else {
          const newFiscalstartDate = this.commonService.getStartDateForNextFiscalYr(currentFiscalYear.endDate);
          const fiscalYrDates = this.commonService.getFiscalYearDates(newFiscalstartDate);

          const customerFiscalYear = manager.create(CustomerFiscalYear, {
            name: fiscalYrDates.name,
            startDate: fiscalYrDates.startDate,
            endDate: fiscalYrDates.endDate,
            status: FiscalYearStatus.OPEN,
            customerId: customer.id
          })

          await manager.save(CustomerFiscalYear, customerFiscalYear);
        }

        const userRole = manager.create(
          UserRole,
          {
            userId: user.id,
            customerId: customer.id,
            roleType: RoleType.CUSTOMER_ADMIN,
          },
        );

        await manager.save(UserRole, userRole);

        await this.accountService.seedDefaultAccounts(manager, customer.id);

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
    user: Partial<User & { hasPassword: boolean }>;
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
    if (user.userRoles.length === 0) {
      throw new UnauthorizedException('User is not assigned with any roles');

    }

    const isValid = await this.commonService.compareHash(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.userRoles[0]?.roleType,
    };

    const accessToken = this.jwtService.sign(payload);
    await this.usersService.update(user.id, { lastLoginDate: new Date() });
    const { password, ...safe } = user;
    return { accessToken, user: { ...safe, hasPassword: Boolean(password) } };
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
    const secret = this.configService.getOrThrow<string>('jwt.verificationSecret');
    const expiresIn = this.configService.getOrThrow<number>(
      'jwt.verificationExpiresIn',
    );
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: secret,
        expiresIn: expiresIn,
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

    const hashedPassword = await this.commonService.hash(password, user.salt);
    await this.usersService.update(user.id, { password: hashedPassword });
    return { message: 'Password reset successfully now.' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const secret = this.configService.getOrThrow<string>('jwt.verificationSecret');
    const expiresIn = this.configService.getOrThrow<number>(
      'jwt.verificationExpiresIn',
    );
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
        secret: secret,
        expiresIn: expiresIn,
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
        checkPassword = await this.commonService.compareHash(currentPassword, user.password);
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
    const hashedPassword = await this.commonService.hash(newPassword, user.salt);

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
    await this.usersService.update(user.id, { avatarUrl: `/uploads/profile-pic/${file.filename}` })
    return {
      message: `Profile picture uploaded successfully`,
      avatarUrl: `${backendUrl}/uploads/profile-pic/${file.filename}`,
    };
  }

  async registerSSOUser(
    email: string,
    firstName: string,
    lastName: string,
    dto: SignUpSSODto,
  ): Promise<{
    accessToken: string;
    user: Partial<User & { hasPassword: boolean }>;
  }> {
    const { companyAddress, companyName, companyWebsite, companyEmail, companyPhone, fiscalStartDate, transactionCurrencyCode } = dto;
    const existing = await this.usersService.findByEmail(email);

    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const saltRound = this.commonService.generateSalt();

    const user = await this.dataSource.transaction(
      async (manager) => {
        const user = manager.create(
          User,
          {
            email: email,
            firstName,
            lastName,
            isEmailVerified: true,
            isActive: true,
            password: '',
            salt: saltRound
          },
        );

        const retUser = await manager.save(User, user);

        const customer = manager.create(
          Customer,
          {
            companyName: companyName,
            companyEmail: companyEmail,
            companyAddress: companyAddress,
            companyPhone: companyPhone,
            transactionCurrencyCode: transactionCurrencyCode,
            fiscalStartDate: fiscalStartDate,
            companyWebsite: companyWebsite
          },
        );
        await manager.save(Customer, customer);

        const currentFiscalYear = await manager.findOneBy(CustomerFiscalYear, {
          status: FiscalYearStatus.OPEN,
          customerId: customer.id,
          deletedAt: IsNull()
        });

        if (!currentFiscalYear) {
          const fiscalYrDates = this.commonService.getFiscalYearDates(dto.fiscalStartDate);

          const customerFiscalYear = manager.create(CustomerFiscalYear, {
            name: fiscalYrDates.name,
            startDate: fiscalYrDates.startDate,
            endDate: fiscalYrDates.endDate,
            status: FiscalYearStatus.OPEN,
            customerId: customer.id
          })

          await manager.save(CustomerFiscalYear, customerFiscalYear);
        } else {
          const newFiscalstartDate = this.commonService.getStartDateForNextFiscalYr(currentFiscalYear.endDate);
          const fiscalYrDates = this.commonService.getFiscalYearDates(newFiscalstartDate);

          const customerFiscalYear = manager.create(CustomerFiscalYear, {
            name: fiscalYrDates.name,
            startDate: fiscalYrDates.startDate,
            endDate: fiscalYrDates.endDate,
            status: FiscalYearStatus.OPEN,
            customerId: customer.id
          })

          await manager.save(CustomerFiscalYear, customerFiscalYear);
        }

        const userRole = manager.create(
          UserRole,
          {
            userId: user.id,
            customerId: customer.id,
            roleType: RoleType.CUSTOMER_ADMIN,
          },
        );

        await manager.save(UserRole, userRole);

        await this.accountService.seedDefaultAccounts(manager, customer.id);

        const payload: JwtPayload = {
          sub: retUser.id,
          email: retUser.email,
          role: RoleType.CUSTOMER_ADMIN,
        };

        const accessToken = this.jwtService.sign(payload);
        await manager.update(User, user.id, { lastLoginDate: new Date() })
        const { password, ...safe } = user;
        return { accessToken, user: { ...safe, hasPassword: Boolean(password) } };
      },
    );

    return user;
  }

  async loginSSOUser(email: string): Promise<{
    accessToken: string;
    user: Partial<User & { hasPassword: boolean }>;
  }> {
    const user = await this.usersService.findByEmail(email, true);
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

    if (user.userRoles.length === 0) {
      throw new UnauthorizedException('User is not assigned with any roles');

    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.userRoles[0].roleType,
    };

    const accessToken = this.jwtService.sign(payload);
    await this.usersService.update(user.id, { lastLoginDate: new Date() });
    const { password, ...safe } = user;
    return { accessToken, user: { ...safe, hasPassword: Boolean(password) } };
  }
}
