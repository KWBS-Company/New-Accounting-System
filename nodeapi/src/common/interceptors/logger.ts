import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
    HttpException,
} from '@nestjs/common';
import { tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { User } from 'src/auth/entities/user.entity';

interface AuthenticatedRequest extends Request {
    user?: User;
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(ActivityLogInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler) {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const { method, path, user, headers, ip } = request;
        const userId = user?.id ?? 'Unauthenticated user';
        const xForwardedFor = (headers['x-forwarded-for'] ||
            'No Address') as string;
        const userAgent = headers['user-agent'] || 'No Agent';

        return next.handle().pipe(
            tap(() => {
                // Log 2xx responses
                this.logger.log(
                    `Response: ${method} ${path} - User ID: ${userId} - Status: 200 - Real IP : ${xForwardedFor} - User Agent: ${userAgent} - Remote IP : ${ip}`,
                );
            }),
            catchError((err: unknown) => {
                // Type guard for HttpException
                let statusCode = 500;
                let message = 'Internal Server Error';

                if (err instanceof HttpException) {
                    statusCode = err.getStatus();
                    message = err.message;
                } else if (err instanceof Error) {
                    message = err.message;
                }

                if (statusCode >= 500) {
                    this.logger.error(
                        `Server Error: ${method} ${path} - User ID: ${userId} - Status: ${statusCode} - Message: ${message} - Real IP : ${xForwardedFor} - User Agent: ${userAgent} - Remote IP : ${ip}`,
                    );
                } else if (statusCode >= 400) {
                    this.logger.warn(
                        `Client Error: ${method} ${path} - User ID: ${userId} - Status: ${statusCode} - Message: ${message} - Real IP : ${xForwardedFor} - User Agent: ${userAgent} - Remote IP : ${ip}`,
                    );
                }

                return throwError(() => err);
            }),
        );
    }
}
