import { useCallback, useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { reportsApi } from '@/api/reports'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  accountTypeChipClass,
  downloadBlob,
  formatNumber,
} from '@/lib/utils'
import type { AccountType, ReportQuery } from '@/types'

type ReportKind = 'trial' | 'pl' | 'bs'

const TABS: { key: ReportKind; label: string; sub: string }[] = [
  { key: 'trial', label: 'Trial balance', sub: 'Sum of debits and credits, account by account.' },
  { key: 'pl',    label: 'Profit & loss', sub: 'Revenue, less expenses, equals income.' },
  { key: 'bs',    label: 'Balance sheet', sub: 'Assets = Liabilities + Equity, at a point in time.' },
]

export default function Reports() {
  const { toast } = useToast()

  const [tab, setTab] = useState<ReportKind>('trial')
  const [filters, setFilters] = useState<ReportQuery>({})
  const [rows, setRows] = useState<any[]>([])
  const [raw, setRaw] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Normalise whatever the report returns into a flat row list for the table.
  const normaliseReport = (data: any): any[] => {
    if (!data) return []
    if (Array.isArray(data)) return data
    // Common shapes seen in NestJS report services
    if (Array.isArray(data.rows)) return data.rows
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.lines)) return data.lines
    if (Array.isArray(data.accounts)) return data.accounts
    // P&L / BS sometimes return { revenue: [...], expenses: [...] } etc.
    const sections: any[] = []
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        sections.push({ __section: key, items: value })
      }
    }
    if (sections.length) return sections
    return []
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      let data: any
      if (tab === 'trial') data = await reportsApi.trialBalance(filters)
      if (tab === 'pl')    data = await reportsApi.profitAndLoss(filters)
      if (tab === 'bs')    data = await reportsApi.balanceSheet(filters)
      setRaw(data)
      setRows(normaliseReport(data))
    } catch (err) {
      toast(extractApiError(err), 'error')
      setRows([])
      setRaw(null)
    } finally {
      setLoading(false)
    }
  }, [tab, filters, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const download = async (format: 'excel' | 'pdf') => {
    try {
      let res
      if (tab === 'trial') {
        res = format === 'excel'
          ? await reportsApi.downloadTrialBalanceExcel(filters)
          : await reportsApi.downloadTrialBalancePdf(filters)
      } else if (tab === 'pl') {
        res = format === 'excel'
          ? await reportsApi.downloadPlExcel(filters)
          : await reportsApi.downloadPlPdf(filters)
      } else {
        res = format === 'excel'
          ? await reportsApi.downloadBalanceSheetExcel(filters)
          : await reportsApi.downloadBalanceSheetPdf(filters)
      }
      const filename = `${tab}-${new Date().toISOString().slice(0,10)}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      downloadBlob(res.data, filename)
      toast(`${format.toUpperCase()} downloaded`, 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const isSectioned = rows.some((r) => r?.__section)

  // ----- Totals -----
  const totals = (() => {
    if (isSectioned) return null
    const sums = rows.reduce(
      (acc, r) => {
        acc.debit  += parseFloat(String(r.debit  ?? r.totalDebit  ?? 0)) || 0
        acc.credit += parseFloat(String(r.credit ?? r.totalCredit ?? 0)) || 0
        return acc
      },
      { debit: 0, credit: 0 },
    )
    return sums
  })()

  const activeTab = TABS.find((t) => t.key === tab)!

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Statements."
        subtitle="Run the three foundational reports — trial balance, P&L, and balance sheet — then export."
        actions={
          <div className="flex gap-2">
            <button onClick={() => download('excel')} className="btn-secondary">
              ↓ Excel
            </button>
            <button onClick={() => download('pdf')} className="btn-primary">
              ↓ PDF
            </button>
          </div>
        }
      />

      <div className="px-10 py-8 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-sand">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'px-5 py-3 text-sm font-medium transition-colors relative -mb-px',
                tab === t.key
                  ? 'text-ink-900 border-b-2 border-emerald_ledger-500'
                  : 'text-ink-500 hover:text-ink-900 border-b-2 border-transparent',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-ink-500 mb-6">{activeTab.sub}</p>

        {/* Filters */}
        <div className="card p-5 mb-6 grid sm:grid-cols-4 gap-4">
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="field"
              value={filters.transactionFrom ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  transactionFrom: e.target.value || undefined,
                }))
              }
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="field"
              value={filters.transactionTo ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  transactionTo: e.target.value || undefined,
                }))
              }
            />
          </div>
          <div>
            <label className="label">Account type</label>
            <select
              className="field"
              value={filters.accountType ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  accountType: (e.target.value as AccountType) || undefined,
                }))
              }
            >
              <option value="">All</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
          <div>
            <label className="label">Account code</label>
            <input
              className="field font-mono uppercase"
              value={filters.accountCode ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  accountCode: e.target.value.toUpperCase() || undefined,
                }))
              }
              placeholder="CASH"
            />
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-ink-500 text-sm">
              Computing…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="font-mono text-emerald_ledger-500 text-2xl mb-2">∅</div>
              <p className="text-ink-500 text-sm">
                No data for the selected filters.
              </p>
              {raw && (
                <details className="mt-4 text-left max-w-md mx-auto">
                  <summary className="text-xs font-mono text-ink-500 cursor-pointer">
                    See raw response
                  </summary>
                  <pre className="text-xs bg-parchment-100 p-3 mt-2 overflow-auto">
                    {JSON.stringify(raw, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : isSectioned ? (
            <div className="divide-y divide-sand">
              {rows.map((section: any) => (
                <div key={section.__section} className="p-6">
                  <h3 className="font-display text-2xl tracking-tightest text-ink-900 capitalize mb-3">
                    {section.__section}
                  </h3>
                  <table className="table-ledger">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th className="!text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((row: any, i: number) => (
                        <tr key={i}>
                          <td className="font-mono text-emerald_ledger-500 text-xs">
                            {row.code ?? '—'}
                          </td>
                          <td>{row.name ?? row.accountName ?? '—'}</td>
                          <td className="text-right font-mono tabular">
                            {formatNumber(
                              row.balance ?? row.amount ?? row.total ?? 0,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <table className="table-ledger">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th className="!text-right">Debit</th>
                  <th className="!text-right">Credit</th>
                  <th className="!text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, i: number) => {
                  const debit  = parseFloat(String(row.debit  ?? row.totalDebit  ?? 0)) || 0
                  const credit = parseFloat(String(row.credit ?? row.totalCredit ?? 0)) || 0
                  const balance =
                    row.balance !== undefined
                      ? parseFloat(String(row.balance)) || 0
                      : debit - credit
                  return (
                    <tr key={row.accountId ?? row.id ?? i}>
                      <td className="font-mono text-emerald_ledger-500 text-xs">
                        {row.code ?? '—'}
                      </td>
                      <td className="font-medium">
                        {row.name ?? row.accountName ?? '—'}
                      </td>
                      <td>
                        {row.accountType ? (
                          <span className={accountTypeChipClass(row.accountType)}>
                            {row.accountType}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="text-right font-mono tabular">
                        {debit > 0 ? formatNumber(debit) : '—'}
                      </td>
                      <td className="text-right font-mono tabular">
                        {credit > 0 ? formatNumber(credit) : '—'}
                      </td>
                      <td className="text-right font-mono tabular font-medium">
                        {formatNumber(balance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-parchment-100 border-t-2 border-ink-900">
                    <td colSpan={3} className="px-4 py-3 font-display text-base">
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular font-medium">
                      {formatNumber(totals.debit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular font-medium">
                      {formatNumber(totals.credit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular font-medium">
                      {formatNumber(totals.debit - totals.credit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </>
  )
}
