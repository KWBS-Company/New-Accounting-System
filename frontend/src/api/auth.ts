import client from './client'
import type {
  ApiResponse,
  ForgotPasswordPayload,
  GoogleAuthUrlResponse,
  LoginResponse,
  RegisterPayload,
  ResetPasswordPayload,
  SignInSSOPayload,
  SignUpSSOPayload,
  User,
} from '@/types'

export const authApi = {
  // ---- Existing endpoints (unchanged) ----
  register: (payload: RegisterPayload) =>
    client
      .post<ApiResponse<{ userId: string }>>('/auth/register', payload)
      .then((r) => r.data),

  login: (email: string, password: string) =>
    client
      .post<ApiResponse<LoginResponse>>('/auth/login', { email, password })
      .then((r) => r.data),

  verifyEmail: (token: string) =>
    client
      .get<ApiResponse<null>>('/auth/verify-email', { params: { token } })
      .then((r) => r.data),

  resendVerification: (email: string) =>
    client
      .post<ApiResponse<null>>('/auth/resend-verification', { email })
      .then((r) => r.data),

  me: () =>
    client.get<ApiResponse<User>>('/auth/me').then((r) => r.data),

  // ---- Password reset flow ----
  forgotPassword: (payload: ForgotPasswordPayload) =>
    client
      .post<ApiResponse<null>>('/auth/forgot-password', payload)
      .then((r) => r.data),

  resetPassword: (payload: ResetPasswordPayload) =>
    client
      .post<ApiResponse<null>>('/auth/reset-password', payload)
      .then((r) => r.data),

  // ---- Google SSO ----
  /** GET `/auth/google-sso/register-url` — backend returns `{ authUrl }`. */
  googleRegisterUrl: () =>
    client
      .get<GoogleAuthUrlResponse | ApiResponse<GoogleAuthUrlResponse>>(
        '/auth/google-sso/register-url',
      )
      .then((r) => r.data),

  /** GET `/auth/google-sso/login-url` — backend returns `{ authUrl }`. */
  googleLoginUrl: () =>
    client
      .get<GoogleAuthUrlResponse | ApiResponse<GoogleAuthUrlResponse>>(
        '/auth/google-sso/login-url',
      )
      .then((r) => r.data),

  /**
   * POST `/auth/google-sso/register-details` — finalize Google signup
   * by sending the auth code and the company details captured from the
   * SSO form.
   */
  googleRegisterDetails: (payload: SignUpSSOPayload) =>
    client
      .post<ApiResponse<LoginResponse> | LoginResponse>(
        '/auth/google-sso/register-details',
        payload,
      )
      .then((r) => r.data),

  /**
   * POST `/auth/google-sso/verify-details` — login via Google. The
   * backend exchanges the auth code for an access token.
   */
  googleVerifyDetails: (payload: SignInSSOPayload) =>
    client
      .post<ApiResponse<LoginResponse> | LoginResponse>(
        '/auth/google-sso/verify-details',
        payload,
      )
      .then((r) => r.data),
}
