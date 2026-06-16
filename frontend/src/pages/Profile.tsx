import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Building2,
  Camera,
  CalendarClock,
  Loader2,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { assetUrl, extractApiError } from '@/api/client'
import { profileApi } from '@/api/profile'
import { customersApi, customerFiscalYearsApi } from '@/api/customers'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PasswordInput } from '@/components/common/PasswordInput'
import { PhoneInput } from '@/components/common/PhoneInput'
import {
  CustomerFormFields,
  toFormState,
} from '@/pages/Customers'
import {
  PASSWORD_HINT,
  PASSWORD_MIN_LENGTH,
  passwordIssues,
} from '@/lib/validators'
import { isCustomerAdmin, isSuperAdmin, primaryCustomerId } from '@/lib/roles'
import { formatDate } from '@/lib/utils'
import { adLabel, adToBs, bsLabel, parseIsoDate } from '@/lib/nepali-date'
import type { Customer, CustomerFiscalYear } from '@/types'

export default function Profile() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()

  // Rule 7 (round 3): super_admin gets a stripped-down profile —
  // personal info is read-only, password change is hidden, and the
  // entire company / fiscal-year section is hidden. They're not part
  // of any customer's books, so there's nothing for them to edit.
  const readOnlyProfile = isSuperAdmin(user)

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || '?'

  // ---- Avatar upload ----
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  /**
   * Bumps on every successful logo / avatar upload. Used as a cache-buster
   * for the <img> sources so Radix' <AvatarImage> re-fetches even if the
   * backend kept the same filename or the browser cached the previous URL.
   */
  const [imgTick, setImgTick] = useState<number>(() => Date.now())

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
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
      await profileApi.uploadAvatar(file)
      await refresh()
      setImgTick(Date.now())
      toast('Profile photo updated', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ---- Profile info ----
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    setForm({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
    })
  }, [user?.id, user?.firstName, user?.lastName, user?.phone])

  const onProfileSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await profileApi.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      })
      await refresh()
      toast('Profile updated', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // Rule 8 (round 3): a user might not have a password on file (SSO users,
  // freshly-invited users who haven't completed signup). The /auth/me
  // response carries `password` so the frontend can tell — when it's
  // empty/null we hide the "current password" input and let the user set
  // a fresh one without verifying any prior credential.
  const hasPassword = !!user?.password

  // ---- Change password ----
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)

  const pwdIssues = pwd.next ? passwordIssues(pwd.next) : []
  const pwdMismatch =
    !!pwd.next && !!pwd.confirm && pwd.next !== pwd.confirm

  const onPwdSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pwdIssues.length) {
      toast('New password is too weak', 'error')
      return
    }
    if (pwdMismatch) {
      toast('New passwords do not match', 'error')
      return
    }
    setSavingPwd(true)
    try {
      await profileApi.changePassword({
        currentPassword: pwd.current,
        newPassword: pwd.next,
      })
      toast('Password changed', 'success')
      setPwd({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSavingPwd(false)
    }
  }

  // ---- Company details (customer_admin & super_admin) ----
  const canEditCompany = isCustomerAdmin(user) || isSuperAdmin(user)
  const customerId = primaryCustomerId(user)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [companyForm, setCompanyForm] = useState(() =>
    customer ? toFormState(customer) : null,
  )
  const [savingCompany, setSavingCompany] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  // ---- Fiscal years (rule 8) ----
  const [fiscalYears, setFiscalYears] = useState<CustomerFiscalYear[]>([])
  const [closingFY, setClosingFY] = useState(false)

  const loadCustomer = useCallback(async () => {
    if (!canEditCompany || !customerId) return
    try {
      const fresh = await customersApi.get(customerId)
      setCustomer(fresh)
      setCompanyForm(toFormState(fresh))
    } catch (err) {
      toast(extractApiError(err), 'error')
    }
  }, [canEditCompany, customerId, toast])

  const loadFiscalYears = useCallback(async () => {
    if (!canEditCompany) return
    try {
      const fys = await customerFiscalYearsApi.list()
      setFiscalYears(fys)
    } catch {
      /* non-fatal */
    }
  }, [canEditCompany])

  useEffect(() => {
    void loadCustomer()
  }, [loadCustomer])

  useEffect(() => {
    void loadFiscalYears()
  }, [loadFiscalYears])

  const onCompanySubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!customerId || !companyForm) return
    setSavingCompany(true)
    try {
      // Rule 8: fiscal start date stays as-is (read-only).
      await customersApi.update(customerId, {
        companyName: companyForm.companyName,
        description: companyForm.description || undefined,
        companyEmail: companyForm.companyEmail,
        companyAddress: companyForm.companyAddress,
        companyPhone: companyForm.companyPhone,
        companyWebsite: companyForm.companyWebsite || undefined,
        transactionCurrencyCode: companyForm.transactionCurrencyCode,
        // fiscalStartDate: companyForm.fiscalStartDate
        //   ? new Date(companyForm.fiscalStartDate).toISOString()
        //   : (customer?.fiscalStartDate ?? new Date().toISOString()),
        vatNumber: companyForm.vatNumber || undefined,
        panNumber: companyForm.panNumber || undefined,
      })
      toast('Company details updated', 'success')
      await loadCustomer()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSavingCompany(false)
    }
  }

  const onLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !customerId) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error')
      return
    }
    setUploadingLogo(true)
    try {
      await customersApi.uploadLogo(customerId, file)
      toast('Logo updated', 'success')
      await loadCustomer()
      setImgTick(Date.now())
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setUploadingLogo(false)
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  const onCloseFY = async () => {
    if (
      !confirm(
        "Close the current fiscal year? This will roll Profit/Loss into General Reserve and open the next year. This cannot be undone."
      )
    )
      return
    setClosingFY(true)
    try {
      await customerFiscalYearsApi.closeCurrent()
      toast('Fiscal year closed. New fiscal year opened.', 'success')
      await loadFiscalYears()
      await loadCustomer()
      await refresh()
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setClosingFY(false)
    }
  }

  const currentFY = fiscalYears.find((fy) => fy.status === 'open')

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile."
        subtitle="Update your details and security."
      />

      <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl mx-auto space-y-6">
        {/* ===== Avatar ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Camera className="h-5 w-5 text-primary" />
              Profile photo
            </CardTitle>
            <CardDescription>
              Upload a square image — JPG, PNG, or WebP, under 5MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage
                key={imgTick}
                src={assetUrl(user?.avatarUrl ?? undefined, imgTick)}
              />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || readOnlyProfile}
                variant="outline"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    Choose image
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Image is uploaded to the server and shown in the sidebar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ===== Personal info ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserIcon className="h-5 w-5 text-primary" />
              Personal info
            </CardTitle>
            <CardDescription>
              These appear on vouchers and reports you generate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onProfileSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    required
                    disabled={readOnlyProfile}
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    required
                    disabled={readOnlyProfile}
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user?.email ?? ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <PhoneInput
                  id="phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  placeholder="9800000000"
                  disabled={readOnlyProfile}
                />
              </div>
              {!readOnlyProfile && (
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              )}
              {readOnlyProfile && (
                <p className="text-xs text-muted-foreground">
                  Super admins manage the platform; personal details are
                  read-only on this screen.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* ===== Company details (customer_admin only — hidden for super_admin per rule 7) ===== */}
        {canEditCompany && !readOnlyProfile && companyForm && customer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" />
                Company details
              </CardTitle>
              <CardDescription>
                Update your company profile and upload a logo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCompanySubmit} className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 rounded-md">
                    <AvatarImage
                      key={imgTick}
                      src={assetUrl(customer.companyLogo, imgTick)}
                    />
                    <AvatarFallback className="rounded-md">
                      <Building2 className="h-7 w-7" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <input
                      ref={logoRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onLogoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
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

                <CustomerFormFields
                  form={companyForm}
                  setForm={setCompanyForm as any}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={savingCompany}>
                    {savingCompany ? 'Saving…' : 'Save company details'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ===== Fiscal Year management (rule 8) — hidden for super_admin per rule 7 ===== */}
        {canEditCompany && !readOnlyProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CalendarClock className="h-5 w-5 text-primary" />
                Accounting fiscal year
              </CardTitle>
              <CardDescription>
                Close the current fiscal year to roll Profit / Loss into General
                Reserve and start a fresh year. End date is computed automatically;
                you cannot edit it manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active / open FY summary */}
              {currentFY ? (
                <div className="rounded-md border border-border bg-muted/30 p-4 space-y-1.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Current open fiscal year
                  </div>
                  <div className="font-display text-xl tracking-tightest">
                    {currentFY.name}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {fmtBsAd(currentFY.startDate)} → {fmtBsAd(currentFY.endDate)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No open fiscal year. The next one will be created when you close
                  the current period.
                </p>
              )}

              {/* History */}
              {fiscalYears.filter((x) => x.status === 'closed').length > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Closed years
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {fiscalYears
                      .filter((x) => x.status === 'closed')
                      .map((fy) => (
                        <div
                          key={fy.id}
                          className="flex items-center justify-between text-xs font-mono text-muted-foreground"
                        >
                          <span>{fy.name}</span>
                          <span>
                            {formatDate(fy.startDate)} → {formatDate(fy.endDate)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCloseFY}
                  disabled={closingFY || !currentFY}
                  className="text-destructive hover:text-destructive border-destructive/30"
                >
                  {closingFY ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Closing…
                    </>
                  ) : (
                    <>
                      <CalendarClock className="h-4 w-4" />
                      Close current fiscal year
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== Change password — hidden for super_admin (rule 7).
             For customer_admin / customer_user (rule 8), the "current password"
             input only appears when the user actually has a password on file;
             SSO-only users (empty/null hash from /auth/me) skip straight to
             setting a new password. ===== */}
        {!readOnlyProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {hasPassword ? 'Change password' : 'Set password'}
              </CardTitle>
              <CardDescription>{PASSWORD_HINT}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onPwdSubmit} className="space-y-4">
                {hasPassword && (
                  <div className="space-y-1.5">
                    <Label htmlFor="current">Current password</Label>
                    <PasswordInput
                      id="current"
                      required
                      autoComplete="current-password"
                      value={pwd.current}
                      onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="next">New password</Label>
                  <PasswordInput
                    id="next"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    value={pwd.next}
                    onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <PasswordInput
                    id="confirm"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    value={pwd.confirm}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  />
                  {pwdMismatch && (
                    <p className="text-xs text-destructive">
                      Passwords don't match.
                    </p>
                  )}
                </div>
                {pwd.next && pwdIssues.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
                    {pwdIssues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingPwd || pwdIssues.length > 0 || pwdMismatch}
                  >
                    {savingPwd
                      ? 'Updating…'
                      : hasPassword
                        ? 'Update password'
                        : 'Set password'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

/** Format a date string with BS · AD labels. */
function fmtBsAd(iso?: string) {
  const ad = parseIsoDate(iso ?? undefined)
  if (!ad) return iso ?? '—'
  const bs = adToBs(ad)
  return `${bsLabel(bs)} · ${adLabel(ad)}`
}
