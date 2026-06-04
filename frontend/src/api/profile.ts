import client from './client'
import type {
  ApiResponse,
  ChangePasswordPayload,
  UpdateProfilePayload,
  User,
} from '@/types'

export const profileApi = {
  /** PATCH `/auth/profile` — partial update of name/phone. */
  updateProfile: (payload: UpdateProfilePayload) =>
    client
      .patch<ApiResponse<User>>('/auth/profile', payload)
      .then((r) => r.data),

  /**
   * POST `/auth/change-password` — change password while logged in.
   * Body: `{ currentPassword, newPassword }`.
   */
  changePassword: (payload: ChangePasswordPayload) =>
    client
      .post<ApiResponse<null>>('/auth/change-password', payload)
      .then((r) => r.data),

  /**
   * POST `/auth/avatar` (multipart) — upload a profile image file.
   * The backend should respond with `{ data: { avatarUrl } }` (or the updated User).
   */
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client
      .post<ApiResponse<{ avatarUrl: string } | User>>('/auth/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}
