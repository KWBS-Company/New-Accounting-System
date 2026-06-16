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
  /** When true, restrict results to non-top-level accounts (plus EQUITY type). */
  showChildAccountOnly?: boolean
}

export const accountsApi = {
  list: (query: ListAccountQuery = {}) =>
    client.get<Paginated<Account> | { items: Account[] } | Account[]>(
      '/accounts',
      { params: query },
    ).then((r) => r.data),

  get: (id: string) =>
    client.get<Account>(`/accounts/${id}`).then((r) => (r.data as any).data as Account),

  /** GL detail (account + transaction lines). */
  ledger: (id: string) =>
    client.get<any>(`/accounts/${id}/ledger`).then((r) => {
      const raw: any = r.data
      return (raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw) as Account
    }),

  /** Download ledger PDF for one account. */
  ledgerPdf: (id: string) =>
    client.get(`/accounts/${id}/ledger/download`, { responseType: 'blob' }),

  create: (payload: CreateAccountPayload) =>
    client.post<Account>('/accounts', payload).then((r) => {
      const raw: any = r.data
      return (raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw) as Account
    }),

  update: (id: string, payload: { name: string }) =>
    client.patch<Account>(`/accounts/${id}`, payload).then((r) => r.data),

  remove: (id: string) =>
    client.delete<{ success: boolean }>(`/accounts/${id}`).then((r) => r.data),
}

export const accountTypesApi = {
  list: async (): Promise<AccountTypeOption[]> => {
    const res = await client.get<any>('/account-types')
    const raw = res.data

    if (Array.isArray(raw)) return raw as AccountTypeOption[]
    if (raw && Array.isArray(raw.data)) return raw.data as AccountTypeOption[]
    if (raw && Array.isArray(raw.items)) return raw.items as AccountTypeOption[]
    if (raw && Array.isArray(raw.results)) return raw.results as AccountTypeOption[]

    return []
  },
}
