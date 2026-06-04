import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Modal from '@/components/common/Modal'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import { transactionsApi } from '@/api/transactions'
import { transactionRulesApi } from '@/api/transactionRules'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  downloadBlob,
  formatCurrency,
  formatDate,
  normalizeList,
} from '@/lib/utils'
import { DEFAULT_CURRENCY_SYMBOL } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Transaction, TransactionRule } from '@/types'

type DateFilters = {
  /** Same names as the report filter inputs for parity (rule 2). */
  transactionFrom: string
  transactionTo: string
}

export default function Transactions() {
  const { toast } = useToast()

  // ---- List state (preserved) ----
  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // ---- Date filter (NEW — rule 2) ----
  const [filters, setFilters] = useState<DateFilters>({
    transactionFrom: '',
    transactionTo: '',
  })

  // Rules used as transaction "types"
  const [rules, setRules] = useState<TransactionRule[]>([])

  const transactionTypeLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rules) {
      const label = r.name || r.transactionType || r.id
      map.set(r.id, label)
    }
    return map
  }, [rules])

  // ---- Create/edit modal state (preserved) ----
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

  // ---- Data fetching (extended with date filter, same logic otherwise) ----
  const fetchTxns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await transactionsApi.list({
        search: search || undefined,
        page,
        pageSize,
        transactionFrom: filters.transactionFrom || undefined,
        transactionTo:   filters.transactionTo   || undefined,
      })
      const norm = normalizeList<Transaction>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, filters.transactionFrom, filters.transactionTo, toast])

  useEffect(() => {
    fetchTxns()
  }, [fetchTxns])

  useEffect(() => {
    transactionRulesApi
      .list({ pageSize: 200 })
      .then((res) => setRules(normalizeList<TransactionRule>(res).items))
      .catch(() => {})
  }, [])

  const clearDates = () =>
    setFilters({ transactionFrom: '', transactionTo: '' })

  // ---- CRUD handlers (preserved) ----
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
      amount: String(
        t.amount ?? firstLine?.debit ?? firstLine?.credit ?? '',
      ),
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

  const loadDetail = async (row: Transaction) => {
    // Show something immediately using list data.
    setDetail(row)
    try {
      const t = await transactionsApi.get(row.id)
      const anyT = t as any
      const merged: Transaction = {
        ...row,
        ...t,
        reference: t.reference ?? row.reference,
        invoiceNo:
          (t as any).invoiceNo ??
          anyT.invoiceNumber ??
          anyT.invoice_no ??
          row.invoiceNo,
        transactionTypeId: t.transactionTypeId ?? row.transactionTypeId,
        transactionType: t.transactionType ?? row.transactionType,
        transactionDate:
          (t as any).transactionDate ??
          anyT.transaction_date ??
          row.transactionDate,
        amount: (t as any).amount ?? anyT.total ?? row.amount,
        lines: t.lines ?? anyT.transactionLines ?? row.lines,
      }
      setDetail(merged)
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
            <Button onClick={downloadTemplate} variant="outline" size="sm">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Template</span>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {uploading ? 'Uploading…' : 'Upload Excel'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={uploading}
                  onChange={onUpload}
                />
              </label>
            </Button>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              New entry
            </Button>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        {/* ===== Filters: search + date range (rule 2) ===== */}
        <Card className="p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="txn-search">Search</Label>
              <Input
                id="txn-search"
                placeholder="Reference or description…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-from">From</Label>
              <Input
                id="txn-from"
                type="date"
                value={filters.transactionFrom}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, transactionFrom: e.target.value }))
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-to">To</Label>
              <Input
                id="txn-to"
                type="date"
                value={filters.transactionTo}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, transactionTo: e.target.value }))
                  setPage(1)
                }}
              />
            </div>
          </div>
          {(filters.transactionFrom || filters.transactionTo) && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={clearDates}
                className="text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Clear dates
              </Button>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-16 text-center text-muted-foreground text-sm">
              Loading entries…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="The journal is empty."
              description="Post your first entry, or upload an Excel batch."
              action={
                <div className="flex gap-2 justify-center">
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Post first entry
                  </Button>
                  <Button onClick={downloadTemplate} variant="outline">
                    <Download className="h-4 w-4" />
                    Get template
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Column renamed: Date → Transaction Date (rule 2) */}
                    <TableHead>Transaction Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    {/* Column renamed: Total → Transaction Amount (rule 2) */}
                    <TableHead className="text-right">
                      Transaction Amount
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((t) => {
                    const totalAmount =
                      parseFloat(String(t.amount ?? '')) || 0
                    return (
                      // Whole row is clickable (rule 2). Action buttons
                      // stopPropagation so they don't trigger row click.
                      <TableRow
                        key={t.id}
                        onClick={() => loadDetail(t)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {formatDate(t.transactionDate)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {t.reference ?? '(no reference)'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-xs font-mono">
                          {t.transactionType?.name ||
                            transactionTypeLabelById.get(t.transactionTypeId) ||
                            t.transactionTypeId?.slice(0, 8) ||
                            '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular whitespace-nowrap">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                        <TableCell
                          className="text-right whitespace-nowrap"
                          // stop bubbling so clicks on action buttons don't
                          // also open the detail modal
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadDetail(t)}
                              title="View"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadVoucher(t.id)}
                              title="Download voucher"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">PDF</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(t)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onDelete(t)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      </div>

      {/* ===== Create / Edit modal ===== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit entry' : 'New journal entry'}
        subtitle="The transaction rule determines which accounts are debited and credited."
        maxWidth="sm:max-w-xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="txn-date">Transaction Date</Label>
              <Input
                id="txn-date"
                type="date"
                required
                value={form.transactionDate}
                onChange={(e) =>
                  setForm({ ...form, transactionDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-ref">Reference / Invoice No</Label>
              <Input
                id="txn-ref"
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
                placeholder="INV-001"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="txn-type">Transaction type (rule)</Label>
            <Select
              required
              value={form.transactionTypeId}
              onValueChange={(v) =>
                setForm({ ...form, transactionTypeId: v })
              }
            >
              <SelectTrigger id="txn-type">
                <SelectValue placeholder="Choose a rule…" />
              </SelectTrigger>
              <SelectContent>
                {rules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {r.transactionType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rules.length === 0 && (
              <p className="text-xs text-destructive">
                No transaction rules defined yet. Visit Rules first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="txn-desc">Description</Label>
            <Input
              id="txn-desc"
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Sale of services to ACME Co."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="txn-amount">
              Transaction Amount ({DEFAULT_CURRENCY_SYMBOL})
            </Label>
            <Input
              id="txn-amount"
              required
              type="number"
              step="0.01"
              min="0"
              className="font-mono"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Posting…' : editing ? 'Save changes' : 'Post entry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Detail modal — rule 2 changes applied ===== */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.reference ?? 'Journal entry'}
        subtitle={
          detail
            ? `Posted ${formatDate(detail.transactionDate)}`
            : undefined
        }
        maxWidth="sm:max-w-2xl"
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="Reference" value={detail.reference ?? '—'} />
              {/* Rule 2: show invoice no instead of plain "Date" */}
              <Field
                label="Invoice No"
                value={detail.invoiceNo ?? detail.reference ?? '—'}
              />
              <Field
                label="Transaction Date"
                value={formatDate(detail.transactionDate)}
              />
              <Field
                label="Type"
                value={
                  detail.transactionType?.name ||
                  transactionTypeLabelById.get(detail.transactionTypeId) ||
                  detail.transactionTypeId
                }
              />
              <Field
                label="Transaction Amount"
                value={formatCurrency(parseFloat(String(detail.amount ?? '0')) || 0)}
              />
              <Field label="Lines" value={String(detail.lines?.length ?? 0)} />
            </div>

            <div className="rule-ornament" />

            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Lines
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Description
                      </TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.lines?.map((l, i) => (
                      <TableRow key={l.id ?? i}>
                        <TableCell className="font-mono text-xs">
                          {l.account?.code ?? '—'} ·{' '}
                          {l.account?.name ?? ''}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {l.description}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular">
                          {parseFloat(String(l.debit)) > 0
                            ? formatCurrency(l.debit as number)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular">
                          {parseFloat(String(l.credit)) > 0
                            ? formatCurrency(l.credit as number)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => downloadVoucher(detail.id)}
              >
                <Download className="h-4 w-4" />
                Download voucher
              </Button>
              <Button onClick={() => setDetail(null)}>Close</Button>
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
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-sm text-foreground break-words">{value}</div>
    </div>
  )
}
