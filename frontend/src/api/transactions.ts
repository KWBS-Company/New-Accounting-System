import client from './client'
import type {
  CreateTransactionPayload,
  Paginated,
  Transaction,
} from '@/types'

export type ListTransactionQuery = {
  search?: string
  page?: number
  pageSize?: number
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
    client.get<Transaction>(`/transactions/${id}`).then((r) => r.data),

  create: (payload: CreateTransactionPayload) =>
    client.post<Transaction>('/transactions', payload).then((r) => r.data),

  update: (id: string, payload: CreateTransactionPayload) =>
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
    return client.post('/transactions/upload-excel', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
}
