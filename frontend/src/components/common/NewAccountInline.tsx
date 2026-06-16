import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { accountsApi, accountTypesApi } from '@/api/accounts'
import { extractApiError } from '@/api/client'
import { normalizeList } from '@/lib/utils'
import Modal from '@/components/common/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Account, AccountType, AccountTypeOption } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  /** Fires after the backend confirms creation. The new account is passed back. */
  onCreated: (account: Account) => void
  /**
   * When set, the parent dropdown is pre-filtered to this id (e.g. so a journal
   * line for a particular section opens with a sensible default). Optional.
   */
  defaultParentId?: string
}

/**
 * Inline "+ account" modal — used by the Transactions and TransactionRules
 * pages so a user can spin up a missing account without leaving the form
 * they're editing. The modal mirrors the create rules used by the main
 * Accounts page: pick a parent OR provide a type + uppercase code.
 */
export default function NewAccountInline({
  open,
  onClose,
  onCreated,
  defaultParentId,
}: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: '',
    parentId: defaultParentId ?? '',
    accountType: '' as AccountType | '',
    code: '',
  })
  const [saving, setSaving] = useState(false)
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountTypeOption[]>([])

  const loadAll = useCallback(() => {
    accountsApi
      .list({ pageSize: 500 })
      .then((res) => setAllAccounts(normalizeList<Account>(res).items))
      .catch(() => {})
    accountTypesApi.list().then(setAccountTypes).catch(() => {})
  }, [])

  useEffect(() => {
    if (open) {
      loadAll()
      setForm({
        name: '',
        parentId: defaultParentId ?? '',
        accountType: '',
        code: '',
      })
    }
  }, [open, defaultParentId, loadAll])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = { name: form.name }
      if (form.parentId) {
        payload.parentId = form.parentId
      } else {
        if (!form.accountType) {
          throw new Error('Choose a parent account, or pick a type + code.')
        }
        if (!form.code) {
          throw new Error('Code is required when there is no parent.')
        }
        payload.accountType = form.accountType
        payload.code = form.code.toUpperCase()
      }
      const created = await accountsApi.create(payload)
      toast('Account created', 'success')
      onCreated(created)
      onClose()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New account"
      subtitle="Create an account without leaving the form."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="newacc-name">Name</Label>
          <Input
            id="newacc-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Cash on Hand"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newacc-parent">Parent (recommended)</Label>
          <Select
            value={form.parentId || 'none'}
            onValueChange={(v) =>
              setForm({ ...form, parentId: v === 'none' ? '' : v })
            }
          >
            <SelectTrigger id="newacc-parent">
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
          <p className="text-[11px] text-muted-foreground">
            Picking a parent overrides type and code.
          </p>
        </div>
        {!form.parentId && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="newacc-type">Account type</Label>
              <Select
                value={form.accountType || ''}
                onValueChange={(v) =>
                  setForm({ ...form, accountType: v as AccountType })
                }
              >
                <SelectTrigger id="newacc-type">
                  <SelectValue placeholder="Choose type…" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newacc-code">Code (uppercase letters)</Label>
              <Input
                id="newacc-code"
                required
                className="font-mono uppercase"
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
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
