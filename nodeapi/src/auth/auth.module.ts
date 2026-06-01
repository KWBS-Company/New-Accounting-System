import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user_roles.entity';
import { CustomerModule } from 'src/customer/customer.module';
import { UserRolesService } from './user_roles.service';
import { UsersService } from './users.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [
    QueueModule,
    TypeOrmModule.forFeature([User, UserRole]),
    CustomerModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          // cast required: @nestjs/jwt@11 types expiresIn via ms's StringValue
          // template-literal type, but ours comes from env as a plain string
          expiresIn: config.getOrThrow<string>('jwt.expiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, UserRolesService, UsersService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
