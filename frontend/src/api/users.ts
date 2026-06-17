import client from './client'
import type {
  ApiResponse,
  InviteUserPayload,
  Paginated,
  User,
  VerifyInviteUserPayload,
} from '@/types'

export type ListUsersQuery = {
  search?: string
  page?: number
  pageSize?: number
}

export const usersApi = {
  /** GET `/users` — paginated list. Scope is enforced server-side by role. */
  list: (query: ListUsersQuery = {}) =>
    client
      .get<Paginated<User> | { items: User[] } | User[]>('/users', {
        params: query,
      })
      .then((r) => r.data),

  /** POST `/users/invite-user` — customer_admin only. Sends an email invite. */
  invite: (payload: InviteUserPayload) =>
    client
      .post<ApiResponse<null>>('/users/invite-user', payload)
      .then((r) => r.data),

  /**
   * POST `/users/verify-invite-user` — public; accepts the invitation token
   * plus the new user's details and finalizes their profile / password.
   */
  verifyInvite: (payload: VerifyInviteUserPayload) =>
    client
      .post<ApiResponse<null>>('/users/verify-invite-user', payload)
      .then((r) => r.data),

  /** DELETE `/users/:id` — super_admin or customer_admin. */
  remove: (id: string) =>
    client.delete<ApiResponse<null>>(`/users/${id}`).then((r) => r.data),

  /** PATCH `/users/:id` — super_admin only; toggles activation. */
  toggleActivation: (id: string) =>
    client.patch<ApiResponse<null>>(`/users/${id}/activate`).then((r) => r.data),

  /** PATCH `/users/:id` — super_admin only; toggles activation. */
  toggleDeactivation: (id: string) =>
    client.patch<ApiResponse<null>>(`/users/${id}/deactivate`).then((r) => r.data),
}
