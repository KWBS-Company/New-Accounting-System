import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Support handlers that already return { message, data }
        const message =
          (data && typeof data === 'object' && 'message' in data
            ? (data).message
            : 'Success') as string;
        const payload =
          (data && typeof data === 'object' && 'data' in data && 'message' in data
            ? (data).data
            : data) as T;

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data: payload,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
