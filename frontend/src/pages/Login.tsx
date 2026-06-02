import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'

export default function Login() {
  const { login } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
      toast('Welcome back', 'success')
      navigate(from, { replace: true })
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — editorial panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-emerald_ledger-500 text-parchment-50 p-14 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(245,241,232,0.4) 28px, rgba(245,241,232,0.4) 29px)',
          }}
        />
        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-parchment-200 mb-2">
            Vol. 01 · No. 1
          </div>
          <div className="font-display text-5xl leading-none tracking-tightest font-light">
            Ledger.
          </div>
        </div>
        <div className="relative">
          <div className="rule-ornament mb-8" style={{ background: 'rgba(245,241,232,0.3)' }} />
          <blockquote className="font-display text-3xl leading-tight font-light max-w-md">
            “Every credit finds its debit;
            <br />
            <span className="italic">balance is not an opinion.</span>”
          </blockquote>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-parchment-200 mt-6">
            — A bookkeeper's first principle
          </div>
        </div>
        <div className="relative text-xs font-mono text-parchment-200/70">
          Double-entry accounting · est. 2026
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10">
            <div className="font-display text-4xl tracking-tightest font-light">
              Ledger.
            </div>
          </div>

          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald_ledger-500 mb-2">
            Sign in
          </div>
          <h1 className="font-display text-4xl tracking-tightest font-light text-ink-900 mb-1">
            Welcome back.
          </h1>
          <p className="text-ink-500 text-sm mb-8">
            Continue to your books.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="jane.doe@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0" htmlFor="password">Password</label>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <div className="rule-ornament my-8" />

          <div className="text-sm text-ink-500 text-center">
            New to Ledger?{' '}
            <Link
              to="/register"
              className="text-emerald_ledger-500 font-medium hover:underline underline-offset-4 decoration-1"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
