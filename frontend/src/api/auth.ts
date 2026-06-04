import client from './client'
import type {
  ApiResponse,
  ForgotPasswordPayload,
  LoginResponse,
  RegisterPayload,
  ResetPasswordPayload,
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

  // ---- New: password reset flow ----
  /**
   * Request a password-reset email. Hits `POST /auth/forgot-password`
   * with `{ email }`. Backend should email the user a reset link.
   */
  forgotPassword: (payload: ForgotPasswordPayload) =>
    client
      .post<ApiResponse<null>>('/auth/forgot-password', payload)
      .then((r) => r.data),

  /**
   * Submit a new password using the token from the email link.
   * Hits `POST /auth/reset-password` with `{ token, password }`.
   */
  resetPassword: (payload: ResetPasswordPayload) =>
    client
      .post<ApiResponse<null>>('/auth/reset-password', payload)
      .then((r) => r.data),
}
