import client from './client'
import type { ReportQuery } from '@/types'

export const reportsApi = {
  listAll: (query: ReportQuery & { page?: number; pageSize?: number } = {}) =>
    client.get('/account-reports', { params: query }).then((r) => r.data),

  trialBalance: (query: ReportQuery = {}) =>
    client
      .get('/account-reports/trial-balance', { params: query })
      .then((r) => r.data),

  profitAndLoss: (query: ReportQuery = {}) =>
    client.get('/account-reports/pl', { params: query }).then((r) => r.data),

  balanceSheet: (query: ReportQuery = {}) =>
    client
      .get('/account-reports/balance-sheet', { params: query })
      .then((r) => r.data),

  // ---- downloads ----
  downloadTrialBalanceExcel: (query: ReportQuery = {}) =>
    client.get('/account-reports/trial-balance/excel', {
      params: query,
      responseType: 'blob',
    }),

  downloadTrialBalancePdf: (query: ReportQuery = {}) =>
    client.get('/account-reports/trial-balance/pdf', {
      params: query,
      responseType: 'blob',
    }),

  downloadPlExcel: (query: ReportQuery = {}) =>
    client.get('/account-reports/pl/excel', {
      params: query,
      responseType: 'blob',
    }),

  downloadPlPdf: (query: ReportQuery = {}) =>
    client.get('/account-reports/pl/pdf', {
      params: query,
      responseType: 'blob',
    }),

  downloadBalanceSheetExcel: (query: ReportQuery = {}) =>
    client.get('/account-reports/balance-sheet/excel', {
      params: query,
      responseType: 'blob',
    }),

  downloadBalanceSheetPdf: (query: ReportQuery = {}) =>
    client.get('/account-reports/balance-sheet/pdf', {
      params: query,
      responseType: 'blob',
    }),
}
