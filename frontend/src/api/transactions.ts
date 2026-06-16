import client from './client'
import type {
  CreateTransactionPayload,
  Paginated,
  PreviewLinesPayload,
  Transaction,
  TransactionLine,
  UpdateTransactionPayload,
} from '@/types'

export type ListTransactionQuery = {
  search?: string
  page?: number
  pageSize?: number
  transactionFrom?: string
  transactionTo?: string
  fiscalYearId?: string
}

export const transactionsApi = {
  list: (query: ListTransactionQuery = {}) =>
    client
      .get<Paginated<Transaction> | { items: Transaction[] } | Transaction[]>(
        '/transactions',
        { params: query },
      )
      .then((r) => r.data),

  get: (id: string) =>
    client.get<Transaction>(`/transactions/${id}`).then((r) => {
      const raw: any = r.data
      return (raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw) as Transaction
    }),

  /**
   * Preview balanced lines for a given amount/description/transactionTypeId.
   * The backend returns an array of TransactionLine objects with computed
   * debit / credit pairs derived from the chosen rule.
   */
  previewLines: (payload: PreviewLinesPayload) =>
    client
      .post<TransactionLine[] | { data: TransactionLine[] }>(
        '/transactions/preview-lines',
        payload,
      )
      .then((r) => {
        const raw: any = r.data
        const lines = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw
        return (Array.isArray(lines) ? lines : []) as TransactionLine[]
      }),

  create: (payload: CreateTransactionPayload) =>
    client.post<Transaction>('/transactions', payload).then((r) => r.data),

  update: (id: string, payload: UpdateTransactionPayload) =>
    client.put<Transaction>(`/transactions/${id}`, payload).then((r) => r.data),

  remove: (id: string) =>
    client
      .delete<{ success: boolean }>(`/transactions/${id}`)
      .then((r) => r.data),

  downloadTemplate: () =>
    client.get('/transactions/download/template', { responseType: 'blob' }),

  downloadVoucher: (id: string) =>
    client.get(`/transactions/${id}/download`, { responseType: 'blob' }),

  uploadExcel: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client
      .post('/transactions/upload-excel', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}
