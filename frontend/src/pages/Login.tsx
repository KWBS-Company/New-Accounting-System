import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/common/PasswordInput'

export default function Login() {
  const { login } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname ?? '/'

  // ---- Form state (unchanged logic) ----
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
    <div className="min-h-screen flex bg-background">
      {/* Left editorial panel — hidden on small screens */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary text-primary-foreground p-14 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 28px, currentColor 28px, currentColor 29px)',
          }}
        />
        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-70 mb-2">
            Vol. 01 · No. 1
          </div>
          <div className="font-display text-5xl leading-none tracking-tightest font-light">
            {site.name}.
          </div>
        </div>
        <div className="relative">
          <div className="h-px bg-current opacity-30 mb-8" />
          <blockquote className="font-display text-3xl leading-tight font-light max-w-md">
            “Every credit finds its debit;
            <br />
            <span className="italic">balance is not an opinion.”</span>
          </blockquote>
          <div className="font-mono text-xs uppercase tracking-[0.2em] opacity-70 mt-6">
            {site.quote.attribution}
          </div>
        </div>
        <div className="relative text-xs font-mono opacity-50">
          {site.tagline}
        </div>
      </div>

      {/* Right form column */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 lg:py-16">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand mark */}
          <div className="lg:hidden mb-10 text-center sm:text-left">
            <div className="font-display text-4xl tracking-tightest font-light text-foreground">
              {site.name}.
            </div>
          </div>

          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-2">
            Sign in
          </div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tightest font-light text-foreground mb-1">
            Welcome back.
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            Continue to your books.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  Forgot your password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Signing in…' : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="rule-ornament my-8" />

          <div className="text-sm text-muted-foreground text-center">
            New to {site.name}?{' '}
            <Link
              to="/register"
              className="text-primary font-medium hover:underline underline-offset-4 decoration-1"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
