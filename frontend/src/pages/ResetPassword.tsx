import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/common/PasswordInput'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordIssues } from '@/lib/validators'

/**
 * Reset-password — step 2. Token comes from the email link
 * (?token=…). User picks a new password (with show/hide toggle).
 */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { toast } = useToast()

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const issues = password ? passwordIssues(password) : []
  const mismatch = !!password && !!confirm && password !== confirm

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (issues.length > 0) {
      toast('Password is too weak. ' + PASSWORD_HINT, 'error')
      return
    }
    if (mismatch) {
      toast('Passwords do not match', 'error')
      return
    }
    setSubmitting(true)
    try {
      await authApi.resetPassword({ token, password })
      setDone(true)
      toast('Password updated. You can sign in now.', 'success')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

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
              Password reset · Step 2
            </div>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>{PASSWORD_HINT}</CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  This reset link is missing its token. Request a new email
                  from <Link className="underline" to="/forgot-password">forgot password</Link>.
                </div>
              </div>
            ) : done ? (
              <div className="flex items-start gap-3 p-4 rounded-md bg-accent text-accent-foreground">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  Password updated. Redirecting to sign in…
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <PasswordInput
                    id="confirm"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  {mismatch && (
                    <p className="text-xs text-destructive">
                      Passwords don't match.
                    </p>
                  )}
                </div>

                {password && issues.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting || issues.length > 0 || mismatch}
                >
                  {submitting ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
