import { registerAs } from '@nestjs/config';

export default registerAs('encryption', () => ({
    encryptionAlgorithm: process.env.ENCRYPTION_ALGORITHM || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    encryptionInitializationVector: process.env.ENCRYPTION_IV || '',
}));
