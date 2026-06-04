import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Forgot-password — step 1 of password reset.
 * Calls authApi.forgotPassword({ email }); backend emails the user a link
 * that includes a token, which lands them on /reset-password?token=...
 */
export default function ForgotPassword() {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await authApi.forgotPassword({ email })
      setSent(true)
      toast('Reset link sent if the email is registered', 'success')
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
              Password reset · Step 1
            </div>
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              Enter the email tied to your account and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-md bg-accent text-accent-foreground">
                  <Mail className="h-5 w-5 shrink-0" />
                  <div className="text-sm">
                    Check <strong>{email}</strong> — if the address is on file,
                    a reset link is on its way.
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                </Button>
              </div>
            ) : (
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
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Sending…' : 'Send reset link'}
                </Button>
                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
