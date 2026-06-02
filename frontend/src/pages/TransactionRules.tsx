import { useCallback, useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import EmptyState from '@/components/EmptyState'
import { transactionRulesApi } from '@/api/transactionRules'
import { accountsApi } from '@/api/accounts'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { formatDate, normalizeList } from '@/lib/utils'
import type { Account, TransactionRule } from '@/types'

type RuleLineForm = {
  ruleId?: string
  accountId: string
  increase: boolean
}

export default function TransactionRules() {
  const { toast } = useToast()

  const [items, setItems] = useState<TransactionRule[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionRule | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    transactionType: '',
  })
  const [lines, setLines] = useState<RuleLineForm[]>([
    { accountId: '', increase: true },
    { accountId: '', increase: false },
  ])
  const [saving, setSaving] = useState(false)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await transactionRulesApi.list({
        search: search || undefined,
        page,
        pageSize,
      })
      const norm = normalizeList<TransactionRule>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, toast])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  useEffect(() => {
    accountsApi
      .list({ pageSize: 500 })
      .then((res) => setAccounts(normalizeList<Account>(res).items))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', transactionType: '' })
    setLines([
      { accountId: '', increase: true },
      { accountId: '', increase: false },
    ])
    setModalOpen(true)
  }

  const openEdit = async (r: TransactionRule) => {
    try {
      // Pull fresh detail in case list payload is shallow
      const full = await transactionRulesApi.get(r.id)
      setEditing(full)
      setForm({
        name: full.name,
        description: full.description,
        transactionType: full.transactionType,
      })
      setLines(
        (full.rules ?? []).map((rl: any) => ({
          ruleId: rl.id ?? rl.ruleId,
          accountId: rl.accountId ?? rl.account?.id ?? '',
          increase: !!rl.increase,
        })),
      )
      setModalOpen(true)
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const addLine = () => {
    if (editing) {
      toast(
        'Editing can only update existing lines (backend does not support adding lines on update).',
        'info',
      )
      return
    }
    setLines((l) => [...l, { accountId: '', increase: true }])
  }

  const removeLine = (i: number) => {
    if (editing) {
      toast(
        'Editing can only update existing lines (backend does not support removing lines on update).',
        'info',
      )
      return
    }
    if (lines.length <= 2) {
      toast('A rule needs at least 2 lines (one debit, one credit).', 'info')
      return
    }
    setLines((l) => l.filter((_, idx) => idx !== i))
  }

  const updateLine = (i: number, patch: Partial<RuleLineForm>) =>
    setLines((l) => l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.some((l) => !l.accountId)) {
      toast('Each rule line needs an account.', 'error')
      return
    }
    if (editing && lines.some((l) => !l.ruleId)) {
      toast(
        'Some rule lines are missing ruleId. Please reopen edit and try again.',
        'error',
      )
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await transactionRulesApi.update(editing.id, {
          name: form.name,
          description: form.description,
          transactionType: form.transactionType,
          rules: lines.map((l) => ({
            ruleId: l.ruleId as string,
            accountId: l.accountId,
            increase: l.increase,
          })),
        } as any)
        toast('Rule updated', 'success')
      } else {
        await transactionRulesApi.create({
          name: form.name,
          description: form.description,
          transactionType: form.transactionType,
          rules: lines.map((l) => ({
            accountId: l.accountId,
            increase: l.increase,
          })),
        })
        toast('Rule created', 'success')
      }
      setModalOpen(false)
      fetchRules()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (r: TransactionRule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return
    try {
      await transactionRulesApi.remove(r.id)
      toast('Rule deleted', 'success')
      fetchRules()
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Transaction rules"
        title="Rules."
        subtitle="Define which accounts increase and which decrease for each kind of transaction."
        actions={
          <button onClick={openCreate} className="btn-primary">
            + New rule
          </button>
        }
      />

      <div className="px-10 py-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            className="field max-w-xs"
            placeholder="Search rules…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-ink-500 text-sm">
              Loading rules…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No rules yet."
              description="A rule turns business actions (sales, purchases, payments) into balanced double-entry."
              action={
                <button onClick={openCreate} className="btn-primary">
                  + Create first rule
                </button>
              }
            />
          ) : (
            <>
              <table className="table-ledger">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-ink-900">{r.name}</td>
                      <td>
                        <span className="chip-equity">{r.transactionType}</span>
                      </td>
                      <td className="text-ink-500 text-xs max-w-md truncate">
                        {r.description}
                      </td>
                      <td className="text-ink-500 text-xs font-mono">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => openEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost text-xs text-claret-500 hover:text-claret-600"
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit rule' : 'New transaction rule'}
        subtitle="At least 2 lines — typically one increases (debit-like), one decreases (credit-like)."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                required
                className="field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Cash Sale"
              />
            </div>
            <div>
              <label className="label">Transaction type</label>
              <input
                required
                className="field"
                value={form.transactionType}
                onChange={(e) =>
                  setForm({ ...form, transactionType: e.target.value })
                }
                placeholder="SALE / PAYMENT / PURCHASE"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              required
              className="field"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What kind of business activity does this rule represent?"
            />
          </div>

          <div className="rule-ornament" />

          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-500">
              Rule lines
            </div>
            <button
              type="button"
              onClick={addLine}
              disabled={!!editing}
              className="btn-ghost text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title={editing ? 'Not available while editing' : undefined}
            >
              + Add line
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 p-3 bg-parchment-100/50 border border-sand"
              >
                <div className="flex-1 min-w-[220px]">
                  <label className="label !mb-1">Account</label>
                  <select
                    required
                    className="field"
                    value={l.accountId}
                    onChange={(e) =>
                      updateLine(i, { accountId: e.target.value })
                    }
                  >
                    <option value="">Choose account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name} ({a.accountType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label !mb-1">Effect</label>
                  <select
                    className="field min-w-[140px]"
                    value={l.increase ? 'inc' : 'dec'}
                    onChange={(e) =>
                      updateLine(i, { increase: e.target.value === 'inc' })
                    }
                  >
                    <option value="inc">Increase</option>
                    <option value="dec">Decrease</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className={`btn-ghost text-xs text-claret-500 hover:text-claret-600 mb-0.5 ${
                    editing ? 'invisible pointer-events-none' : ''
                  }`}
                  title={editing ? undefined : 'Remove line'}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
