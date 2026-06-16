import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Modal from '@/components/common/Modal'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import { transactionRulesApi } from '@/api/transactionRules'
import { accountsApi } from '@/api/accounts'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { formatDate, normalizeList } from '@/lib/utils'
import {
  isValidTransactionType,
  sanitizeTransactionType,
  UPPERCASE_UNDERSCORE_REGEX,
} from '@/lib/validators'
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
import NewAccountInline from '@/components/common/NewAccountInline'
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

  // Rule 7: only allow child accounts (and EQUITY top-level via the backend filter).
  const loadAccounts = useCallback(() => {
    accountsApi
      .list({ pageSize: 500, showChildAccountOnly: true })
      .then((res) => setAccounts(normalizeList<Account>(res).items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

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
    setLines((l) =>
      l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    )

  // Rule 3 (round 3): "+ account" inline modal — opens with `accountTargetIndex`
  // set to the line that should receive the newly-created account.
  const [newAccountOpen, setNewAccountOpen] = useState(false)
  const [accountTargetIndex, setAccountTargetIndex] = useState<number | null>(
    null,
  )
  const openNewAccountFor = (i: number) => {
    setAccountTargetIndex(i)
    setNewAccountOpen(true)
  }
  const onAccountCreated = (created: Account) => {
    // Refresh the dropdown source so the new entry is selectable, then
    // auto-fill the line that triggered the modal.
    loadAccounts()
    if (accountTargetIndex !== null) {
      updateLine(accountTargetIndex, { accountId: created.id })
      setAccountTargetIndex(null)
    }
  }

  const onTransactionTypeChange = (raw: string) => {
    const cleaned = sanitizeTransactionType(raw)
    setForm((f) => ({ ...f, transactionType: cleaned }))
  }

  const transactionTypeValid =
    !form.transactionType || isValidTransactionType(form.transactionType)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidTransactionType(form.transactionType)) {
      toast(
        'Transaction type must be uppercase letters with underscores only.',
        'error',
      )
      return
    }
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
        eyebrow="Bookkeeping rules"
        title="Transaction rules."
        subtitle="Define a reusable recipe: which accounts get a debit and which get a credit."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New rule
          </Button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-6">
          <Input
            className="lg:max-w-xs"
            placeholder="Search rules…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="px-6 py-16 text-center text-muted-foreground text-sm">
              Loading rules…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No rules defined."
              description="Add a rule for each common business activity — sales, purchases, payroll."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Create first rule
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Description
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Created
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-foreground">
                        {r.name}
                      </TableCell>
                      <TableCell>
                        <span className="chip-equity">{r.transactionType}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-md truncate">
                        {r.description}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs font-mono">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDelete(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit rule' : 'New transaction rule'}
        subtitle="At least 2 lines — typically one increases (debit-like), one decreases (credit-like)."
        maxWidth="sm:max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Cash Sale"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-type">Transaction type</Label>
              <Input
                id="rule-type"
                required
                className="font-mono"
                value={form.transactionType}
                onChange={(e) => onTransactionTypeChange(e.target.value)}
                pattern={UPPERCASE_UNDERSCORE_REGEX.source}
                title="Uppercase letters and underscores only"
                placeholder="CASH_SALE"
                aria-invalid={!transactionTypeValid}
              />
              {!transactionTypeValid && (
                <p className="text-xs text-destructive">
                  Use uppercase letters and underscores only.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground font-mono">
                Uppercase A–Z and underscores. E.g. SALE, CASH_PAYMENT.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-desc">Description</Label>
            <Input
              id="rule-desc"
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What kind of business activity does this rule represent?"
            />
          </div>

          <div className="rule-ornament" />

          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Rule lines
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLine}
              disabled={!!editing}
              title={editing ? 'Not available while editing' : undefined}
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 p-3 bg-muted/40 border border-border rounded-md"
              >
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Account</Label>
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
                <div className="space-y-1.5">
                  <Label>Effect</Label>
                  <Select
                    value={l.increase ? 'inc' : 'dec'}
                    onValueChange={(v) =>
                      updateLine(i, { increase: v === 'inc' })
                    }
                  >
                    <SelectTrigger className="min-w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inc">Increase</SelectItem>
                      <SelectItem value="dec">Decrease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(i)}
                  className={`text-destructive hover:text-destructive ${
                    editing ? 'invisible pointer-events-none' : ''
                  }`}
                  title="Remove line"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

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
              disabled={saving || !transactionTypeValid}
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create rule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== Inline "+ account" modal (rule 3 round 3) ===== */}
      <NewAccountInline
        open={newAccountOpen}
        onClose={() => {
          setNewAccountOpen(false)
          setAccountTargetIndex(null)
        }}
        onCreated={onAccountCreated}
      />
    </>
  )
}
