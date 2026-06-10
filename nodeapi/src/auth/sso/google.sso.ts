import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from 'google-auth-library';
import axios, { AxiosError } from 'axios';
import { SignInSSODto, SignUpSSODto } from "../dto/sso.dto";
import { AuthService } from "../auth.service";

@Injectable()
export class GoogleSSOService {
    private readonly oauth2Client: OAuth2Client;
    private readonly logger = new Logger(GoogleSSOService.name);
    constructor(private readonly configService: ConfigService,
        private readonly authService: AuthService
    ) {
        const clientId = this.configService.getOrThrow<string>('googlesso.clientId')
        const clientSecret =
            this.configService.getOrThrow<string>('googlesso.clientSecret')
        const redirectUri =
            this.configService.getOrThrow<string>('googlesso.redirectUri')

        this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    }

    getAuthURL(): { authUrl: string } {
        const authURL = this.oauth2Client.generateAuthUrl({
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
                const axiosError = error as AxiosError<{ error_description?: string }>;
                this.logger.error(
                    'Google user info Axios Error:',
                    axiosError.response?.data?.error_description ??
                    axiosError.message ??
                    'Unknown Axios Error',
                );
            } else if (error instanceof Error) {
                this.logger.error(`Google user info Error: ${error.message}`);
            } else {
                this.logger.error(`Unknown Google user info error: ${String(error)}`);
            }

            return null;
        }
    }

    async registerGoogleDetails(googleSignupDto: SignUpSSODto) {
        try {
            const { authorizationCode } = googleSignupDto;
            const { tokens } = await this.oauth2Client.getToken(authorizationCode);
            this.oauth2Client.setCredentials(tokens);
            this.logger.log('Google OAuth tokens retrieved successfully');
            if (tokens.access_token) {
                const oauthUser = await this.getUserInfo(tokens.access_token);
                if (!oauthUser) {
                    this.logger.error('OAuth user not found in google');
                    throw new UnauthorizedException();
                } else {
                    return await this.authService.registerSSOUser(
                        oauthUser.email,
                        oauthUser.given_name,
                        oauthUser.family_name,
                        googleSignupDto,
                    );
                }
            } else {
                this.logger.log('Google OAuth tokens not found');
                throw new UnauthorizedException();
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{ error_description?: string }>;
                this.logger.error(
                    'Google OAuth Axios Error:',
                    axiosError.response?.data?.error_description ??
                    axiosError.message ??
                    'Unknown Axios Error',
                );
            } else if (error instanceof Error) {
                this.logger.error(`Google OAuth Error: ${error.message}`);
            } else {
                this.logger.error(`Unknown Google OAuth error: ${String(error)}`);
            }
            throw new UnauthorizedException();
        }
    }


    async verifyGoogleDetails(googleSignInDto: SignInSSODto) {
        try {
            const { authorizationCode } = googleSignInDto;
            const { tokens } = await this.oauth2Client.getToken(authorizationCode);
            this.oauth2Client.setCredentials(tokens);
            this.logger.log('Google OAuth tokens retrieved successfully');
            if (tokens.access_token) {
                const oauthUser = await this.getUserInfo(tokens.access_token);
                if (!oauthUser) {
                    this.logger.error('OAuth user not found in google');
                    throw new UnauthorizedException();
                } else {
                    return await this.authService.loginSSOUser(
                        oauthUser.email,
                    );
                }
            } else {
                this.logger.log('Google OAuth tokens not found');
                throw new UnauthorizedException();
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError<{ error_description?: string }>;
                this.logger.error(
                    'Google OAuth Axios Error:',
                    axiosError.response?.data?.error_description ??
                    axiosError.message ??
                    'Unknown Axios Error',
                );
            } else if (error instanceof Error) {
                this.logger.error(`Google OAuth Error: ${error.message}`);
            } else {
                this.logger.error(`Unknown Google OAuth error: ${String(error)}`);
            }
            throw new UnauthorizedException();
        }
    }
}