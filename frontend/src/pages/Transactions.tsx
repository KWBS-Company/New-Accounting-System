import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronsUpDown,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
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
import { accountsApi } from '@/api/accounts'
import { customerFiscalYearsApi } from '@/api/customers'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  cn,
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
import { NepaliDatePicker } from '@/components/common/NepaliDatePicker'
import NewAccountInline from '@/components/common/NewAccountInline'
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
import type {
  Account,
  CustomerFiscalYear,
  Transaction,
  TransactionRule,
} from '@/types'

/** Local working shape for an editable line in the journal form. */
type LineForm = {
  /** Present only when editing an existing transaction. */
  lineId?: string
  accountId: string
  debit: number
  credit: number
  description: string
}

function emptyLine(): LineForm {
  return { accountId: '', debit: 0, credit: 0, description: '' }
}

export default function Transactions() {
  const { toast } = useToast()

  // ---- List state ----
  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // ---- Filter state (rule 2 — date range + rule 4 — fiscal year) ----
  const [filters, setFilters] = useState<{
    transactionFrom: string
    transactionTo: string
    fiscalYearId: string
  }>({
    transactionFrom: '',
    transactionTo: '',
    fiscalYearId: '',
  })

  // Rules used as transaction "types"
  const [rules, setRules] = useState<TransactionRule[]>([])
  // Child accounts only (rule 7) — used for line account dropdowns.
  const [accounts, setAccounts] = useState<Account[]>([])
  // Fiscal years (rule 4)
  const [fiscalYears, setFiscalYears] = useState<CustomerFiscalYear[]>([])

  const transactionTypeLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rules) {
      const label = r.name || r.transactionType || r.id
      map.set(r.id, label)
    }
    return map
  }, [rules])

  // ---- Create/edit modal state ----
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState({
    description: '',
    reference: '',
    amount: '',
    transactionTypeId: '',
    transactionDate: new Date().toISOString().slice(0, 10),
  })
  const [lines, setLines] = useState<LineForm[]>([])
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Rule 2 / 7 (round 3): inline "+ account" lives per-line now. The shared
  // NewAccountInline component handles all the form state internally; we
  // just track which line index opened it so we can auto-fill that line
  // when the new account comes back.
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [accountTargetIndex, setAccountTargetIndex] = useState<number | null>(
    null,
  )

  // Detail view
  const [detail, setDetail] = useState<Transaction | null>(null)

  // Upload
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // ---- Data fetching ----
  const fetchTxns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await transactionsApi.list({
        search: search || undefined,
        page,
        pageSize,
        transactionFrom: filters.transactionFrom || undefined,
        transactionTo: filters.transactionTo || undefined,
        fiscalYearId: filters.fiscalYearId || undefined,
      })
      const norm = normalizeList<Transaction>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [
    search,
    page,
    pageSize,
    filters.transactionFrom,
    filters.transactionTo,
    filters.fiscalYearId,
    toast,
  ])

  useEffect(() => {
    fetchTxns()
  }, [fetchTxns])

  // Load rules, child-only accounts, and fiscal years.
  const loadAccounts = useCallback(async () => {
    try {
      const res = await accountsApi.list({
        pageSize: 500,
        showChildAccountOnly: true,
      })
      setAccounts(normalizeList<Account>(res).items)
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    transactionRulesApi
      .list({ pageSize: 200 })
      .then((res) => setRules(normalizeList<TransactionRule>(res).items))
      .catch(() => {})
    void loadAccounts()
    customerFiscalYearsApi
      .list()
      .then(setFiscalYears)
      .catch(() => {})
  }, [loadAccounts])

  const clearFilters = () =>
    setFilters({ transactionFrom: '', transactionTo: '', fiscalYearId: '' })

  // ---- Preview API: called when amount/description/transactionType change ----
  const requestPreview = useCallback(
    async (
      amount: string,
      description: string,
      transactionTypeId: string,
    ): Promise<void> => {
      if (!amount || !description || !transactionTypeId) {
        // Don't fire the preview until we have all three.
        return
      }
      // Don't overwrite an in-progress edit when editing — only request a
      // fresh preview on create flow, or when explicit "Recompute" is clicked.
      setPreviewing(true)
      setPreviewError(null)
      try {
        const previewed = await transactionsApi.previewLines({
          amount,
          description,
          transactionTypeId,
        })
        // Map to LineForm — backend doesn't return lineId here (these are
        // freshly computed lines, not persisted ones).
        const next: LineForm[] = previewed.map((l: any) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description ?? description,
        }))
        setLines(next)
      } catch (err) {
        setPreviewError(extractApiError(err))
      } finally {
        setPreviewing(false)
      }
    },
    [],
  )

  // Debounce preview triggers while the user is typing.
  const previewTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!modalOpen || editing) return // only auto-preview on create
    if (!form.amount || !form.description || !form.transactionTypeId) return
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => {
      void requestPreview(
        form.amount,
        form.description,
        form.transactionTypeId,
      )
    }, 350)
    return () => {
      if (previewTimer.current) {
        window.clearTimeout(previewTimer.current)
      }
    }
  }, [
    modalOpen,
    editing,
    form.amount,
    form.description,
    form.transactionTypeId,
    requestPreview,
  ])

  // ---- Sync total amount with sum of debits when user edits lines ----
  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return { debit, credit }
  }, [lines])

  const linesBalanced = Math.abs(totals.debit - totals.credit) < 0.001
  const linesAmount = totals.debit // sum of debits = transaction total

  // Whenever the lines' debit-total changes, mirror it into the form amount.
  useEffect(() => {
    if (!modalOpen) return
    if (lines.length === 0) return
    if (!linesBalanced) return
    const current = parseFloat(form.amount || '0') || 0
    if (Math.abs(current - linesAmount) > 0.001) {
      setForm((f) => ({ ...f, amount: linesAmount ? String(linesAmount) : '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesAmount, linesBalanced, modalOpen])

  // ---- CRUD handlers ----
  const openCreate = () => {
    setEditing(null)
    setForm({
      description: '',
      reference: '',
      amount: '',
      transactionTypeId: '',
      transactionDate: new Date().toISOString().slice(0, 10),
    })
    setLines([])
    setPreviewError(null)
    setModalOpen(true)
  }

  const openEdit = async (t: Transaction) => {
    setEditing(t)
    setPreviewError(null)
    const firstLine = t.lines?.[0]
    setForm({
      description: firstLine?.description ?? '',
      reference: t.reference ?? '',
      amount: String(
        t.amount ?? firstLine?.debit ?? firstLine?.credit ?? '',
      ),
      transactionTypeId: t.transactionTypeId ?? '',
      transactionDate: (t.transactionDate || '').slice(0, 10),
    })
    setLines(
      (t.lines ?? []).map((l: any) => ({
        lineId: l.id ?? l.lineId,
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description ?? '',
      })),
    )
    setModalOpen(true)
    // Fetch the full record so we definitely have lineIds.
    try {
      const full: any = await transactionsApi.get(t.id)
      const merged: Transaction = {
        ...t,
        ...full,
      }
      setEditing(merged)
      if (Array.isArray(merged.lines)) {
        setLines(
          merged.lines.map((l: any) => ({
            lineId: l.id ?? l.lineId,
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description ?? '',
          })),
        )
      }
    } catch {
      /* non-fatal */
    }
  }

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    setLines((ls) =>
      ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length < 2) {
      toast('At least 2 lines are required.', 'error')
      return
    }
    if (!linesBalanced) {
      toast(
        `Lines must balance. Debit: ${formatCurrency(totals.debit)} · Credit: ${formatCurrency(totals.credit)}`,
        'error',
      )
      return
    }
    if (lines.some((l) => !l.accountId)) {
      toast('Each line needs an account.', 'error')
      return
    }
    setSaving(true)
    try {
      const isoDate = new Date(form.transactionDate).toISOString()
      const amountNum = Number(linesAmount.toFixed(2))
      if (editing) {
        if (lines.some((l) => !l.lineId)) {
          toast(
            'Editing requires every line to carry a lineId. Please reopen and retry.',
            'error',
          )
          setSaving(false)
          return
        }
        await transactionsApi.update(editing.id, {
          reference: form.reference || undefined,
          amount: amountNum,
          transactionDate: isoDate,
          lines: lines.map((l) => ({
            lineId: l.lineId as string,
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || form.description,
          })),
        })
        toast('Entry updated', 'success')
      } else {
        await transactionsApi.create({
          reference: form.reference || undefined,
          amount: amountNum,
          transactionDate: isoDate,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || form.description,
          })),
        })
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
    setDetail(row)
    try {
      const t: any = await transactionsApi.get(row.id)
      const merged: Transaction = {
        ...row,
        ...t,
        reference: t.reference ?? row.reference,
        invoiceNo:
          t.invoiceNo ?? t.invoiceNumber ?? t.invoice_no ?? row.invoiceNo,
        transactionTypeId: t.transactionTypeId ?? row.transactionTypeId,
        transactionType: t.transactionType ?? row.transactionType,
        transactionDate:
          t.transactionDate ?? t.transaction_date ?? row.transactionDate,
        amount: t.amount ?? t.total ?? row.amount,
        lines: t.lines ?? t.transactionLines ?? row.lines,
      }
      setDetail(merged)
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  // Rule 2 (round 3): inline "+ account" launcher tied to a line index.
  const openNewAccountFor = (i: number) => {
    setAccountTargetIndex(i)
    setNewAccountOpen(true)
  }
  const onAccountCreated = async (created: Account) => {
    // Refresh the child-only account list so the new entry is selectable.
    await loadAccounts()
    if (accountTargetIndex !== null && created?.id) {
      updateLine(accountTargetIndex, { accountId: created.id })
    }
    setAccountTargetIndex(null)
  }

  // Rule 2 (round 3): manually add an empty line. No preview call — the user
  // wants to type debits / credits themselves.
  const addManualLine = () => {
    setLines((ls) => [...ls, emptyLine()])
  }
  const removeLine = (i: number) => {
    if (lines.length <= 2) {
      toast('A journal entry needs at least 2 lines.', 'info')
      return
    }
    setLines((ls) => ls.filter((_, idx) => idx !== i))
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
        {/* ===== Filters: search + date range + fiscal year (rule 4) ===== */}
        <Card className="p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
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
              <NepaliDatePicker
                id="txn-from"
                value={filters.transactionFrom}
                onChange={(v) => {
                  setFilters((f) => ({ ...f, transactionFrom: v }))
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-to">To</Label>
              <NepaliDatePicker
                id="txn-to"
                value={filters.transactionTo}
                onChange={(v) => {
                  setFilters((f) => ({ ...f, transactionTo: v }))
                  setPage(1)
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-fy">Fiscal year</Label>
              <Select
                value={filters.fiscalYearId || ''}
                onValueChange={(v) => {
                  setFilters((f) => ({ ...f, fiscalYearId: v }))
                  setPage(1)
                }}
              >
                <SelectTrigger id="txn-fy">
                  <SelectValue
                    placeholder={
                      fiscalYears.find((fy) => fy.status === 'open')
                        ? `${fiscalYears.find((fy) => fy.status === 'open')!.name} — Current`
                        : 'Choose fiscal year…'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map((fy) => (
                    <SelectItem key={fy.id} value={fy.id}>
                      {fy.name} — {fy.status === 'open' ? 'Current' : 'Closed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(filters.transactionFrom ||
            filters.transactionTo ||
            filters.fiscalYearId) && (
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
                    <TableHead>Transaction Date</TableHead>
                    <TableHead>Reference</TableHead>
                    {/* Rule 6: transactionType column removed */}
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
                        <TableCell className="text-right font-mono tabular whitespace-nowrap">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                        <TableCell
                          className="text-right whitespace-nowrap"
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
        subtitle="Choose a rule, enter amount + description, and the journal lines preview. You can tune debits/credits before posting."
        maxWidth="sm:max-w-3xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="txn-date">Transaction Date</Label>
              <NepaliDatePicker
                id="txn-date"
                required
                value={form.transactionDate}
                onChange={(v) => setForm({ ...form, transactionDate: v })}
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
            <Label htmlFor="txn-type">Transaction type</Label>
            <TransactionTypeCombobox
              rules={rules}
              value={form.transactionTypeId}
              disabled={!!editing}
              onChange={(id) => {
                setForm((f) => ({ ...f, transactionTypeId: id }))
                // Rule 2 (round 3): on type change, drop the existing lines.
                // The auto-preview effect will repopulate them as soon as
                // amount + description are also present. If the user has
                // typed nothing yet, the lines area just shows the empty
                // prompt — clean slate, no stale data.
                setLines([])
                setPreviewError(null)
              }}
            />
            {rules.length === 0 && (
              <p className="text-xs text-destructive">
                No transaction rules defined yet. Visit Rules first.
              </p>
            )}
            {editing && (
              <p className="text-xs text-muted-foreground">
                Transaction type can't be changed after posting.
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
                readOnly={!!editing}
                onChange={(e) =>
                  !editing && setForm({ ...form, amount: e.target.value })
                }
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                {editing
                  ? 'Amount is calculated from the lines below.'
                  : 'Edit the lines below and this will recalculate to their debit total.'}
              </p>
            </div>
          </div>

          {/* Rule 2 (round 3): preview-driven AND manually-editable lines.
              Header carries "+ line" (manual add) and "Recompute" (re-run
              preview for the current amount + description + type). The
              "+ account" affordance moved inline next to each line's
              account dropdown. */}
          <div className="rule-ornament" />

          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Journal lines{' '}
              {previewing && (
                <span className="ml-2 text-primary">computing…</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addManualLine}
                title="Add an empty line you can fill in"
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </Button>
              {!editing && form.amount && form.description && form.transactionTypeId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    requestPreview(
                      form.amount,
                      form.description,
                      form.transactionTypeId,
                    )
                  }
                  disabled={previewing}
                >
                  Recompute
                </Button>
              )}
            </div>
          </div>

          {previewError && (
            <p className="text-xs text-destructive">{previewError}</p>
          )}

          {lines.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
              {editing
                ? 'No lines on this transaction.'
                : 'Pick a transaction type, type the amount and description — lines will appear here, or use "Add line" to enter them manually.'}
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div
                  key={l.lineId ?? `new-${i}`}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-muted/40 border border-border rounded-md"
                >
                  <div className="sm:col-span-5 space-y-1.5">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Account
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Select
                          value={l.accountId || ''}
                          onValueChange={(v) =>
                            updateLine(i, { accountId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose account…" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} · {a.name} ({a.accountType})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openNewAccountFor(i)}
                        title="Create a new account"
                        className="shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="sm:col-span-3 space-y-1.5">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Debit
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="font-mono"
                      value={l.debit}
                      onChange={(e) =>
                        updateLine(i, {
                          debit: Number(e.target.value) || 0,
                          credit: 0,
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1.5">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Credit
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="font-mono"
                      value={l.credit}
                      onChange={(e) =>
                        updateLine(i, {
                          credit: Number(e.target.value) || 0,
                          debit: 0,
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-1 flex sm:items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(i)}
                      title="Remove line"
                      disabled={lines.length <= 2}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="sm:col-span-12 space-y-1.5">
                    <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Description
                    </Label>
                    <Input
                      value={l.description}
                      onChange={(e) =>
                        updateLine(i, { description: e.target.value })
                      }
                      placeholder={form.description}
                    />
                  </div>
                </div>
              ))}

              {/* Totals strip */}
              <div className="flex items-center justify-end gap-4 pt-1 text-xs font-mono">
                <span>
                  Debit:{' '}
                  <span className="tabular font-medium">
                    {formatCurrency(totals.debit)}
                  </span>
                </span>
                <span>
                  Credit:{' '}
                  <span className="tabular font-medium">
                    {formatCurrency(totals.credit)}
                  </span>
                </span>
                <span
                  className={
                    linesBalanced ? 'text-primary' : 'text-destructive'
                  }
                >
                  {linesBalanced
                    ? 'Balanced ✓'
                    : `Off by ${formatCurrency(Math.abs(totals.debit - totals.credit))}`}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                previewing ||
                lines.length < 2 ||
                !linesBalanced ||
                lines.some((l) => !l.accountId)
              }
            >
              {saving ? 'Posting…' : editing ? 'Save changes' : 'Post entry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Inline "+ account" modal (rule 2 round 3, shared with Rules) ===== */}
      <NewAccountInline
        open={newAccountOpen}
        onClose={() => {
          setNewAccountOpen(false)
          setAccountTargetIndex(null)
        }}
        onCreated={onAccountCreated}
      />

      {/* ===== Detail modal ===== */}
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
                  (detail.transactionTypeId
                    ? transactionTypeLabelById.get(detail.transactionTypeId) ?? detail.transactionTypeId
                    : '—')
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

/**
 * Rule 2 (round 3): searchable transaction-type picker. Replaces the prior
 * dropdown with a text input + filtered popover list. Selecting an option
 * fires `onChange(id)`. Typing narrows the list; pressing Enter on a single
 * match selects it.
 *
 * The selection is fully controlled by `value` (the rule id). The display
 * label is derived from the rules array.
 */
function TransactionTypeCombobox({
  rules,
  value,
  onChange,
  disabled,
}: {
  rules: TransactionRule[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => rules.find((r) => r.id === value),
    [rules, value],
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return rules
    const q = query.toLowerCase().trim()
    return rules.filter((r) => {
      const hay = `${r.name ?? ''} ${r.transactionType ?? ''} ${r.description ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rules, query])

  const triggerLabel = selected
    ? `${selected.name}${selected.transactionType ? ` — ${selected.transactionType}` : ''}`
    : 'Search transaction type…'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((o) => !o)
          setQuery('')
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 1) {
                  e.preventDefault()
                  onChange(filtered[0].id)
                  setOpen(false)
                } else if (e.key === 'Escape') {
                  setOpen(false)
                }
              }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No transaction types match "{query}".
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = r.id === value
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onChange(r.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent/60',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      {r.transactionType && (
                        <div className="text-[11px] font-mono text-muted-foreground truncate">
                          {r.transactionType}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
