import {
    BadRequestException,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import axios, { AxiosError } from 'axios';
import { SignInSSODto, SignUpSSODto } from '../dto/sso.dto';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GoogleSSOService {
    private readonly oauth2ClientSignUp: OAuth2Client;
    private readonly oauth2ClientSignIn: OAuth2Client;
    private readonly logger = new Logger(GoogleSSOService.name);
    constructor(
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
        private readonly jwtService: JwtService,
    ) {
        const clientId =
            this.configService.getOrThrow<string>('googlesso.clientId');
        const clientSecret = this.configService.getOrThrow<string>(
            'googlesso.clientSecret',
        );

        const signUpRedirectUri = this.configService.getOrThrow<string>(
            'googlesso.signUpRedirectUri',
        );

        const signInRedirectUri = this.configService.getOrThrow<string>(
            'googlesso.signInredirectUri',
        );

        this.oauth2ClientSignUp = new OAuth2Client(
            clientId,
            clientSecret,
            signUpRedirectUri,
        );
        this.oauth2ClientSignIn = new OAuth2Client(
            clientId,
            clientSecret,
            signInRedirectUri,
        );
    }

    getAuthURLSignUp(): { authUrl: string } {
        const authURL = this.oauth2ClientSignUp.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
            ],
        });

        return { authUrl: authURL };
    }

    getAuthURLSignIn(): { authUrl: string } {
        const authURL = this.oauth2ClientSignIn.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
            ],
        });

        return { authUrl: authURL };
    }

    private async getUserInfo(accessToken: string): Promise<{
        given_name: string;
        email: string;
        family_name: string;
    } | null> {
        try {
            const response = await axios.get<{
                given_name: string;
                email: string;
                family_name: string;
            }>('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{
                    error_description?: string;
                }>;
                this.logger.error(
                    'Google user info Axios Error:',
                    axiosError.response?.data?.error_description ??
                        axiosError.message ??
                        'Unknown Axios Error',
                );
            } else if (error instanceof Error) {
                this.logger.error(`Google user info Error: ${error.message}`);
            } else {
                this.logger.error(
                    `Unknown Google user info error: ${String(error)}`,
                );
            }

            return null;
        }
    }

    async registerGoogleDetails(googleSignupDto: SignUpSSODto) {
        const { authorizationCode } = googleSignupDto;

        const code = Buffer.from(authorizationCode, 'base64').toString();

        let oauthUser: {
            given_name: string;
            email: string;
            family_name: string;
        };
        try {
            oauthUser = this.jwtService.verify(code, {
                secret: this.configService.getOrThrow<string>(
                    'jwt.verificationSecret',
                ),
            });
        } catch {
            throw new BadRequestException('Invalid signup session id');
        }

        return await this.authService.registerSSOUser(
            oauthUser.email,
            oauthUser.given_name,
            oauthUser.family_name,
            googleSignupDto,
        );
    }

    // called in backend
    async createSignUpSession(code: string) {
        try {
            const { tokens } = await this.oauth2ClientSignUp.getToken(code);
            this.oauth2ClientSignUp.setCredentials(tokens);
            this.logger.log('Google OAuth tokens retrieved successfully');
            if (tokens.access_token) {
                const oauthUser = await this.getUserInfo(tokens.access_token);
                if (!oauthUser) {
                    this.logger.error('OAuth user not found in google');
                    return {
                        status: 400,
                        error: 'OAuth user not found in google',
                    };
                } else {
                    const payload = {
                        email: oauthUser.email,
                        given_name: oauthUser.given_name,
                        family_name: oauthUser.family_name,
                    };

                    const accessToken = this.jwtService.sign(payload, {
                        secret: this.configService.getOrThrow<string>(
                            'jwt.verificationSecret',
                        ),
                    });

                    return {
                        status: 200,
                        accessToken:
                            Buffer.from(accessToken).toString('base64'),
                    };
                }
            } else {
                this.logger.log('Google OAuth tokens not found');
                return { status: 400, error: 'Google OAuth tokens not found' };
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{
                    error_description?: string;
                }>;
                this.logger.error(
                    'Google OAuth Axios Error:',
                    axiosError.response?.data?.error_description ??
                        axiosError.message ??
                        'Unknown Axios Error',
                );
                return {
                    status: 400,
                    error: `Google OAuth Axios Error: '${
                        axiosError.response?.data?.error_description ??
                        axiosError.message ??
                        'Unknown Axios Error'
                    }`,
                };
            } else if (error instanceof Error) {
                this.logger.error(`Google OAuth Error: ${error.message}`);
                return {
                    status: 400,
                    error: `Google OAuth Error: ${error.message}`,
                };
            } else {
                this.logger.error(
                    `Unknown Google OAuth error: ${String(error)}`,
                );
                return {
                    status: 400,
                    error: `Unknown Google OAuth error: ${String(error)}`,
                };
            }
        }
    }

    async verifyGoogleDetails(googleSignInDto: SignInSSODto) {
        try {
            const { authorizationCode } = googleSignInDto;
            const { tokens } =
                await this.oauth2ClientSignIn.getToken(authorizationCode);
            this.oauth2ClientSignIn.setCredentials(tokens);
            this.logger.log('Google OAuth tokens retrieved successfully');
            if (tokens.access_token) {
                const oauthUser = await this.getUserInfo(tokens.access_token);
                if (!oauthUser) {
                    this.logger.error('OAuth user not found in google');
                    throw new UnauthorizedException();
                } else {
                    return await this.authService.loginSSOUser(oauthUser.email);
                }
            } else {
                this.logger.log('Google OAuth tokens not found');
                throw new UnauthorizedException();
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{
                    error_description?: string;
                }>;
                this.logger.error(
                    'Google OAuth Axios Error:',
                    axiosError.response?.data?.error_description ??
                        axiosError.message ??
                        'Unknown Axios Error',
                );
            } else if (error instanceof Error) {
                this.logger.error(`Google OAuth Error: ${error.message}`);
            } else {
                this.logger.error(
                    `Unknown Google OAuth error: ${String(error)}`,
                );
            }
            throw new UnauthorizedException();
        }
    }
}
