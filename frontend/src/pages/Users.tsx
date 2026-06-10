import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  XCircle,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Modal from '@/components/common/Modal'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import { usersApi } from '@/api/users'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { formatDateTime, normalizeList } from '@/lib/utils'
import { isCustomerAdmin, isSuperAdmin, roleLabel } from '@/lib/roles'
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
import type { User } from '@/types'

/**
 * Unified Users page.
 *
 *  - super_admin    → sees every user across customers, can activate /
 *                     deactivate, delete, and view details.
 *  - customer_admin → sees users in their own customer, can invite + delete.
 *  - customer_user  → not allowed (route is gated by ProtectedRoute logic).
 */
export default function Users() {
  const { user } = useAuth()
  const { toast } = useToast()

  const sa = isSuperAdmin(user)
  const ca = isCustomerAdmin(user)

  const [items, setItems] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Invite (customer_admin) modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '' })
  const [inviting, setInviting] = useState(false)

  // View-details (super_admin) modal state
  const [detailUser, setDetailUser] = useState<User | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({
        search: search || undefined,
        page,
        pageSize,
      })
      const norm = normalizeList<User>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const onInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      await usersApi.invite({
        email: inviteForm.email,
        firstName: inviteForm.firstName,
      })
      toast('Invitation sent', 'success')
      setInviteOpen(false)
      setInviteForm({ email: '', firstName: '' })
      fetchUsers()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setInviting(false)
    }
  }

  const onDelete = async (u: User) => {
    if (!confirm(`Delete user "${u.email}"? This cannot be undone.`)) return
    try {
      await usersApi.remove(u.id)
      toast('User deleted', 'success')
      fetchUsers()
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const onToggleActive = async (u: User) => {
    const verb = u.isActive ? 'Deactivate' : 'Activate'
    if (!confirm(`${verb} user "${u.email}"?`)) return
    try {
      await usersApi.toggleActivation(u.id)
      toast(`User ${u.isActive ? 'deactivated' : 'activated'}`, 'success')
      fetchUsers()
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }

  const eyebrow = sa
    ? 'All customers · super admin'
    : 'Your team · customer admin'
  const subtitle = sa
    ? 'Every user across all customers. Toggle activation, delete, or open details.'
    : 'Invite teammates to your workspace, or remove invitations that are no longer needed.'

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title="Users."
        subtitle={subtitle}
        actions={
          ca ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" />
              Invite user
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-6">
          <Input
            className="lg:max-w-xs"
            placeholder="Search name, email, or phone…"
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
              Loading users…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No users yet."
              description={
                ca
                  ? 'Invite a teammate to get started.'
                  : 'Once customers sign up, their team members appear here.'
              }
              action={
                ca ? (
                  <Button onClick={() => setInviteOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Invite user
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden sm:table-cell">Verified</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Last login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-foreground">
                        {`${u.firstName} ${u.lastName}`.trim() || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {u.phone || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <XCircle className="h-3.5 w-3.5" />
                            Pending
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span
                          className={[
                            'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider',
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-muted text-muted-foreground',
                          ].join(' ')}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                        {formatDateTime(u.lastLoginDate ?? undefined)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {sa && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailUser(u)}
                              >
                                <UserCog className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Details</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onToggleActive(u)}
                                title={u.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                  {u.isActive ? 'Deactivate' : 'Activate'}
                                </span>
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDelete(u)}
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

      {/* ---- Invite modal (customer_admin) ---- */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite user"
        subtitle="Send an email invitation. They'll set their own password."
      >
        <form onSubmit={onInviteSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invFirst">First name</Label>
            <Input
              id="invFirst"
              required
              value={inviteForm.firstName}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, firstName: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invEmail">Email</Label>
            <Input
              id="invEmail"
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, email: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={inviting}>
              <Mail className="h-4 w-4" />
              {inviting ? 'Sending…' : 'Send invitation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Details modal (super_admin) ---- */}
      <Modal
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        title="User details"
        subtitle="Roles and customer assignment are read-only here."
        maxWidth="max-w-xl"
      >
        {detailUser && (
          <div className="space-y-4">
            <DetailRow label="Name">
              {`${detailUser.firstName} ${detailUser.lastName}`.trim() || '—'}
            </DetailRow>
            <DetailRow label="Email">{detailUser.email}</DetailRow>
            <DetailRow label="Phone">
              <span className="font-mono">{detailUser.phone || '—'}</span>
            </DetailRow>
            <DetailRow label="Email verified">
              {detailUser.isEmailVerified ? 'Yes' : 'No'}
            </DetailRow>
            <DetailRow label="Status">
              {detailUser.isActive ? 'Active' : 'Inactive'}
            </DetailRow>
            <DetailRow label="Last login">
              <span className="font-mono">
                {formatDateTime(detailUser.lastLoginDate ?? undefined)}
              </span>
            </DetailRow>

            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Roles & customers
              </div>
              <div className="space-y-2">
                {(detailUser.userRoles ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No role assignments.
                  </div>
                ) : (
                  (detailUser.userRoles ?? []).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {r.customer?.companyName ?? r.customerId}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {r.customer?.companyEmail ?? '—'}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-background border border-border">
                        {roleLabel(r.roleType)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground self-center">
        {label}
      </div>
      <div className="col-span-2 text-sm text-foreground">{children}</div>
    </div>
  )
}
