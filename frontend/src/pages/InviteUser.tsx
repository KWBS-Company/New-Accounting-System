import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react'
import { usersApi } from '@/api/users'
import { extractApiError } from '@/api/client'
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
import { PasswordInput } from '@/components/common/PasswordInput'
import { PhoneInput } from '@/components/common/PhoneInput'
import {
  PASSWORD_HINT,
  PASSWORD_MIN_LENGTH,
  passwordIssues,
} from '@/lib/validators'

/**
 * Public page reached from the invitation email link:
 *   /invite-user?token=…
 *
 * Collects firstName, lastName, phone, password, confirmPassword and POSTs
 * to /users/verify-invite-user. On success, redirects to /login.
 */
export default function InviteUser() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const nav = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const pwdIssues = form.password ? passwordIssues(form.password) : []
  const passwordsMismatch =
    !!form.password &&
    !!form.confirmPassword &&
    form.password !== form.confirmPassword

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (pwdIssues.length) {
      toast('Password is too weak', 'error')
      return
    }
    if (passwordsMismatch) {
      toast('Passwords do not match', 'error')
      return
    }
    setSubmitting(true)
    try {
      await usersApi.verifyInvite({
        token,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        password: form.password,
      })
      setDone(true)
      toast('Profile created — you can now sign in', 'success')
      setTimeout(() => nav('/login'), 1200)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle>Missing invitation token</CardTitle>
            </div>
            <CardDescription>
              The link you opened doesn't include a valid token. Please use the
              full link from your invitation email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>You're all set</CardTitle>
            </div>
            <CardDescription>
              Your profile is ready. Redirecting you to sign in…
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-2">
        You've been invited
      </div>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tightest font-light text-foreground mb-1">
        Finish your account.
      </h1>
      <p className="text-muted-foreground mb-8">
        Fill in your name, phone, and a strong password to activate your access.
      </p>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  required
                  value={form.firstName}
                  onChange={set('firstName')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  required
                  value={form.lastName}
                  onChange={set('lastName')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <PhoneInput
                id="phone"
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="9800000000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={form.password}
                onChange={set('password')}
              />
              <p className="text-xs text-muted-foreground font-mono mt-1.5">
                {PASSWORD_HINT}
              </p>
              {form.password && pwdIssues.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
                  {pwdIssues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
              />
              {passwordsMismatch && (
                <p className="text-xs text-destructive">
                  Passwords don't match.
                </p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={
                  submitting ||
                  pwdIssues.length > 0 ||
                  passwordsMismatch ||
                  !form.firstName ||
                  !form.lastName
                }
              >
                {submitting ? 'Activating…' : (
                  <>
                    Activate account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 bg-background">
      <div className="max-w-xl mx-auto">
        <Link to="/login" className="inline-block mb-8">
          <div className="font-display text-3xl tracking-tightest font-light text-foreground">
            {site.name}.
          </div>
        </Link>
        {children}
      </div>
    </div>
  )
}
