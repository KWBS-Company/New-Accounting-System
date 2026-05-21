import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
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
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Support handlers that already return { message, data }
        const message =
          data && typeof data === 'object' && 'message' in data
            ? (data as any).message
            : 'Success';
        const payload =
          data && typeof data === 'object' && 'data' in data && 'message' in data
            ? (data as any).data
            : data;

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
