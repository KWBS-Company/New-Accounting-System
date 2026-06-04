import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { toast } = useToast()

  const [state, setState] = useState<'idle' | 'verifying' | 'ok' | 'err'>(
    token ? 'verifying' : 'idle',
  )
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        await authApi.verifyEmail(token)
        if (!cancelled) {
          setState('ok')
          toast('Email verified', 'success')
        }
      } catch (err) {
        if (!cancelled) {
          setState('err')
          toast(extractApiError(err), 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, toast])

  const onResend = async (e: FormEvent) => {
    e.preventDefault()
    setResending(true)
    try {
      await authApi.resendVerification(resendEmail)
      toast('Verification email sent', 'success')
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="font-display text-3xl tracking-tightest font-light text-foreground mb-8">
          {site.name}.
        </div>

        <Card>
          <CardContent className="p-8 sm:p-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-3">
              Email verification
            </div>

            {state === 'verifying' && (
              <>
                <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                <h1 className="font-display text-2xl sm:text-3xl font-light tracking-tightest text-foreground mb-2">
                  Verifying…
                </h1>
                <p className="text-muted-foreground text-sm">
                  One moment while we confirm your email.
                </p>
              </>
            )}

            {state === 'ok' && (
              <>
                <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h1 className="font-display text-2xl sm:text-3xl font-light tracking-tightest text-foreground mb-2">
                  You're verified.
                </h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Your account is ready. Sign in to begin.
                </p>
                <Button asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </>
            )}

            {state === 'err' && (
              <>
                <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
                <h1 className="font-display text-2xl sm:text-3xl font-light tracking-tightest text-destructive mb-2">
                  Link expired.
                </h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Request a fresh verification email below.
                </p>
              </>
            )}

            {state === 'idle' && (
              <>
                <h1 className="font-display text-2xl sm:text-3xl font-light tracking-tightest text-foreground mb-2">
                  Resend verification
                </h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Enter your email and we'll send a new link.
                </p>
              </>
            )}

            {(state === 'idle' || state === 'err') && (
              <form onSubmit={onResend} className="space-y-3 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="resendEmail">Email</Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={resending} className="w-full">
                  {resending ? 'Sending…' : 'Send verification email'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Link
          to="/login"
          className="inline-flex items-center gap-1 mt-6 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
