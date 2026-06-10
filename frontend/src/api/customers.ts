import client from './client'
import type {
  ApiResponse,
  Customer,
  Paginated,
  UpdateCustomerPayload,
} from '@/types'

export type ListCustomersQuery = {
  search?: string
  page?: number
  pageSize?: number
}

export const customersApi = {
  /** GET `/customers` — super_admin only. */
  list: (query: ListCustomersQuery = {}) =>
    client
      .get<Paginated<Customer> | { items: Customer[] } | Customer[]>(
        '/customers',
        { params: query },
      )
      .then((r) => r.data),

  /** GET `/customers/:id` — super_admin or customer_admin (own only). */
  get: (id: string) =>
    client.get<Customer>(`/customers/${id}`).then((r) => (r.data as any).data as Customer),

  /** PUT `/customers/:id` — super_admin or customer_admin (own only). */
  update: (id: string, payload: UpdateCustomerPayload) =>
    client
      .put<ApiResponse<null>>(`/customers/${id}`, payload)
      .then((r) => r.data),

  /**
   * PATCH `/customers/:id/upload-company-logo` (multipart).
   * Backend returns `{ avatarUrl }` — absolute URL to the new logo.
   */
  uploadLogo: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client
      .patch<ApiResponse<{ avatarUrl: string }> | { avatarUrl: string }>(
        `/customers/${id}/upload-company-logo`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data)
  },
}
