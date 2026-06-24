import { registerAs } from '@nestjs/config';

function envInt(value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

export default registerAs('redis', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: envInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
}));
