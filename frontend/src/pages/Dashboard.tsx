import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { accountsApi } from '@/api/accounts'
import { transactionsApi } from '@/api/transactions'
import { reportsApi } from '@/api/reports'
import { normalizeList, formatNumber } from '@/lib/utils'
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

        // Trial balance might be array, object with rows, etc.
        let tbTotal = 0
        if (tb.status === 'fulfilled') {
          const raw: any = tb.value
          const rows: any[] = Array.isArray(raw)
            ? raw
            : raw?.rows ?? raw?.items ?? raw?.data ?? []
          tbTotal = rows.reduce(
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
        eyebrow={`Today · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        title={user ? `Good day, ${user.firstName}.` : 'The ledger.'}
        subtitle="A snapshot of the books — recent activity, totals, and where to go next."
      />

      <div className="px-10 py-8 max-w-7xl mx-auto space-y-10">
        {/* Stat tiles */}
        <section className="grid md:grid-cols-3 gap-4">
          <StatTile
            label="Chart of accounts"
            value={loading ? '—' : stats.totalAccounts.toString()}
            sub="accounts on the books"
            to="/accounts"
            cta="Open accounts →"
          />
          <StatTile
            label="Journal entries"
            value={loading ? '—' : stats.totalTransactions.toString()}
            sub="transactions recorded"
            to="/transactions"
            cta="View journal →"
          />
          <StatTile
            label="Trial balance"
            value={loading ? '—' : formatNumber(stats.trialBalanceTotal)}
            sub="total debits posted"
            to="/reports"
            cta="See reports →"
          />
        </section>

        {/* Recent + Quick actions */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="px-6 py-4 border-b border-sand flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-tightest text-ink-900">
                Recent entries
              </h2>
              <Link
                to="/transactions"
                className="text-xs font-mono uppercase tracking-wider text-emerald_ledger-500 hover:underline"
              >
                See all →
              </Link>
            </div>
            {loading ? (
              <div className="px-6 py-12 text-center text-ink-500 text-sm">
                Loading…
              </div>
            ) : recentTxns.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="font-mono text-emerald_ledger-500 text-2xl mb-2">∅</div>
                <p className="text-ink-500 text-sm mb-4">
                  No transactions yet.
                </p>
                <Link to="/transactions" className="btn-primary">
                  Record first entry
                </Link>
              </div>
            ) : (
              <table className="table-ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th className="!text-right">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono text-xs">
                        {new Date(t.transactionDate).toLocaleDateString(
                          'en-US',
                          { year: 'numeric', month: 'short', day: '2-digit' },
                        )}
                      </td>
                      <td className="font-medium">{t.reference ?? '—'}</td>
                      <td className="text-right font-mono">
                        {t.lines?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card p-6">
            <h2 className="font-display text-2xl tracking-tightest text-ink-900 mb-4">
              Quick actions
            </h2>
            <div className="space-y-2">
              <Link to="/accounts" className="btn-secondary w-full justify-start">
                ₪ &nbsp;Add an account
              </Link>
              <Link to="/transactions" className="btn-secondary w-full justify-start">
                ✎ &nbsp;Post a journal entry
              </Link>
              <Link to="/transaction-rules" className="btn-secondary w-full justify-start">
                § &nbsp;Define a rule
              </Link>
              <Link to="/reports" className="btn-primary w-full justify-start">
                ⏚ &nbsp;Run trial balance
              </Link>
            </div>
            <div className="rule-ornament my-6" />
            <p className="text-xs text-ink-500 font-mono leading-relaxed">
              <span className="text-emerald_ledger-500">◆</span> Every entry
              must balance — debits equal credits. The books refuse to lie.
            </p>
          </div>
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
}: {
  label: string
  value: string
  sub: string
  to: string
  cta: string
}) {
  return (
    <Link
      to={to}
      className="card p-6 block group hover:border-emerald_ledger-500 transition-colors"
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 mb-3">
        {label}
      </div>
      <div className="font-display text-5xl tracking-tightest font-light text-ink-900 tabular leading-none mb-2">
        {value}
      </div>
      <div className="text-xs text-ink-500 mb-4">{sub}</div>
      <div className="text-xs font-mono uppercase tracking-wider text-emerald_ledger-500 group-hover:translate-x-1 transition-transform">
        {cta}
      </div>
    </Link>
  )
}
