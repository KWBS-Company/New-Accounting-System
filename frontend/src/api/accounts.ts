import client from './client'
import type {
  Account,
  AccountTypeOption,
  CreateAccountPayload,
  Paginated,
} from '@/types'

export type ListAccountQuery = {
  search?: string
  accountType?: string
  page?: number
  pageSize?: number
}

// The backend returns the entity/paginated payload directly (no { data } wrap) for these.
// We type the resolved value as whatever it sends — defensive parsing happens in the page.
export const accountsApi = {
  list: (query: ListAccountQuery = {}) =>
    client.get<Paginated<Account> | { items: Account[] } | Account[]>(
      '/accounts',
      { params: query },
    ).then((r) => r.data),

  get: (id: string) =>
    client.get<Account>(`/accounts/${id}`).then((r) => r.data),

  create: (payload: CreateAccountPayload) =>
    client.post<Account>('/accounts', payload).then((r) => r.data),

  update: (id: string, payload: { name: string }) =>
    client.patch<Account>(`/accounts/${id}`, payload).then((r) => r.data),

  remove: (id: string) =>
    client.delete<{ success: boolean }>(`/accounts/${id}`).then((r) => r.data),
}

export const accountTypesApi = {
  list: async (): Promise<AccountTypeOption[]> => {
    const res = await client.get<any>('/account-types')
    const raw = res.data

    // Defensive: different backends may wrap lists differently.
    if (Array.isArray(raw)) return raw as AccountTypeOption[]
    if (raw && Array.isArray(raw.data)) return raw.data as AccountTypeOption[]
    if (raw && Array.isArray(raw.items)) return raw.items as AccountTypeOption[]
    if (raw && Array.isArray(raw.results)) return raw.results as AccountTypeOption[]

    return []
  },
}
