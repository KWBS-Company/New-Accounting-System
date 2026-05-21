import { registerAs } from '@nestjs/config';

function envInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export default registerAs('mail', () => ({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: envInt(process.env.SMTP_PORT, 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  fromName: process.env.SMTP_FROM_NAME || 'Salon Booking',
  fromEmail: process.env.SMTP_FROM_EMAIL || 'no-reply@salon.com',
}));
