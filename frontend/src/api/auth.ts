import client from './client'
import type { ApiResponse, LoginResponse, RegisterPayload, User } from '@/types'

export const authApi = {
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
}
