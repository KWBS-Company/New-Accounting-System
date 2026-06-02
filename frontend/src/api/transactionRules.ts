import client from './client'
import type {
  ApiResponse,
  CreateTransactionRulePayload,
  Paginated,
  TransactionRule,
} from '@/types'

export type ListTransactionRuleQuery = {
  search?: string
  page?: number
  pageSize?: number
}

export const transactionRulesApi = {
  list: (query: ListTransactionRuleQuery = {}) =>
    client
      .get<
        | Paginated<TransactionRule>
        | { items: TransactionRule[] }
        | TransactionRule[]
      >('/transaction-rules', { params: query })
      .then((r) => r.data),

  get: (id: string) =>
    client
      .get<TransactionRule | ApiResponse<TransactionRule>>(
        `/transaction-rules/${id}`,
      )
      .then((r) => {
        const raw: any = r.data
        return raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw
      }),

  create: (payload: CreateTransactionRulePayload) =>
    client
      .post<TransactionRule>('/transaction-rules', payload)
      .then((r) => r.data),

  update: (
    id: string,
    payload: {
      name: string
      description: string
      transactionType: string
      rules: Array<{ ruleId: string; accountId: string; increase: boolean }>
    },
  ) =>
    client
      .put<TransactionRule>(`/transaction-rules/${id}`, payload)
      .then((r) => r.data),

  remove: (id: string) =>
    client
      .delete<{ success: boolean }>(`/transaction-rules/${id}`)
      .then((r) => r.data),
}
