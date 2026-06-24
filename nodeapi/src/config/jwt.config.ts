import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    verificationSecret:
        process.env.JWT_VERIFICATION_SECRET || 'verification-secret',
    verificationExpiresIn: process.env.JWT_VERIFICATION_EXPIRES_IN || '24h',
}));
