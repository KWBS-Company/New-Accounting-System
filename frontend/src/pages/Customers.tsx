import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Camera, Loader2, Pencil } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Modal from '@/components/common/Modal'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import { customersApi } from '@/api/customers'
import { useToast } from '@/context/ToastContext'
import { assetUrl, extractApiError } from '@/api/client'
import { formatDate, normalizeList } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { PhoneInput } from '@/components/common/PhoneInput'
import { CURRENCIES } from '@/lib/currency'
import type { Customer } from '@/types'

/**
 * Customers page — super_admin only. Lists all customers (companies),
 * allows editing details + uploading logo via a dialog.
 */
export default function Customers() {
  const { toast } = useToast()

  const [items, setItems] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<EditFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customersApi.list({
        search: search || undefined,
        page,
        pageSize,
      })
      const norm = normalizeList<Customer>(res)
      setItems(norm.items)
      setTotal(norm.total)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, toast])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const openEdit = async (c: Customer) => {
    // Pull a fresh copy so we get any fields not included in the list payload.
    setEditing(c)
    setForm(toFormState(c))
    setEditOpen(true)
    try {
      const fresh = await customersApi.get(c.id)
      setEditing(fresh)
      setForm(toFormState(fresh))
    } catch {
      /* non-fatal; we already have the list copy */
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!form.fiscalStartDate || !form.fiscalEndDate) {
      toast('Fiscal start and end dates are required', 'error')
      return
    }
    setSaving(true)
    try {
      await customersApi.update(editing.id, {
        companyName: form.companyName,
        description: form.description || undefined,
        companyEmail: form.companyEmail,
        companyAddress: form.companyAddress,
        companyPhone: form.companyPhone,
        companyWebsite: form.companyWebsite || undefined,
        transactionCurrencyCode: form.transactionCurrencyCode,
        fiscalStartDate: new Date(form.fiscalStartDate).toISOString(),
        fiscalEndDate: new Date(form.fiscalEndDate).toISOString(),
        vatNumber: form.vatNumber || undefined,
        panNumber: form.panNumber || undefined,
      })
      toast('Customer updated', 'success')
      setEditOpen(false)
      fetchCustomers()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const onLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error')
      return
    }
    setUploading(true)
    try {
      await customersApi.uploadLogo(editing.id, file)
      toast('Logo updated', 'success')
      // Refresh the customer record to pick up the new path
      const fresh = await customersApi.get(editing.id)
      setEditing(fresh)
      fetchCustomers()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const initials = (editing?.companyName ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <PageHeader
        eyebrow="Super admin"
        title="Customers."
        subtitle="Every company on the platform. Edit details and upload logos."
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-6">
          <Input
            className="lg:max-w-xs"
            placeholder="Search…"
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
              Loading customers…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No customers."
              description="When companies sign up they'll appear here."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Currency</TableHead>
                    <TableHead className="hidden lg:table-cell">Fiscal year</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => {
                    const logoUrl = assetUrl(c.companyLogo)
                    const ini =
                      c.companyName
                        ?.split(/\s+/)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || '?'
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9 rounded-md">
                              <AvatarImage src={logoUrl} />
                              <AvatarFallback className="rounded-md text-xs">
                                {ini}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {c.companyName}
                              </div>
                              <div className="text-xs text-muted-foreground truncate font-mono">
                                {c.companyWebsite || c.companyAddress}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {c.companyEmail}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                          {c.companyPhone}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs">
                          {c.transactionCurrencyCode}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                          {formatDate(c.fiscalStartDate)} →{' '}
                          {formatDate(c.fiscalEndDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
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

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing?.companyName ?? 'Edit customer'}
        subtitle="Update company details and logo."
        maxWidth="max-w-2xl"
      >
        {editing && (
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 rounded-md">
                <AvatarImage src={assetUrl(editing.companyLogo)} />
                <AvatarFallback className="rounded-md">
                  <Building2 className="h-6 w-6" />
                  <span className="sr-only">{initials}</span>
                </AvatarFallback>
              </Avatar>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onLogoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Upload logo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Square image, under 5MB.
                </p>
              </div>
            </div>

            <CustomerFormFields form={form} setForm={setForm} />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

// ----- Shared edit form (also exported for use on Profile page) -----
type EditFormState = {
  companyName: string
  description: string
  companyEmail: string
  companyAddress: string
  companyPhone: string
  companyWebsite: string
  transactionCurrencyCode: string
  fiscalStartDate: string
  fiscalEndDate: string
  vatNumber: string
  panNumber: string
}

function emptyForm(): EditFormState {
  return {
    companyName: '',
    description: '',
    companyEmail: '',
    companyAddress: '',
    companyPhone: '',
    companyWebsite: '',
    transactionCurrencyCode: 'NPR',
    fiscalStartDate: '',
    fiscalEndDate: '',
    vatNumber: '',
    panNumber: '',
  }
}

export function toFormState(c: Customer): EditFormState {
  return {
    companyName: c.companyName ?? '',
    description: c.description ?? '',
    companyEmail: c.companyEmail ?? '',
    companyAddress: c.companyAddress ?? '',
    companyPhone: c.companyPhone ?? '',
    companyWebsite: c.companyWebsite ?? '',
    transactionCurrencyCode: c.transactionCurrencyCode ?? 'NPR',
    fiscalStartDate: c.fiscalStartDate
      ? new Date(c.fiscalStartDate).toISOString().slice(0, 10)
      : '',
    fiscalEndDate: c.fiscalEndDate
      ? new Date(c.fiscalEndDate).toISOString().slice(0, 10)
      : '',
    vatNumber: c.vatNumber ?? '',
    panNumber: c.panNumber ?? '',
  }
}

export function CustomerFormFields({
  form,
  setForm,
}: {
  form: EditFormState
  setForm: React.Dispatch<React.SetStateAction<EditFormState>>
}) {
  const set =
    (k: keyof EditFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="companyName">Company name</Label>
        <Input
          id="companyName"
          required
          value={form.companyName}
          onChange={set('companyName')}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyEmail">Company email</Label>
          <Input
            id="companyEmail"
            type="email"
            required
            value={form.companyEmail}
            onChange={set('companyEmail')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyPhone">Company phone</Label>
          <PhoneInput
            id="companyPhone"
            required
            value={form.companyPhone}
            onChange={(v) => setForm((f) => ({ ...f, companyPhone: v }))}
            placeholder="9800000000"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="companyAddress">Company address</Label>
        <Input
          id="companyAddress"
          required
          value={form.companyAddress}
          onChange={set('companyAddress')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="companyWebsite">Website (optional)</Label>
        <Input
          id="companyWebsite"
          value={form.companyWebsite}
          onChange={set('companyWebsite')}
          placeholder="https://"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="transactionCurrencyCode">Transaction currency</Label>
          <Select
            value={form.transactionCurrencyCode}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, transactionCurrencyCode: v }))
            }
          >
            <SelectTrigger id="transactionCurrencyCode">
              <SelectValue placeholder="Choose currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="panNumber">PAN number</Label>
          <Input
            id="panNumber"
            value={form.panNumber}
            onChange={set('panNumber')}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="vatNumber">VAT number</Label>
          <Input
            id="vatNumber"
            value={form.vatNumber}
            onChange={set('vatNumber')}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fiscalStartDate">Fiscal start date</Label>
          <Input
            id="fiscalStartDate"
            type="date"
            required
            value={form.fiscalStartDate}
            onChange={set('fiscalStartDate')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fiscalEndDate">Fiscal end date</Label>
          <Input
            id="fiscalEndDate"
            type="date"
            required
            value={form.fiscalEndDate}
            onChange={set('fiscalEndDate')}
          />
        </div>
      </div>
    </>
  )
}
