import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'

export default function Register() {
  const { toast } = useToast()
  const nav = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [submitting, setSubmitting] = useState(false)

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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
    form.firstName && form.lastName && form.email && form.password.length >= 8

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-block mb-10">
          <div className="font-display text-3xl tracking-tightest font-light text-ink-900">
            Ledger.
          </div>
        </Link>

        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald_ledger-500 mb-2">
          Step {step} of 2 · {step === 1 ? 'You' : 'Your company'}
        </div>
        <h1 className="font-display text-5xl leading-none tracking-tightest font-light text-ink-900 mb-1">
          {step === 1 ? 'Open the books.' : 'Tell us about the business.'}
        </h1>
        <p className="text-ink-500 mb-8">
          {step === 1
            ? 'We start with you — the bookkeeper.'
            : 'Every transaction is filed under a company.'}
        </p>

        <form onSubmit={onSubmit} className="card p-8 space-y-5">
          {step === 1 ? (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">First name</label>
                  <input
                    className="field"
                    required
                    value={form.firstName}
                    onChange={set('firstName')}
                  />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input
                    className="field"
                    required
                    value={form.lastName}
                    onChange={set('lastName')}
                  />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="field"
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input
                  className="field"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="field font-mono"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={set('password')}
                />
                <p className="text-xs text-ink-500 mt-1.5 font-mono">
                  ≥ 8 chars · upper · lower · number · special
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!canAdvance}
                  onClick={() => setStep(2)}
                  className="btn-primary"
                >
                  Continue →
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Company name</label>
                <input
                  className="field"
                  required
                  value={form.companyName}
                  onChange={set('companyName')}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Company email</label>
                  <input
                    className="field"
                    type="email"
                    required
                    value={form.companyEmail}
                    onChange={set('companyEmail')}
                  />
                </div>
                <div>
                  <label className="label">Company phone</label>
                  <input
                    className="field"
                    required
                    value={form.companyPhone}
                    onChange={set('companyPhone')}
                  />
                </div>
              </div>
              <div>
                <label className="label">Company address</label>
                <input
                  className="field"
                  required
                  value={form.companyAddress}
                  onChange={set('companyAddress')}
                />
              </div>
              <div>
                <label className="label">Website (optional)</label>
                <input
                  className="field"
                  value={form.companyWebsite}
                  onChange={set('companyWebsite')}
                  placeholder="https://"
                />
              </div>
              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-ghost"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-sm text-ink-500 text-center mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-emerald_ledger-500 font-medium hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
