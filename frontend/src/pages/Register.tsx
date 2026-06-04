import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { PasswordInput } from '@/components/common/PasswordInput'
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '@/lib/validators'

export default function Register() {
  const { toast } = useToast()
  const nav = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)

  // ---- Original state shape preserved verbatim ----
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    companyName: '',
    companyEmail: '',
    companyAddress: '',
    companyPhone: '',
    companyWebsite: '',
  })

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await authApi.register({
        ...form,
        phone: form.phone || undefined,
        companyWebsite: form.companyWebsite || undefined,
      })
      toast('Account created. Check your email to verify.', 'success')
      nav('/login')
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const canAdvance =
    form.firstName &&
    form.lastName &&
    form.email &&
    form.password.length >= PASSWORD_MIN_LENGTH

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 bg-background">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-block mb-8 sm:mb-10">
          <div className="font-display text-3xl tracking-tightest font-light text-foreground">
            {site.name}.
          </div>
        </Link>

        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-2">
          Step {step} of 2 · {step === 1 ? 'You' : 'Your company'}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-none tracking-tightest font-light text-foreground mb-1">
          {step === 1 ? 'Open the books.' : 'Tell us about the business.'}
        </h1>
        <p className="text-muted-foreground mb-8">
          {step === 1
            ? 'We start with you — the bookkeeper.'
            : 'Every transaction is filed under a company.'}
        </p>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-5">
              {step === 1 ? (
                <>
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={set('email')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+977 9800000000"
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
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      disabled={!canAdvance}
                      onClick={() => setStep(2)}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
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
                      <Input
                        id="companyPhone"
                        required
                        value={form.companyPhone}
                        onChange={set('companyPhone')}
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
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Creating…' : 'Create account'}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-primary font-medium hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
