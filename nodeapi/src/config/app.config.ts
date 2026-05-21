import { registerAs } from '@nestjs/config';

/**
 * Parse an integer from an env var, falling back to the given default.
 * Handles undefined, empty strings, and non-numeric values safely.
 */
function envInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: envInt(process.env.PORT, 3001),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  uploadMaxSize: envInt(process.env.UPLOAD_MAX_SIZE, 10_485_760),
  throttle: {
    ttl: envInt(process.env.THROTTLE_TTL, 60),
    limit: envInt(process.env.THROTTLE_LIMIT, 100),
  },
  salon: {
    openHour: envInt(process.env.SALON_OPEN_HOUR, 9),
    closeHour: envInt(process.env.SALON_CLOSE_HOUR, 18),
    breakStartHour: envInt(process.env.BREAK_START_HOUR, 12),
    breakEndHour: envInt(process.env.BREAK_END_HOUR, 14),
  },
}));
