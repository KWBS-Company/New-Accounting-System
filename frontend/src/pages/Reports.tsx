import { useCallback, useEffect, useState } from 'react'
import { CircleDashed, Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { reportsApi } from '@/api/reports'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  accountTypeChipClass,
  cn,
  downloadBlob,
  formatCurrency,
} from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import type { AccountType, ReportQuery } from '@/types'

type ReportKind = 'trial' | 'pl' | 'bs'

const TABS: { key: ReportKind; label: string; sub: string }[] = [
  { key: 'trial', label: 'Trial balance',  sub: 'Sum of debits and credits, account by account.' },
  { key: 'pl',    label: 'Profit & loss',  sub: 'Revenue, less expenses, equals income.' },
  { key: 'bs',    label: 'Balance sheet',  sub: 'Assets = Liabilities + Equity, at a point in time.' },
]

// ---------------------------------------------------------------------------
//  Rule 4 — Report response parsers
//
//  The backend may return a variety of shapes for P&L and Balance Sheet.
//  Instead of guessing one shape, we look for known section keys at the top
//  level OR one level inside `data` / common wrappers, and we extract:
//    - an array of accounts/rows for each section
//    - a precomputed total if the backend provides it (otherwise we sum)
//
//  Supported shapes for P&L:
//    { revenue: [...], expenses: [...], netIncome }
//    { revenue: { total, items: [...] }, expenses: { total, items: [...] }, netIncome }
//    { revenues: [...], expenses: [...], profit }
//    { sections: { revenue: [...], expense: [...] }, netIncome }
//    { data: { ...any of the above... } }
//
//  Supported shapes for Balance Sheet:
//    { assets: [...], liabilities: [...], equity: [...] }
//    { assets: { total, items }, liabilities: { total, items }, equity: { total, items } }
//    { data: { ...any of the above... } }
// ---------------------------------------------------------------------------

type ReportRow = {
  code?: string
  name?: string
  accountType?: AccountType
  amount?: number
  balance?: number
  debit?: number
  credit?: number
  /** Pass-through for any other field the backend sends. */
  [k: string]: any
}

type ReportSection = {
  key: string
  label: string
  items: ReportRow[]
  total: number
}

/** Unwrap one level of { data: ... } if it's an object, not an array. */
function unwrap(raw: any): any {
  if (raw && typeof raw === 'object' && 'data' in raw && raw.data && !Array.isArray(raw.data)) {
    return raw.data
  }
  return raw
}

/** Coerce a value to a finite number (0 on failure). */
function num(v: any): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Pretty-cased label for a section key (e.g. "revenue" → "Revenue"). */
function labelOf(key: string): string {
  return key.replace(/[_\-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Extract `{ items, total }` from a section value that may be array OR object. */
function extractSection(value: any): { items: ReportRow[]; total: number } {
  if (!value) return { items: [], total: 0 }

  // Direct array  →  treat as items, sum amounts/balances
  if (Array.isArray(value)) {
    const items = value as ReportRow[]
    const total = items.reduce(
      (s, r) =>
        s +
        num(
          r.amount ??
            r.balance ??
            r.total ??
            (num(r.debit) - num(r.credit)),
        ),
      0,
    )
    return { items, total }
  }

  // Object  →  look for items + total
  if (typeof value === 'object') {
    const items: ReportRow[] = Array.isArray(value.items)
      ? value.items
      : Array.isArray(value.rows)
        ? value.rows
        : Array.isArray(value.accounts)
          ? value.accounts
          : Array.isArray(value.data)
            ? value.data
            : []
    const computed = items.reduce(
      (s, r) =>
        s +
        num(
          r.amount ??
            r.balance ??
            r.total ??
            (num(r.debit) - num(r.credit)),
        ),
      0,
    )
    const total = num(value.total ?? value.sum ?? value.amount ?? computed)
    return { items, total }
  }

  return { items: [], total: 0 }
}

/**
 * Pull named sections out of a P&L payload.
 * Returns `{ sections, netIncome }`. NetIncome falls back to (revenue - expense)
 * if the backend doesn't provide it.
 */
function parsePnl(raw: any): { sections: ReportSection[]; netIncome: number } {
  const root = unwrap(raw) ?? {}
  // Some backends nest sections under "sections" / "groups"
  const source = (root.sections && typeof root.sections === 'object' && !Array.isArray(root.sections))
    ? root.sections
    : root

  const pickKeys: Record<string, string[]> = {
    revenue:  ['revenue', 'revenues', 'income', 'incomes', 'sales'],
    expense:  ['expense', 'expenses', 'cost', 'costs', 'cogs'],
  }

  const sections: ReportSection[] = []
  for (const [logicalKey, candidates] of Object.entries(pickKeys)) {
    for (const k of candidates) {
      if (source[k] !== undefined) {
        const { items, total } = extractSection(source[k])
        sections.push({ key: logicalKey, label: labelOf(logicalKey), items, total })
        break
      }
    }
  }

  // Compute net income — prefer backend-provided value
  const ni = num(
    root.netIncome ??
      root.profit ??
      root.netProfit ??
      root.net_income ??
      root.totalProfit ??
      // fallback: revenue - expense
      ((sections.find((s) => s.key === 'revenue')?.total ?? 0) -
        (sections.find((s) => s.key === 'expense')?.total ?? 0)),
  )

  return { sections, netIncome: ni }
}

/**
 * Pull assets/liabilities/equity sections out of a Balance Sheet payload.
 */
function parseBalanceSheet(raw: any): { sections: ReportSection[]; totals: { assets: number; liabilities: number; equity: number } } {
  const root = unwrap(raw) ?? {}
  const source = (root.sections && typeof root.sections === 'object' && !Array.isArray(root.sections))
    ? root.sections
    : root

  const pickKeys: Record<string, string[]> = {
    assets:      ['assets',      'asset'],
    liabilities: ['liabilities', 'liability'],
    equity:      ['equity',      'equities', 'capital'],
  }

  const sections: ReportSection[] = []
  const totals = { assets: 0, liabilities: 0, equity: 0 }
  for (const [logicalKey, candidates] of Object.entries(pickKeys)) {
    for (const k of candidates) {
      if (source[k] !== undefined) {
        const { items, total } = extractSection(source[k])
        sections.push({ key: logicalKey, label: labelOf(logicalKey), items, total })
        totals[logicalKey as keyof typeof totals] = total
        break
      }
    }
  }
  // Backend-provided totals override computed ones
  totals.assets      = num(root.totalAssets      ?? root.assetTotal      ?? totals.assets)
  totals.liabilities = num(root.totalLiabilities ?? root.liabilityTotal ?? totals.liabilities)
  totals.equity      = num(root.totalEquity      ?? root.equityTotal    ?? totals.equity)

  return { sections, totals }
}

/**
 * Trial Balance — flat row list. Same parser as before, slightly more
 * defensive.
 */
function parseTrialBalance(raw: any): ReportRow[] {
  const root = unwrap(raw)
  if (!root) return []
  if (Array.isArray(root)) return root as ReportRow[]
  return (
    root.rows ??
    root.items ??
    root.data ??
    root.accounts ??
    []
  ) as ReportRow[]
}

// ---------------------------------------------------------------------------

export default function Reports() {
  const { toast } = useToast()

  const [tab, setTab] = useState<ReportKind>('trial')
  const [filters, setFilters] = useState<ReportQuery>({})
  const [raw, setRaw] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

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

  const activeTab = TABS.find((t) => t.key === tab)!

  // Derive view data based on selected tab
  const trialRows  = tab === 'trial' ? parseTrialBalance(raw) : []
  const pl         = tab === 'pl'    ? parsePnl(raw)          : null
  const bs         = tab === 'bs'    ? parseBalanceSheet(raw) : null

  const trialTotals =
    tab === 'trial'
      ? trialRows.reduce<{ debit: number; credit: number }>(
          (acc, r) => {
            acc.debit  += num(r.debit  ?? r.totalDebit)
            acc.credit += num(r.credit ?? r.totalCredit)
            return acc
          },
          { debit: 0, credit: 0 },
        )
      : null

  const isEmpty =
    (tab === 'trial' && trialRows.length === 0) ||
    (tab === 'pl' && (!pl || pl.sections.every((s) => s.items.length === 0))) ||
    (tab === 'bs' && (!bs || bs.sections.every((s) => s.items.length === 0)))

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

        {/* Filters */}
        <Card className="p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={filters.transactionFrom ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    transactionFrom: e.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={filters.transactionTo ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    transactionTo: e.target.value || undefined,
                  }))
                }
              />
            </div>
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
                  <SelectValue placeholder="All" />
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
            <div className="space-y-1.5">
              <Label htmlFor="code">Account code</Label>
              <Input
                id="code"
                className="font-mono uppercase"
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
          {(filters.transactionFrom ||
            filters.transactionTo ||
            filters.accountType ||
            filters.accountCode) && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFilters({})}
                className="text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            </div>
          )}
        </Card>

        {/* Body */}
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
          ) : tab === 'trial' ? (
            <TrialBalanceTable rows={trialRows} totals={trialTotals!} />
          ) : tab === 'pl' ? (
            <PnlView sections={pl!.sections} netIncome={pl!.netIncome} />
          ) : (
            <BalanceSheetView
              sections={bs!.sections}
              totals={bs!.totals}
            />
          )}
        </Card>

        {/* Always-available debug toggle when data IS rendered too */}
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
    </>
  )
}

// ============================ Sub-views ====================================

function TrialBalanceTable({
  rows,
  totals,
}: {
  rows: ReportRow[]
  totals: { debit: number; credit: number }
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row: any, i: number) => {
          const debit  = num(row.debit  ?? row.totalDebit)
          const credit = num(row.credit ?? row.totalCredit)
          const balance =
            row.balance !== undefined ? num(row.balance) : debit - credit
          return (
            <TableRow key={row.accountId ?? row.id ?? i}>
              <TableCell className="font-mono text-primary text-xs">
                {row.code ?? '—'}
              </TableCell>
              <TableCell className="font-medium">
                {row.name ?? row.accountName ?? '—'}
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
              <TableRow key={row.accountId ?? row.id ?? i}>
                <TableCell className="font-mono text-primary text-xs">
                  {row.code ?? '—'}
                </TableCell>
                <TableCell>
                  {row.name ?? row.accountName ?? '—'}
                </TableCell>
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

function BalanceSheetView({
  sections,
  totals,
}: {
  sections: ReportSection[]
  totals: { assets: number; liabilities: number; equity: number }
}) {
  const balanced = Math.abs(totals.assets - (totals.liabilities + totals.equity)) < 0.005
  return (
    <div className="divide-y divide-border">
      {sections.map((s) => (
        <SectionTable key={s.key} section={s} />
      ))}
      <div className="p-4 sm:p-6 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryStat label="Total assets"      value={totals.assets} />
          <SummaryStat label="Total liabilities" value={totals.liabilities} />
          <SummaryStat label="Total equity"      value={totals.equity} />
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
                totals.assets - (totals.liabilities + totals.equity),
              )}`}
        </div>
      </div>
    </div>
  )
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
