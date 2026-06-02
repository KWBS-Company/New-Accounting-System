import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'

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
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="font-display text-3xl tracking-tightest font-light text-ink-900 mb-8">
          Ledger.
        </div>

        <div className="card p-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald_ledger-500 mb-3">
            Email verification
          </div>

          {state === 'verifying' && (
            <>
              <h1 className="font-display text-3xl font-light tracking-tightest text-ink-900 mb-2">
                Verifying…
              </h1>
              <p className="text-ink-500 text-sm">
                One moment while we confirm your email.
              </p>
            </>
          )}

          {state === 'ok' && (
            <>
              <h1 className="font-display text-3xl font-light tracking-tightest text-ink-900 mb-2">
                You're verified.
              </h1>
              <p className="text-ink-500 text-sm mb-6">
                Your account is ready. Sign in to begin.
              </p>
              <Link to="/login" className="btn-primary">
                Sign in →
              </Link>
            </>
          )}

          {state === 'err' && (
            <>
              <h1 className="font-display text-3xl font-light tracking-tightest text-claret-500 mb-2">
                Link expired.
              </h1>
              <p className="text-ink-500 text-sm mb-6">
                Request a fresh verification email below.
              </p>
            </>
          )}

          {state === 'idle' && (
            <>
              <h1 className="font-display text-3xl font-light tracking-tightest text-ink-900 mb-2">
                Resend verification
              </h1>
              <p className="text-ink-500 text-sm mb-6">
                Enter your email and we'll send a new link.
              </p>
            </>
          )}

          {(state === 'idle' || state === 'err') && (
            <form onSubmit={onResend} className="space-y-3 text-left">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="field"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={resending}
                className="btn-primary w-full"
              >
                {resending ? 'Sending…' : 'Send verification email'}
              </button>
            </form>
          )}
        </div>

        <Link
          to="/login"
          className="inline-block mt-6 text-sm text-ink-500 hover:text-ink-900"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}
