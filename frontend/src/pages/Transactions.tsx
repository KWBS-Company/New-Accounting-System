import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import EmptyState from '@/components/EmptyState'
import { transactionsApi } from '@/api/transactions'
import { transactionRulesApi } from '@/api/transactionRules'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  downloadBlob,
  formatDate,
  formatNumber,
  normalizeList,
} from '@/lib/utils'
import type { Transaction, TransactionRule } from '@/types'

export default function Transactions() {
  const { toast } = useToast()

  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Used as transaction "types" — backend takes a `transactionTypeId`
  // and transaction rules expose those types.
  const [rules, setRules] = useState<TransactionRule[]>([])

  // Modal state — create / edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState({
    description: '',
    reference: '',
    amount: '',
    transactionTypeId: '',
    transactionDate: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)

  // Detail view
  const [detail, setDetail] = useState<Transaction | null>(null)

  // Upload
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const fetchTxns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await transactionsApi.list({
        search: search || undefined,
        page,
        pageSize,
      })
      const norm = normalizeList<Transaction>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, toast])

  useEffect(() => {
    fetchTxns()
  }, [fetchTxns])

  useEffect(() => {
    transactionRulesApi
      .list({ pageSize: 200 })
      .then((res) => setRules(normalizeList<TransactionRule>(res).items))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      description: '',
      reference: '',
      amount: '',
      transactionTypeId: '',
      transactionDate: new Date().toISOString().slice(0, 10),
    })
    setModalOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    const firstLine = t.lines?.[0]
    setForm({
      description: firstLine?.description ?? '',
      reference: t.reference ?? '',
      amount: String(firstLine?.debit ?? firstLine?.credit ?? ''),
      transactionTypeId: t.transactionTypeId,
      transactionDate: t.transactionDate.slice(0, 10),
    })
    setModalOpen(true)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        description: form.description,
        reference: form.reference || undefined,
        amount: form.amount,
        transactionTypeId: form.transactionTypeId,
        transactionDate: new Date(form.transactionDate).toISOString(),
      }
      if (editing) {
        await transactionsApi.update(editing.id, payload)
        toast('Entry updated', 'success')
      } else {
        await transactionsApi.create(payload)
        toast('Entry posted', 'success')
      }
      setModalOpen(false)
      fetchTxns()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (t: Transaction) => {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return
    try {
      await transactionsApi.remove(t.id)
      toast('Entry deleted', 'success')
      fetchTxns()
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const downloadTemplate = async () => {
    try {
      const res = await transactionsApi.downloadTemplate()
      downloadBlob(res.data, 'transaction-template.xlsx')
      toast('Template downloaded', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const downloadVoucher = async (id: string) => {
    try {
      const res = await transactionsApi.downloadVoucher(id)
      downloadBlob(res.data, `voucher-${id.slice(0, 8)}.pdf`)
      toast('Voucher downloaded', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await transactionsApi.uploadExcel(file)
      toast('Entries uploaded', 'success')
      fetchTxns()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const loadDetail = async (id: string) => {
    try {
      const t = await transactionsApi.get(id)
      setDetail(t)
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Journal"
        title="Transactions."
        subtitle="Every entry, posted. The chronological record of the business."
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadTemplate} className="btn-secondary">
              ↓ Template
            </button>
            <label className="btn-secondary cursor-pointer">
              {uploading ? 'Uploading…' : '↑ Upload Excel'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={uploading}
                onChange={onUpload}
              />
            </label>
            <button onClick={openCreate} className="btn-primary">
              + New entry
            </button>
          </div>
        }
      />

      <div className="px-10 py-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            className="field max-w-xs"
            placeholder="Search reference or description…"
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
              Loading entries…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="The journal is empty."
              description="Post your first entry, or upload an Excel batch."
              action={
                <div className="flex gap-2 justify-center">
                  <button onClick={openCreate} className="btn-primary">
                    + Post first entry
                  </button>
                  <button onClick={downloadTemplate} className="btn-secondary">
                    ↓ Get template
                  </button>
                </div>
              }
            />
          ) : (
            <>
              <table className="table-ledger">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th className="!text-right">Lines</th>
                    <th className="!text-right">Total</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const totalDebit =
                      t.lines?.reduce(
                        (s, l) => s + (parseFloat(String(l.debit)) || 0),
                        0,
                      ) ?? 0
                    return (
                      <tr key={t.id}>
                        <td className="font-mono text-xs">
                          {formatDate(t.transactionDate)}
                        </td>
                        <td className="font-medium text-ink-900">
                          <button
                            onClick={() => loadDetail(t.id)}
                            className="hover:text-emerald_ledger-500 hover:underline underline-offset-4 decoration-1"
                          >
                            {t.reference ?? '(no reference)'}
                          </button>
                        </td>
                        <td className="text-ink-500 text-xs font-mono">
                          {t.transactionType?.name ??
                            t.transactionTypeId?.slice(0, 8) ??
                            '—'}
                        </td>
                        <td className="text-right font-mono tabular text-xs">
                          {t.lines?.length ?? 0}
                        </td>
                        <td className="text-right font-mono tabular">
                          {formatNumber(totalDebit)}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => downloadVoucher(t.id)}
                          >
                            PDF
                          </button>
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => openEdit(t)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-ghost text-xs text-claret-500 hover:text-claret-600"
                            onClick={() => onDelete(t)}
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

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit entry' : 'New journal entry'}
        subtitle="The transaction rule determines which accounts are debited and credited."
        maxWidth="max-w-xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                required
                className="field"
                value={form.transactionDate}
                onChange={(e) =>
                  setForm({ ...form, transactionDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Reference</label>
              <input
                className="field"
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                placeholder="INV-001"
              />
            </div>
          </div>

          <div>
            <label className="label">Transaction type (rule)</label>
            <select
              required
              className="field"
              value={form.transactionTypeId}
              onChange={(e) =>
                setForm({ ...form, transactionTypeId: e.target.value })
              }
            >
              <option value="">Choose a rule…</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.transactionType}
                </option>
              ))}
            </select>
            {rules.length === 0 && (
              <p className="text-xs text-claret-500 mt-1.5">
                No transaction rules defined yet. Visit Rules first.
              </p>
            )}
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
              placeholder="Sale of services to ACME Co."
            />
          </div>

          <div>
            <label className="label">Amount</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              className="field font-mono"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
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
              {saving ? 'Posting…' : editing ? 'Save changes' : 'Post entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.reference ?? 'Journal entry'}
        subtitle={
          detail
            ? `Posted ${formatDate(detail.transactionDate)}`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Reference" value={detail.reference ?? '—'} />
              <Field label="Date" value={formatDate(detail.transactionDate)} />
              <Field
                label="Type"
                value={detail.transactionType?.name ?? detail.transactionTypeId}
              />
              <Field label="Lines" value={String(detail.lines?.length ?? 0)} />
            </div>

            <div className="rule-ornament" />

            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-500 mb-2">
                Lines
              </div>
              <table className="table-ledger">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Description</th>
                    <th className="!text-right">Debit</th>
                    <th className="!text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines?.map((l, i) => (
                    <tr key={l.id ?? i}>
                      <td className="font-mono text-xs">
                        {l.account?.code ?? '—'} · {l.account?.name ?? ''}
                      </td>
                      <td className="text-xs text-ink-500">{l.description}</td>
                      <td className="text-right font-mono tabular">
                        {parseFloat(String(l.debit)) > 0
                          ? formatNumber(l.debit as number)
                          : '—'}
                      </td>
                      <td className="text-right font-mono tabular">
                        {parseFloat(String(l.credit)) > 0
                          ? formatNumber(l.credit as number)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => downloadVoucher(detail.id)}
                className="btn-secondary"
              >
                ↓ Download voucher
              </button>
              <button onClick={() => setDetail(null)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500 mb-0.5">
        {label}
      </div>
      <div className="text-sm text-ink-900">{value}</div>
    </div>
  )
}
