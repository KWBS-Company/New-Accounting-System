import { useCallback, useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import EmptyState from '@/components/EmptyState'
import { accountsApi, accountTypesApi } from '@/api/accounts'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  accountTypeChipClass,
  formatDate,
  normalizeList,
} from '@/lib/utils'
import type { Account, AccountType, AccountTypeOption } from '@/types'

export default function Accounts() {
  const { toast } = useToast()

  const [items, setItems] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AccountType | ''>('')
  const [loading, setLoading] = useState(true)

  const [accountTypes, setAccountTypes] = useState<AccountTypeOption[]>([])
  const [allAccounts, setAllAccounts] = useState<Account[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({
    name: '',
    code: '',
    accountType: '' as AccountType | '',
    parentId: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountsApi.list({
        search: search || undefined,
        accountType: typeFilter || undefined,
        page,
        pageSize,
      })
      const norm = normalizeList<Account>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, page, pageSize, toast])

  // For the "parent" selector — pull a wide list once
  const fetchAll = useCallback(async () => {
    try {
      const res = await accountsApi.list({ pageSize: 500 })
      setAllAccounts(normalizeList<Account>(res).items)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    fetchAll()
    accountTypesApi.list().then(setAccountTypes).catch(() => {})
  }, [fetchAll])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', code: '', accountType: '', parentId: '' })
    setModalOpen(true)
  }

  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({
      name: a.name,
      code: a.code,
      accountType: a.accountType,
      parentId: a.parentId ?? '',
    })
    setModalOpen(true)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await accountsApi.update(editing.id, { name: form.name })
        toast('Account updated', 'success')
      } else {
        const payload: any = { name: form.name }
        if (form.parentId) {
          payload.parentId = form.parentId
        } else {
          if (!form.accountType) {
            throw new Error('Choose an account type or a parent account')
          }
          if (!form.code) {
            throw new Error('Code is required when there is no parent')
          }
          payload.accountType = form.accountType
          payload.code = form.code.toUpperCase()
        }
        await accountsApi.create(payload)
        toast('Account created', 'success')
      }
      setModalOpen(false)
      fetchAccounts()
      fetchAll()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (a: Account) => {
    if (!confirm(`Delete account "${a.name}"? This cannot be undone.`)) return
    try {
      await accountsApi.remove(a.id)
      toast('Account deleted', 'success')
      fetchAccounts()
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Chart of accounts"
        title="Accounts."
        subtitle="The named buckets where every debit and credit lands."
        actions={
          <button onClick={openCreate} className="btn-primary">
            + New account
          </button>
        }
      />

      <div className="px-10 py-8 max-w-7xl mx-auto">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            className="field max-w-xs"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          <select
            className="field max-w-xs"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as AccountType | '')
              setPage(1)
            }}
          >
            <option value="">All types</option>
            {accountTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-ink-500 text-sm">
              Loading accounts…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No accounts yet."
              description="Begin with foundational accounts — Cash, Accounts Receivable, Revenue, etc."
              action={
                <button onClick={openCreate} className="btn-primary">
                  + Create first account
                </button>
              }
            />
          ) : (
            <>
              <table className="table-ledger">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Parent</th>
                    <th>Created</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const parent = allAccounts.find((p) => p.id === a.parentId)
                    return (
                      <tr key={a.id}>
                        <td className="font-mono text-emerald_ledger-500 font-medium">
                          {a.code}
                        </td>
                        <td className="font-medium text-ink-900">{a.name}</td>
                        <td>
                          <span className={accountTypeChipClass(a.accountType)}>
                            {a.accountType}
                          </span>
                        </td>
                        <td className="text-ink-500 text-xs">
                          {parent ? `${parent.code} · ${parent.name}` : '—'}
                        </td>
                        <td className="text-ink-500 text-xs font-mono">
                          {formatDate(a.createdAt)}
                        </td>
                        <td className="text-right">
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => openEdit(a)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-ghost text-xs text-claret-500 hover:text-claret-600"
                            onClick={() => onDelete(a)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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
        title={editing ? 'Edit account' : 'New account'}
        subtitle={
          editing
            ? 'Only the name can be edited.'
            : 'A top-level account needs a type and code; a sub-account inherits from its parent.'
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              required
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Cash on Hand"
            />
          </div>

          {!editing && (
            <>
              <div>
                <label className="label">Parent (optional)</label>
                <select
                  className="field"
                  value={form.parentId}
                  onChange={(e) =>
                    setForm({ ...form, parentId: e.target.value })
                  }
                >
                  <option value="">— No parent (top-level) —</option>
                  {allAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name} ({a.accountType})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-500 mt-1.5">
                  Picking a parent overrides type and code.
                </p>
              </div>

              {!form.parentId && (
                <>
                  <div>
                    <label className="label">Account type</label>
                    <select
                      required
                      className="field"
                      value={form.accountType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          accountType: e.target.value as AccountType,
                        })
                      }
                    >
                      <option value="">Choose type…</option>
                      {accountTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Code (uppercase letters)</label>
                    <input
                      required
                      className="field font-mono uppercase"
                      value={form.code}
                      onChange={(e) =>
                        setForm({ ...form, code: e.target.value.toUpperCase() })
                      }
                      pattern="[A-Z]+"
                      placeholder="CASH"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
