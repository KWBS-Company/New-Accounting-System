import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authApi } from '@/api/auth'
import { extractApiError, TOKEN_KEY, USER_KEY } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneInput } from '@/components/common/PhoneInput'
import { CURRENCIES } from '@/lib/currency'
import { SSO_INTENT_KEY } from '@/components/common/GoogleButton'

/**
 * Google OAuth landing page. Reads the `code` query param and the SSO intent
 * stashed in localStorage to decide what to do:
 *
 *  - intent === 'signin'  → POST /auth/google-sso/verify-details with code,
 *                            persist the returned access token, go to /
 *  - intent === 'signup'  → render a form to capture company details, then
 *                            POST /auth/google-sso/register-details
 */
export default function GoogleSSO() {
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const errorParam = params.get('error') ?? ''
  const nav = useNavigate()
  const { toast } = useToast()
  const { setAuthToken } = useAuth()

  const intent =
    (typeof window !== 'undefined' &&
      (localStorage.getItem(SSO_INTENT_KEY) as 'signin' | 'signup' | null)) ||
    'signin'

  // The signin flow runs automatically once on mount. The signup flow
  // shows a form first and only POSTs when the user submits.
  const [signinState, setSigninState] =
    useState<'idle' | 'verifying' | 'error' | 'done'>('idle')
  const signinRanRef = useRef(false)

  useEffect(() => {
    if (signinRanRef.current) return
    if (intent !== 'signin') return
    if (!code) {
      setSigninState('error')
      return
    }
    signinRanRef.current = true
    setSigninState('verifying')
    ;(async () => {
      try {
        const raw = await authApi.googleVerifyDetails({ authorizationCode: code })
        // backend may or may not wrap with { data }
        const payload: any = (raw as any)?.data ?? raw
        const accessToken: string | undefined = payload?.accessToken
        if (!accessToken) throw new Error('No access token received')
        localStorage.setItem(TOKEN_KEY, accessToken)
        if (payload?.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
        }
        await setAuthToken(accessToken)
        toast('Welcome back', 'success')
        localStorage.removeItem(SSO_INTENT_KEY)
        setSigninState('done')
        nav('/', { replace: true })
      } catch (err) {
        toast(extractApiError(err), 'error')
        setSigninState('error')
      }
    })()
  }, [intent, code, nav, setAuthToken, toast])

  // ---- Signup form state ----
  const [form, setForm] = useState({
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    companyPhone: '',
    companyWebsite: '',
    transactionCurrencyCode: 'NPR',
    fiscalStartDate: '',
    fiscalEndDate: '',
    vatNumber: '',
    panNumber: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSignupSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code) {
      toast('Missing authorization code', 'error')
      return
    }
    if (!form.fiscalStartDate || !form.fiscalEndDate) {
      toast('Fiscal start and end dates are required', 'error')
      return
    }
    setSubmitting(true)
    try {
      const raw = await authApi.googleRegisterDetails({
        authorizationCode: code,
        companyName: form.companyName,
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
      const payload: any = (raw as any)?.data ?? raw
      const accessToken: string | undefined = payload?.accessToken
      if (!accessToken) throw new Error('No access token received')
      localStorage.setItem(TOKEN_KEY, accessToken)
      if (payload?.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
      }
      await setAuthToken(accessToken)
      toast('Welcome — account created', 'success')
      localStorage.removeItem(SSO_INTENT_KEY)
      nav('/', { replace: true })
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ----- Render branches -----
  // Hard error from Google (e.g. user denied)
  if (errorParam) {
    return (
      <CenteredCard
        title="Google sign-in cancelled"
        description={`Google returned: ${errorParam}`}
      >
        <Button asChild className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </CenteredCard>
    )
  }

  if (!code) {
    return (
      <CenteredCard
        title="Missing authorization code"
        description="Google didn't return a code. Please try signing in again."
      >
        <Button asChild className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </CenteredCard>
    )
  }

  if (intent === 'signin') {
    return (
      <CenteredCard
        title="Signing you in"
        description="Verifying your Google session…"
      >
        {signinState === 'verifying' && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-mono">Working…</span>
          </div>
        )}
        {signinState === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We couldn't sign you in with that code. It may have expired.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        )}
      </CenteredCard>
    )
  }

  // intent === 'signup' — capture company details + submit code
  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 bg-background">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-block mb-8">
          <div className="font-display text-3xl tracking-tightest font-light text-foreground">
            {site.name}.
          </div>
        </Link>

        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-2">
          Finish setup · Your company
        </div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tightest font-light text-foreground mb-1">
          Tell us about the business.
        </h1>
        <p className="text-muted-foreground mb-8">
          We have your Google identity — fill in your company so we can file
          your transactions.
        </p>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSignupSubmit} className="space-y-5">
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
                    onChange={(v) =>
                      setForm((f) => ({ ...f, companyPhone: v }))
                    }
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
                  <Label htmlFor="transactionCurrencyCode">
                    Transaction currency
                  </Label>
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
                  <Label htmlFor="panNumber">PAN number (optional)</Label>
                  <Input
                    id="panNumber"
                    value={form.panNumber}
                    onChange={set('panNumber')}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vatNumber">VAT number (optional)</Label>
                <Input
                  id="vatNumber"
                  value={form.vatNumber}
                  onChange={set('vatNumber')}
                />
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
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CenteredCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 bg-background">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-block mb-8">
          <div className="font-display text-3xl tracking-tightest font-light text-foreground">
            {site.name}.
          </div>
        </Link>
        <Card>
          <CardHeader>
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-1">
              Google sign-in
            </div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
