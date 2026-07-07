import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    private secret: string;
    constructor(private configService: ConfigService) {
        const apiSecret = this.configService.get<string>('API_KEY');
        if (!apiSecret) {
            throw new Error('No value in configuration for api key');
        }
        this.secret = apiSecret;
    }

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<Request>();

        const apiKey = request.headers['x-api-key'];
        if (!apiKey) {
            console.log('Request missing api key');
            throw new UnauthorizedException('Api Key Missing');
        }

        if (apiKey !== this.secret) {
            console.log('Requested with invalid api key');
            throw new UnauthorizedException('Invalid Api Key');
        }

        return true;
    }
}
