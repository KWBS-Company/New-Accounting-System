import { registerAs } from '@nestjs/config';

export default registerAs('googlesso', () => ({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    signInredirectUri: process.env.GOOGLE_REDIRECT_URI_LOGIN || '',
    signUpRedirectUri: process.env.GOOGLE_REDIRECT_URI_SIGNUP || '',
}));
