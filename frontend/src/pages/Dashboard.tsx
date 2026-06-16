import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CircleDashed,
  Scale,
  Wallet,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { accountsApi } from '@/api/accounts'
import { transactionsApi } from '@/api/transactions'
import { reportsApi } from '@/api/reports'
import { formatCurrency, normalizeList } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Account, Transaction } from '@/types'

type Stats = {
  totalAccounts: number
  totalTransactions: number
  trialBalanceTotal: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalAccounts: 0,
    totalTransactions: 0,
    trialBalanceTotal: 0,
  })
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // ---- Data load logic — preserved verbatim ----
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [accountsRes, txnsRes, tb] = await Promise.allSettled([
          accountsApi.list({ pageSize: 1 }),
          transactionsApi.list({ pageSize: 5 }),
          reportsApi.trialBalance(),
        ])

        if (cancelled) return

        const accountsList =
          accountsRes.status === 'fulfilled'
            ? normalizeList<Account>(accountsRes.value)
            : { total: 0, items: [] as Account[] }
        const txnsList =
          txnsRes.status === 'fulfilled'
            ? normalizeList<Transaction>(txnsRes.value)
            : { total: 0, items: [] as Transaction[] }

        let tbTotal = 0
        if (tb.status === 'fulfilled') {
          // Trial balance now returns
          //   { items: [...], summary: { totalDebit, totalCredit } }
          // The global TransformInterceptor on the backend wraps every
          // response in `{ success, data: <payload>, ... }`, so we may
          // see the report either at the top level (if a caller already
          // unwrapped) or nested under `.data`. Handle both.
          const raw: any = tb.value
          const body =
            raw && typeof raw === 'object' && 'data' in raw && raw.data
              ? raw.data
              : raw
          const summary = body?.summary ?? {}
          const items: any[] = Array.isArray(body)
            ? body
            : Array.isArray(body?.items)
              ? body.items
              : Array.isArray(body?.rows)
                ? body.rows
                : []
          // Prefer the backend-computed summary; fall back to summing rows.
          tbTotal =
            Number(summary.totalDebit ?? NaN) ||
            items.reduce(
              (sum, r) =>
                sum + (parseFloat(r.debit ?? r.totalDebit ?? '0') || 0),
              0,
            )
        }

        setStats({
          totalAccounts: accountsList.total,
          totalTransactions: txnsList.total,
          trialBalanceTotal: tbTotal,
        })
        setRecentTxns(txnsList.items.slice(0, 5))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageHeader
        eyebrow={`Today · ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}`}
        title={user ? `Good day, ${user.firstName}.` : 'The ledger.'}
        subtitle="A snapshot of the books — recent activity, totals, and where to go next."
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto space-y-8 sm:space-y-10">
        {/* Stat tiles — responsive grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatTile
            label="Chart of accounts"
            value={loading ? '—' : String(stats.totalAccounts ?? 0)}
            sub="accounts on the books"
            to="/accounts"
            cta="Open accounts"
            money={false}
          />
          <StatTile
            label="Journal entries"
            value={loading ? '—' : String(stats.totalTransactions ?? 0)}
            sub="transactions recorded"
            to="/transactions"
            cta="View journal"
            money={false}
          />
          <StatTile
            label="Trial balance"
            value={loading ? '—' : formatCurrency(stats.trialBalanceTotal)}
            sub="total debits posted"
            to="/reports"
            cta="See reports"
            money
          />
        </section>

        {/* Recent + Quick actions */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xl sm:text-2xl">Recent entries</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/transactions">
                  See all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : recentTxns.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CircleDashed
                    className="mx-auto h-8 w-8 text-primary mb-2"
                    strokeWidth={1.5}
                  />
                  <p className="text-muted-foreground text-sm mb-4">
                    No transactions yet.
                  </p>
                  <Button asChild>
                    <Link to="/transactions">Record first entry</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTxns.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(t.transactionDate).toLocaleDateString(
                            'en-US',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.reference ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {t.lines?.length ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/accounts">
                  <Wallet className="h-4 w-4" />
                  Add an account
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/transactions">
                  <BookOpen className="h-4 w-4" />
                  Post a journal entry
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/transaction-rules">
                  <Scale className="h-4 w-4" />
                  Define a rule
                </Link>
              </Button>
              <Button asChild className="w-full justify-start">
                <Link to="/reports">
                  <BarChart3 className="h-4 w-4" />
                  Run trial balance
                </Link>
              </Button>
              <div className="rule-ornament my-4" />
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                <span className="text-primary">◆</span> Every entry must
                balance — debits equal credits. The books refuse to lie.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

function StatTile({
  label,
  value,
  sub,
  to,
  cta,
  money: _money,
}: {
  label: string
  value: string
  sub: string
  to: string
  cta: string
  money?: boolean
}) {
  return (
    <Link to={to} className="block group">
      <Card
        className={cn(
          'p-5 sm:p-6 h-full transition-colors hover:border-primary',
        )}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          {label}
        </div>
        <div className="font-display text-4xl sm:text-5xl tracking-tightest font-light text-foreground tabular leading-none mb-2 break-words">
          {value}
        </div>
        <div className="text-xs text-muted-foreground mb-4">{sub}</div>
        <div className="text-xs font-mono uppercase tracking-wider text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          {cta}
          <ArrowRight className="h-3 w-3" />
        </div>
      </Card>
    </Link>
  )
}

// (No-op marker — module ends here)
