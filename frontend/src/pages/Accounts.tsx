import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Download, Pencil, Plus, Trash2 } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Modal from '@/components/common/Modal'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import { accountsApi, accountTypesApi } from '@/api/accounts'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import {
  accountTypeChipClass,
  cn,
  downloadBlob,
  formatCurrency,
  formatDate,
  normalizeList,
} from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
  AccountType,
  AccountTypeOption,
  LedgerQuery,
  LedgerResponse,
} from '@/types'

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

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({
    name: '',
    code: '',
    accountType: '' as AccountType | '',
    parentId: '',
  })
  const [saving, setSaving] = useState(false)

  // Ledger state now holds LedgerResponse
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [ledgerData, setLedgerData] = useState<LedgerResponse | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)

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

  const fetchAll = useCallback(async () => {
    try {
      const res = await accountsApi.list({ pageSize: 500 })
      setAllAccounts(normalizeList<Account>(res).items)
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => {
    fetchAll()
    accountTypesApi.list().then(setAccountTypes).catch(() => {})
  }, [fetchAll])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', code: '', accountType: '', parentId: '' })
    setModalOpen(true)
  }

  const openEdit = async (a: Account) => {
    setEditing(a)
    setForm({ name: a.name, code: a.code, accountType: a.accountType, parentId: a.parentId ?? '' })
    setModalOpen(true)
    try {
      const fresh = await accountsApi.get(a.id)
      setEditing(fresh)
      setForm({
        name: fresh.name ?? '',
        code: fresh.code ?? '',
        accountType: (fresh.accountType ?? '') as AccountType | '',
        parentId: fresh.parentId ?? '',
      })
    } catch { /* non-fatal */ }
  }

  // No filters from Accounts page — plain call
  const openLedger = async (a: Account) => {
    setLedgerData(null)
    setLedgerOpen(true)
    setLedgerLoading(true)
    try {
      const data = await accountsApi.ledger(a.id)
      setLedgerData(data)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLedgerLoading(false)
    }
  }

  const downloadLedger = async (id: string, query: LedgerQuery = {}) => {
    try {
      const res = await accountsApi.ledgerPdf(id, query)
      downloadBlob(res.data, `ledger-${id.slice(0, 8)}.pdf`)
      toast('Ledger PDF downloaded', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
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
          if (!form.accountType) throw new Error('Choose an account type or a parent account')
          if (!form.code) throw new Error('Code is required when there is no parent')
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
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New account
          </Button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-6">
          <Input
            className="lg:max-w-xs"
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <Select
            value={typeFilter || 'all'}
            onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : (v as AccountType)); setPage(1) }}
          >
            <SelectTrigger className="lg:max-w-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {accountTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-16 text-center text-muted-foreground text-sm">Loading accounts…</div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No accounts yet."
              description="Begin with foundational accounts — Cash, Accounts Receivable, Revenue, etc."
              action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Create first account</Button>}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Parent</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => {
                    const parent = allAccounts.find((p) => p.id === a.parentId)
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-primary font-medium">{a.code}</TableCell>
                        <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                        <TableCell>
                          <span className={accountTypeChipClass(a.accountType)}>{a.accountType}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                          {parent ? `${parent.code} · ${parent.name}` : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-xs font-mono">
                          {formatDate(a.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openLedger(a)} title="View GL ledger">
                              <BookOpen className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Ledger</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onDelete(a)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            </>
          )}
        </Card>
      </div>

      {/* Create / Edit modal — unchanged */}
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
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Cash on Hand"
            />
          </div>

          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="codeRO">Code</Label>
                <Input id="codeRO" disabled className="font-mono uppercase" value={form.code} />
                <p className="text-xs text-muted-foreground">Code can't be changed after creation.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountTypeRO">Account type</Label>
                <Input id="accountTypeRO" disabled value={form.accountType || '—'} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parentRO">Parent</Label>
                <Input
                  id="parentRO" disabled
                  value={
                    form.parentId
                      ? (() => {
                          const p = allAccounts.find((x) => x.id === form.parentId)
                          return p ? `${p.code} · ${p.name}` : form.parentId
                        })()
                      : '— No parent (top-level) —'
                  }
                />
              </div>
              {editing.createdAt && (
                <div className="space-y-1.5">
                  <Label htmlFor="createdRO">Created</Label>
                  <Input id="createdRO" disabled className="font-mono text-xs" value={editing.createdAt} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="parent">Parent (optional)</Label>
                <Select
                  value={form.parentId || 'none'}
                  onValueChange={(v) => setForm({ ...form, parentId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="— No parent (top-level) —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No parent (top-level) —</SelectItem>
                    {allAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} · {a.name} ({a.accountType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Picking a parent overrides type and code.</p>
              </div>
              {!form.parentId && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="accountType">Account type</Label>
                    <Select
                      value={form.accountType || ''}
                      onValueChange={(v) => setForm({ ...form, accountType: v as AccountType })}
                    >
                      <SelectTrigger id="accountType">
                        <SelectValue placeholder="Choose type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="code">Code (uppercase letters)</Label>
                    <Input
                      id="code" required className="font-mono uppercase" value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      pattern="[A-Z]+" placeholder="CASH"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create account'}
            </Button>
          </div>
        </form>
      </Modal>

      <LedgerModal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        data={ledgerData}
        loading={ledgerLoading}
        onDownload={(id, query) => downloadLedger(id, query)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// LedgerModal — now consumes the new { ledger, lines, summary } shape
// ---------------------------------------------------------------------------

export function LedgerModal({
  open,
  onClose,
  data,
  loading,
  onDownload,
}: {
  open: boolean
  onClose: () => void
  /** Full LedgerResponse from the new endpoint shape. */
  data: LedgerResponse | null
  loading?: boolean
  onDownload: (id: string, query?: LedgerQuery) => void
  /** Optional filters to forward into the download call. */
  downloadQuery?: LedgerQuery
}) {
  const ledger = data?.ledger
  const lines = data?.lines ?? []
  const summary = data?.summary

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ledger ? `${ledger.code} · ${ledger.name}` : 'Ledger'}
      subtitle={ledger ? `General ledger detail — ${ledger.accountType}` : undefined}
      maxWidth="sm:max-w-4xl"
    >
      {/* Always render content area so modal has height */}
      <div className="space-y-4">
        {loading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">
            Loading ledger…
          </div>
        ) : !ledger || lines.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground text-sm">
            No transactions yet on this account.
          </div>
        ) : (
          <>
            {/* Summary stat strip */}
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <LedgerStat label="Opening balance" value={summary.openingBalance} />
                <LedgerStat label="Total debit" value={summary.totalDebit} />
                <LedgerStat label="Total credit" value={summary.totalCredit} />
                <LedgerStat label="Total balance" value={summary.totalBalance} />
                <LedgerStat
                  label="Closing balance"
                  value={summary.closingBalance}
                  highlight
                />
              </div>
            )}

            {/* Lines table */}
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Fiscal year</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => (
                    <TableRow key={`${l.serialNumber}-${i}`}>
                      <TableCell className="text-center text-xs text-muted-foreground tabular font-mono">
                        {l.serialNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {formatDate(l.transactionDate)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {l.fiscalYear}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {l.description ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular text-sm">
                        {l.debit > 0 ? formatCurrency(l.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular text-sm">
                        {l.credit > 0 ? formatCurrency(l.credit) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular text-sm font-medium',
                          l.balance < 0 && 'text-destructive',
                        )}
                      >
                        {l.balance < 0
                          ? `(${formatCurrency(Math.abs(l.balance))})`
                          : formatCurrency(l.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-t-2 border-foreground/80">
                    <TableCell colSpan={4} className="font-display text-base">
                      Totals
                    </TableCell>
                    <TableCell className="text-right font-mono tabular font-medium">
                      {formatCurrency(summary?.totalDebit ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular font-medium">
                      {formatCurrency(summary?.totalCredit ?? 0)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular font-medium',
                        (summary?.totalBalance ?? 0) < 0 && 'text-destructive',
                      )}
                    >
                      {(summary?.totalBalance ?? 0) < 0
                        ? `(${formatCurrency(Math.abs(summary!.totalBalance))})`
                        : formatCurrency(summary?.totalBalance ?? 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          {ledger && (
            <Button variant="outline" onClick={() => onDownload(ledger.id)}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

function LedgerStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border p-2.5',
        highlight ? 'bg-accent/40' : 'bg-card',
      )}
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          'font-display text-lg tabular',
          value < 0 ? 'text-destructive' : 'text-foreground',
        )}
      >
        {value < 0
          ? `(${formatCurrency(Math.abs(value))})`
          : formatCurrency(value)}
      </div>
    </div>
  )
}