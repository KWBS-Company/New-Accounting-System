import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import mailConfig from './config/mail.config';
import googleSSOConfig from './config/google.sso.config';
import encryptionConfig from './config/encryption.config';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { AccountModule } from './accounts/account.module';
// import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CustomerModule } from './customer/customer.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from './queue/queue.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { InterestModule } from './interest/interest.module';
import { ActivityLogInterceptor } from './common/interceptors/logger';
import { ChatModule } from './chat/chat.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            envFilePath: '.env.example',
            load: [
                appConfig,
                databaseConfig,
                jwtConfig,
                redisConfig,
                mailConfig,
                googleSSOConfig,
                encryptionConfig,
            ],
        }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const dbConfig = config.get('database') as {
                    type: 'postgres';
                    host: string;
                    port: number;
                    username: string;
                    password: string;
                    database: string;
                    synchronize: boolean;
                    logging: boolean;
                };

                return {
                    ...dbConfig,
                    autoLoadEntities: true,
                    migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
                };
            },
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => [
                {
                    ttl: config.getOrThrow<number>('app.throttle.ttl') * 1000,
                    limit: config.getOrThrow<number>('app.throttle.limit'),
                },
            ],
        }),
        MailModule,
        AuthModule,
        AccountModule,
        CustomerModule,
        BullModule.forRootAsync({
            imports: [],
            useFactory: () => {
                return {
                    connection: {
                        host: process.env.REDIS_HOST,
                        port: Number(process.env.REDIS_PORT),
                    },
                };
            },
        }),
        QueueModule,
        ServeStaticModule.forRootAsync({
            useFactory: () => {
                return [
                    {
                        rootPath: join(process.cwd(), 'uploads'),
                        serveRoot: '/uploads',
                    },
                ];
            },
        }),
        InterestModule,
        ChatModule
    ],
    providers: [
        // { provide: APP_FILTER, useClass: AllExceptionsFilter },
        // { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
    ],
})
export class AppModule {}
