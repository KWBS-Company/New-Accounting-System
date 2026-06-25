import client from './client'
import type {
  Account,
  AccountTypeOption,
  CreateAccountPayload,
  LedgerQuery,
  LedgerResponse,
  Paginated,
} from '@/types'

export type ListAccountQuery = {
  search?: string
  accountType?: string
  page?: number
  pageSize?: number
  showChildAccountOnly?: boolean
}

export const accountsApi = {
  list: (query: ListAccountQuery = {}) =>
    client.get<Paginated<Account> | { items: Account[] } | Account[]>(
      '/accounts',
      { params: query },
    ).then((r) => r.data),

  get: (id: string) =>
    client.get<Account>(`/accounts/${id}`).then((r) => r.data),

  /** GL detail — now returns the full LedgerResponse shape. */
  ledger: (id: string, query: LedgerQuery = {}): Promise<LedgerResponse> =>
    client
      .get<any>(`/accounts/${id}/ledger`, { params: query })
      .then((r) => {
        const raw: any = r.data
        return (raw && typeof raw === 'object' && 'data' in raw
          ? raw.data
          : raw) as LedgerResponse
      }),

  /** Download ledger PDF — filters forwarded as query params. */
  ledgerPdf: (id: string, query: LedgerQuery = {}) =>
    client.get(`/accounts/${id}/ledger/download`, {
      responseType: 'blob',
      params: query,
    }),

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