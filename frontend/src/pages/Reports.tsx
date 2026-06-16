import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CircleDashed,
  Download,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { reportsApi } from '@/api/reports'
import { accountsApi } from '@/api/accounts'
import { customerFiscalYearsApi } from '@/api/customers'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  accountTypeChipClass,
  cn,
  downloadBlob,
  formatCurrency,
  normalizeList,
} from '@/lib/utils'
import { LedgerModal } from '@/pages/Accounts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { NepaliDatePicker } from '@/components/common/NepaliDatePicker'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  Account,
  AccountType,
  CustomerFiscalYear,
  ReportQuery,
} from '@/types'

type ReportKind = 'trial' | 'pl' | 'bs'

const TABS: { key: ReportKind; label: string; sub: string }[] = [
  { key: 'trial', label: 'Trial balance',  sub: 'Sum of debits and credits, account by account.' },
  { key: 'pl',    label: 'Profit & loss',  sub: 'Revenue, less expenses, equals income.' },
  { key: 'bs',    label: 'Balance sheet',  sub: 'Assets = Liabilities + Equity, at a point in time.' },
]

// ---------------------------------------------------------------------------
// Response parsers — rebuilt to match the latest backend response shape
//
// /trial-balance →  { items: TrialRow[], summary: { totalDebit, totalCredit } }
// /pl            →  { items: PLRow[],   summary: { totalRevenue, totalExpense, netProfit } }
// /balance-sheet →  { items: BSRow[],   summary: { totalAssets, totalLiabilities,
//                                                   totalEquity, totalLiabilitiesAndEquity,
//                                                   currentYearNetPL } }
//
// Each `row` carries: id, name, code, accountType, debit, credit, balance.
// ---------------------------------------------------------------------------

type ReportRow = {
  id?: string
  accountId?: string
  code?: string
  name?: string
  accountType?: AccountType
  amount?: number
  balance?: number
  debit?: number
  credit?: number
  [k: string]: any
}

type ReportSection = {
  key: string
  label: string
  items: ReportRow[]
  total: number
}

function num(v: any): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function unwrap(raw: any): any {
  if (raw && typeof raw === 'object' && 'data' in raw && raw.data && !Array.isArray(raw.data)) {
    return raw.data
  }
  return raw
}

/** Parse the new trial-balance response shape (rule 5). */
function parseTrialBalance(raw: any): {
  rows: ReportRow[]
  totals: { debit: number; credit: number }
} {
  const root = unwrap(raw) ?? {}
  const items: ReportRow[] = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.rows)
      ? root.rows
      : Array.isArray(root)
        ? root
        : []
  const summary = root.summary ?? {}
  const totals = {
    debit: num(summary.totalDebit ?? items.reduce((s, r) => s + num(r.debit), 0)),
    credit: num(summary.totalCredit ?? items.reduce((s, r) => s + num(r.credit), 0)),
  }
  return { rows: items, totals }
}

/** Parse the P&L response — kept simple, matches summary shape. */
function parsePnl(raw: any): { sections: ReportSection[]; netIncome: number } {
  const root = unwrap(raw) ?? {}
  const items: ReportRow[] = Array.isArray(root.items) ? root.items : []
  const summary = root.summary ?? {}

  const revenue = items.filter((x) => x.accountType === 'REVENUE')
  const expense = items.filter((x) => x.accountType === 'EXPENSE')

  return {
    sections: [
      {
        key: 'revenue',
        label: 'Revenue',
        items: revenue,
        total: num(summary.totalRevenue ?? revenue.reduce((s, r) => s + num(r.balance), 0)),
      },
      {
        key: 'expense',
        label: 'Expense',
        items: expense,
        total: num(summary.totalExpense ?? expense.reduce((s, r) => s + num(r.balance), 0)),
      },
    ],
    netIncome: num(summary.netProfit ?? 0),
  }
}

/** Parse the balance-sheet response — extra `currentYearNetPL` from rule 4. */
function parseBalanceSheet(raw: any): {
  sections: ReportSection[]
  totals: {
    assets: number
    liabilities: number
    equity: number
    liabilitiesAndEquity: number
    currentYearNetPL: number
  }
} {
  const root = unwrap(raw) ?? {}
  const items: ReportRow[] = Array.isArray(root.items) ? root.items : []
  const summary = root.summary ?? {}

  const assets = items.filter((x) => x.accountType === 'ASSET')
  const liabilities = items.filter((x) => x.accountType === 'LIABILITY')
  const equity = items.filter((x) => x.accountType === 'EQUITY')

  return {
    sections: [
      {
        key: 'assets',
        label: 'Assets',
        items: assets,
        total: num(summary.totalAssets ?? assets.reduce((s, r) => s + num(r.balance), 0)),
      },
      {
        key: 'liabilities',
        label: 'Liabilities',
        items: liabilities,
        total: num(summary.totalLiabilities ?? liabilities.reduce((s, r) => s + num(r.balance), 0)),
      },
      {
        key: 'equity',
        label: 'Equity',
        items: equity,
        // Note: backend's totalEquity already includes the current-year P/L,
        // so we subtract it back out here to render the "Equity" subtotal
        // BEFORE the net P/L line for the rule-4 dual-row presentation below.
        total: num(
          (summary.totalEquity ?? equity.reduce((s, r) => s + num(r.balance), 0)) -
            num(summary.currentYearNetPL ?? 0),
        ),
      },
    ],
    totals: {
      assets: num(summary.totalAssets ?? 0),
      liabilities: num(summary.totalLiabilities ?? 0),
      equity: num(summary.totalEquity ?? 0),
      liabilitiesAndEquity: num(
        summary.totalLiabilitiesAndEquity ??
          num(summary.totalLiabilities) + num(summary.totalEquity),
      ),
      currentYearNetPL: num(summary.currentYearNetPL ?? 0),
    },
  }
}

// ---------------------------------------------------------------------------

export default function Reports() {
  const { toast } = useToast()

  const [tab, setTab] = useState<ReportKind>('trial')
  const [filters, setFilters] = useState<ReportQuery>({})
  const [raw, setRaw] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  // Rule 4: load fiscal years + accounts so we can offer filter dropdowns.
  const [fiscalYears, setFiscalYears] = useState<CustomerFiscalYear[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  // Rule 1: ledger detail launched from a trial-balance row.
  const [ledgerAccount, setLedgerAccount] = useState<Account | null>(null)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)

  useEffect(() => {
    customerFiscalYearsApi
      .list()
      .then(setFiscalYears)
      .catch(() => {})
    accountsApi
      .list({ pageSize: 500 })
      .then((res) => setAccounts(normalizeList<Account>(res).items))
      .catch(() => {})
  }, [])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      let data: any
      if (tab === 'trial') data = await reportsApi.trialBalance(filters)
      if (tab === 'pl')    data = await reportsApi.profitAndLoss(filters)
      if (tab === 'bs')    data = await reportsApi.balanceSheet(filters)
      setRaw(data)
    } catch (err) {
      toast(extractApiError(err), 'error')
      setRaw(null)
    } finally {
      setLoading(false)
    }
  }, [tab, filters, toast])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Rule 4: PL and BS no longer use accountCode / accountType filters. Strip
  // them when those tabs are open so a stale value from the TB tab doesn't
  // leak into the next fetch.
  useEffect(() => {
    if (tab === 'pl' || tab === 'bs') {
      setFilters((f) => {
        if (f.accountCode === undefined && f.accountType === undefined) return f
        const { accountCode: _ac, accountType: _at, ...rest } = f
        return rest
      })
    }
  }, [tab])

  const download = async (format: 'excel' | 'pdf') => {
    try {
      let res
      if (tab === 'trial') {
        res =
          format === 'excel'
            ? await reportsApi.downloadTrialBalanceExcel(filters)
            : await reportsApi.downloadTrialBalancePdf(filters)
      } else if (tab === 'pl') {
        res =
          format === 'excel'
            ? await reportsApi.downloadPlExcel(filters)
            : await reportsApi.downloadPlPdf(filters)
      } else {
        res =
          format === 'excel'
            ? await reportsApi.downloadBalanceSheetExcel(filters)
            : await reportsApi.downloadBalanceSheetPdf(filters)
      }
      const filename = `${tab}-${new Date().toISOString().slice(0, 10)}.${
        format === 'excel' ? 'xlsx' : 'pdf'
      }`
      downloadBlob(res.data, filename)
      toast(`${format.toUpperCase()} downloaded`, 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  // Rule 1: view GL ledger for an account from a TB row.
  const openLedger = async (row: ReportRow) => {
    const id = row.id ?? row.accountId
    if (!id) return
    const stub = accounts.find((a) => a.id === id) ?? {
      id,
      name: row.name ?? '',
      code: row.code ?? '',
      accountType: (row.accountType ?? 'ASSET') as AccountType,
      parentId: null,
    }
    setLedgerAccount(stub as Account)
    setLedgerOpen(true)
    setLedgerLoading(true)
    try {
      const full = await accountsApi.ledger(id)
      setLedgerAccount(full)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }

  const downloadLedger = async (id: string) => {
    try {
      const res = await accountsApi.ledgerPdf(id)
      downloadBlob(res.data, `ledger-${id.slice(0, 8)}.pdf`)
      toast('Ledger PDF downloaded', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const activeTab = TABS.find((t) => t.key === tab)!

  const trialParsed = tab === 'trial' ? parseTrialBalance(raw) : null
  const pl = tab === 'pl' ? parsePnl(raw) : null
  const bs = tab === 'bs' ? parseBalanceSheet(raw) : null

  const isEmpty =
    (tab === 'trial' && (!trialParsed || trialParsed.rows.length === 0)) ||
    (tab === 'pl' && (!pl || pl.sections.every((s) => s.items.length === 0))) ||
    (tab === 'bs' && (!bs || bs.sections.every((s) => s.items.length === 0)))

  // ---- Filter helpers ----
  const clearFilters = () => setFilters({})

  const hasAnyFilter = useMemo(
    () =>
      !!(
        filters.transactionFrom ||
        filters.transactionTo ||
        filters.accountType ||
        filters.accountCode ||
        filters.fiscalYearId
      ),
    [filters],
  )

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Statements."
        subtitle="Run the three foundational reports — trial balance, P&L, and balance sheet — then export."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => download('excel')} variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button onClick={() => download('pdf')} size="sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as ReportKind)}>
          <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto mb-4">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <p className="text-sm text-muted-foreground mb-6">{activeTab.sub}</p>

        {/* ===== Filters ===== */}
        <Card className="p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Date range — kept for TB; available on PL/BS too as a soft refinement */}
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <NepaliDatePicker
                id="from"
                value={filters.transactionFrom ?? ''}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    transactionFrom: v || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <NepaliDatePicker
                id="to"
                value={filters.transactionTo ?? ''}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    transactionTo: v || undefined,
                  }))
                }
              />
            </div>

            {/* Rule 4: fiscal-year filter available on every report tab */}
            <div className="space-y-1.5">
              <Label htmlFor="fy">Fiscal year</Label>
              <Select
                value={filters.fiscalYearId ?? 'current'}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    fiscalYearId: v === 'current' ? undefined : v,
                  }))
                }
              >
                <SelectTrigger id="fy">
                  <SelectValue placeholder="Current open" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current open</SelectItem>
                  {fiscalYears.map((fy) => (
                    <SelectItem key={fy.id} value={fy.id}>
                      {fy.name} ({fy.status === 'OPEN' ? 'open' : 'closed'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* TB-only: account code as a dropdown (rule 4) */}
            {tab === 'trial' && (
              <div className="space-y-1.5">
                <Label htmlFor="code">Account code</Label>
                <Select
                  value={filters.accountCode ?? 'all'}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      accountCode: v === 'all' ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger id="code">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.code}>
                        {a.code} · {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* TB-only: account type filter kept */}
            {tab === 'trial' && (
              <div className="space-y-1.5">
                <Label htmlFor="type">Account type</Label>
                <Select
                  value={filters.accountType ?? 'all'}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      accountType: v === 'all' ? undefined : (v as AccountType),
                    }))
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ASSET">Asset</SelectItem>
                    <SelectItem value="LIABILITY">Liability</SelectItem>
                    <SelectItem value="EQUITY">Equity</SelectItem>
                    <SelectItem value="REVENUE">Revenue</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {hasAnyFilter && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            </div>
          )}
        </Card>

        {/* ===== Body ===== */}
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-16 text-center text-muted-foreground text-sm">
              Computing…
            </div>
          ) : isEmpty ? (
            <div className="px-6 py-16 text-center">
              <CircleDashed
                className="mx-auto h-8 w-8 text-primary mb-2"
                strokeWidth={1.5}
              />
              <p className="text-muted-foreground text-sm">
                No data for the selected filters.
              </p>
              {raw && (
                <RawResponseToggle
                  raw={raw}
                  open={showRaw}
                  onToggle={() => setShowRaw((s) => !s)}
                />
              )}
            </div>
          ) : tab === 'trial' && trialParsed ? (
            <TrialBalanceTable
              rows={trialParsed.rows}
              totals={trialParsed.totals}
              onView={openLedger}
              onDownload={downloadLedger}
            />
          ) : tab === 'pl' && pl ? (
            <PnlView sections={pl.sections} netIncome={pl.netIncome} />
          ) : tab === 'bs' && bs ? (
            <BalanceSheetView sections={bs.sections} totals={bs.totals} />
          ) : null}
        </Card>

        {!isEmpty && raw && (
          <div className="mt-4">
            <RawResponseToggle
              raw={raw}
              open={showRaw}
              onToggle={() => setShowRaw((s) => !s)}
            />
          </div>
        )}
      </div>

      {/* Rule 1: GL detail modal, shared with the Accounts page */}
      <LedgerModal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        account={ledgerAccount}
        loading={ledgerLoading}
        onDownload={downloadLedger}
      />
    </>
  )
}

// ============================ Sub-views ====================================

function TrialBalanceTable({
  rows,
  totals,
  onView,
  onDownload,
}: {
  rows: ReportRow[]
  totals: { debit: number; credit: number }
  onView: (row: ReportRow) => void
  onDownload: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">Type</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const debit  = num(row.debit)
          const credit = num(row.credit)
          const balance =
            row.balance !== undefined ? num(row.balance) : debit - credit
          const id = row.id ?? row.accountId ?? ''
          return (
            <TableRow key={id || i}>
              <TableCell className="font-mono text-primary text-xs">
                {row.code ?? '—'}
              </TableCell>
              <TableCell className="font-medium">
                {row.name ?? '—'}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {row.accountType ? (
                  <span className={accountTypeChipClass(row.accountType)}>
                    {row.accountType}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {debit > 0 ? formatCurrency(debit) : '—'}
              </TableCell>
              <TableCell className="text-right font-mono tabular">
                {credit > 0 ? formatCurrency(credit) : '—'}
              </TableCell>
              <TableCell className="text-right font-mono tabular font-medium">
                {formatCurrency(balance)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(row)}
                    title="View GL ledger"
                    disabled={!id}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">View</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => id && onDownload(String(id))}
                    title="Download ledger PDF"
                    disabled={!id}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">PDF</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="border-t-2 border-foreground/80">
          <TableCell colSpan={3} className="font-display text-base">
            Totals
          </TableCell>
          <TableCell className="text-right font-mono tabular font-medium">
            {formatCurrency(totals.debit)}
          </TableCell>
          <TableCell className="text-right font-mono tabular font-medium">
            {formatCurrency(totals.credit)}
          </TableCell>
          <TableCell className="text-right font-mono tabular font-medium">
            {formatCurrency(totals.debit - totals.credit)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function SectionTable({ section }: { section: ReportSection }) {
  return (
    <div className="p-4 sm:p-6">
      <h3 className="font-display text-xl sm:text-2xl tracking-tightest text-foreground capitalize mb-3">
        {section.label}
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.items.map((row: any, i: number) => {
            const amount = num(
              row.amount ??
                row.balance ??
                row.total ??
                num(row.debit) - num(row.credit),
            )
            return (
              <TableRow key={row.id ?? row.accountId ?? i}>
                <TableCell className="font-mono text-primary text-xs">
                  {row.code ?? '—'}
                </TableCell>
                <TableCell>{row.name ?? '—'}</TableCell>
                <TableCell className="text-right font-mono tabular">
                  {formatCurrency(amount)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Total {section.label}
            </TableCell>
            <TableCell className="text-right font-mono tabular font-medium">
              {formatCurrency(section.total)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

function PnlView({
  sections,
  netIncome,
}: {
  sections: ReportSection[]
  netIncome: number
}) {
  return (
    <div className="divide-y divide-border">
      {sections.map((s) => (
        <SectionTable key={s.key} section={s} />
      ))}
      <div
        className={cn(
          'p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-2',
          netIncome >= 0 ? 'bg-accent/40' : 'bg-destructive/10',
        )}
      >
        <div className="font-display text-xl sm:text-2xl tracking-tightest">
          {netIncome >= 0 ? 'Net income' : 'Net loss'}
        </div>
        <div
          className={cn(
            'font-mono tabular text-2xl sm:text-3xl font-medium',
            netIncome >= 0 ? 'text-primary' : 'text-destructive',
          )}
        >
          {formatCurrency(Math.abs(netIncome))}
        </div>
      </div>
    </div>
  )
}

/**
 * Rule 4 — Balance sheet:
 *   • Equity section shows accounts BEFORE current-year profit/loss.
 *   • A NEW "Current year net profit / (loss)" line sits inside the equity
 *     block, after the equity accounts, formatted so a LOSS shows in
 *     parentheses (no leading minus) and a PROFIT shows as a plain number.
 *   • Total equity sums Equity + Current year net P/L (per backend summary).
 */
function BalanceSheetView({
  sections,
  totals,
}: {
  sections: ReportSection[]
  totals: {
    assets: number
    liabilities: number
    equity: number
    liabilitiesAndEquity: number
    currentYearNetPL: number
  }
}) {
  const balanced =
    Math.abs(totals.assets - totals.liabilitiesAndEquity) < 0.005

  const assets = sections.find((s) => s.key === 'assets')
  const liabilities = sections.find((s) => s.key === 'liabilities')
  const equity = sections.find((s) => s.key === 'equity')

  return (
    <div className="divide-y divide-border">
      {assets && <SectionTable section={assets} />}
      {liabilities && <SectionTable section={liabilities} />}

      {/* Equity + current year P/L combined */}
      {equity && (
        <div className="p-4 sm:p-6">
          <h3 className="font-display text-xl sm:text-2xl tracking-tightest text-foreground capitalize mb-3">
            Equity
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equity.items.map((row: any, i: number) => {
                const amount = num(
                  row.amount ??
                    row.balance ??
                    row.total ??
                    num(row.debit) - num(row.credit),
                )
                return (
                  <TableRow key={row.id ?? row.accountId ?? `eq-${i}`}>
                    <TableCell className="font-mono text-primary text-xs">
                      {row.code ?? '—'}
                    </TableCell>
                    <TableCell>{row.name ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {formatCurrency(amount)}
                    </TableCell>
                  </TableRow>
                )
              })}

              {/* Current-year P/L row — rule 4 formatting */}
              <TableRow className="bg-muted/30">
                <TableCell className="font-mono text-primary text-xs">
                  P/L
                </TableCell>
                <TableCell className="font-medium">
                  Current year net{' '}
                  {totals.currentYearNetPL >= 0 ? 'profit' : 'loss'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular font-medium',
                    totals.currentYearNetPL < 0 && 'text-destructive',
                  )}
                >
                  {formatPlAmount(totals.currentYearNetPL)}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total Equity (incl. current year P/L)
                </TableCell>
                <TableCell className="text-right font-mono tabular font-medium">
                  {formatCurrency(totals.equity)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* Footer summary */}
      <div className="p-4 sm:p-6 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryStat label="Total assets"      value={totals.assets} />
          <SummaryStat label="Total liabilities" value={totals.liabilities} />
          <SummaryStat label="Liab. + Equity"    value={totals.liabilitiesAndEquity} />
        </div>
        <div
          className={cn(
            'mt-3 p-3 rounded-md text-sm font-medium',
            balanced
              ? 'bg-accent/40 text-accent-foreground'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          {balanced
            ? 'Balanced — Assets = Liabilities + Equity'
            : `Out of balance — A − (L + E) = ${formatCurrency(
                totals.assets - totals.liabilitiesAndEquity,
              )}`}
        </div>
      </div>
    </div>
  )
}

/**
 * Rule 4: profit shown as a plain currency number; loss shown in parentheses
 * with NO leading minus.
 */
function formatPlAmount(value: number): string {
  if (value < 0) {
    return `(${formatCurrency(Math.abs(value))})`
  }
  return formatCurrency(value)
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-2xl sm:text-3xl tracking-tightest tabular text-foreground">
        {formatCurrency(value)}
      </div>
    </div>
  )
}

function RawResponseToggle({
  raw,
  open,
  onToggle,
}: {
  raw: any
  open: boolean
  onToggle: () => void
}) {
  return (
    <details
      open={open}
      onToggle={(e) => {
        const nextOpen = (e.currentTarget as HTMLDetailsElement).open
        if (nextOpen !== open) onToggle()
      }}
      className="text-left max-w-2xl mx-auto mt-4"
    >
      <summary className="text-xs font-mono text-muted-foreground cursor-pointer select-none">
        {open ? 'Hide' : 'Show'} raw response
      </summary>
      <pre className="text-xs bg-muted/40 border border-border rounded-md p-3 mt-2 overflow-auto max-h-72">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </details>
  )
}
