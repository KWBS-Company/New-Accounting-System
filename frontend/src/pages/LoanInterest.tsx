import { useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { extractApiError } from '@/api/client'
import { site } from '@/config/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { NepaliDatePicker } from '@/components/common/NepaliDatePicker'
import { loanInterestCalculatorApi } from '@/api/loanInterestCalculator'

const CURRENCY_SYMBOL = 'Rs.'

interface InterestResult {
  sumInterest: number
  compoundedAmount: number
}

export default function LoanInterestCalculator() {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<InterestResult | null>(null)

  const [form, setForm] = useState({
    loanTakenDate: '',
    amount: '',
    interestRateInPercentage: '',
    compoundingDays: '',
  })

  const [errors, setErrors] = useState({
    compoundingDays: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [k]: value }))

    if (k === 'compoundingDays') {
      setErrors((prev) => ({ ...prev, compoundingDays: validateCompoundingDays(value) }))
    }
  }

  const validateCompoundingDays = (value: string): string => {
    if (!value) return ''
    if (value.includes('.')) return 'Must be a whole number — no decimals.'
    const n = Number(value)
    if (!Number.isInteger(n) || n <= 0) return 'Must be a positive whole number (e.g. 30, 90, 365).'
    return ''
  }

  const fmt = (n: number) =>
    `${CURRENCY_SYMBOL} ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  const canSubmit =
    form.loanTakenDate &&
    form.amount &&
    form.interestRateInPercentage &&
    form.compoundingDays &&
    !errors.compoundingDays

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const compDayErr = validateCompoundingDays(form.compoundingDays)
    if (compDayErr) {
      setErrors((prev) => ({ ...prev, compoundingDays: compDayErr }))
      return
    }

    const amount = parseFloat(form.amount)
    const interestRate = parseFloat(form.interestRateInPercentage)
    const compoundingDays = parseInt(form.compoundingDays, 10)

    if (isNaN(amount) || amount <= 0) {
      toast('Enter a valid loan amount.', 'error')
      return
    }
    if (isNaN(interestRate) || interestRate <= 0 || interestRate > 100) {
      toast('Interest rate must be between 0.01% and 100%.', 'error')
      return
    }

    setSubmitting(true)
    setResult(null)
    try {
      const res = await loanInterestCalculatorApi.loanInterestCalculator({
        loanTakenDate: form.loanTakenDate,
        amount,
        interestRateInPercentage: interestRate,
        compoundingDays,
      })
      setResult(res.data)
    } catch (err) {
      toast(extractApiError(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6 bg-background">
      <div className="max-w-xl mx-auto">
        <div className="font-display text-3xl tracking-tightest font-light text-foreground mb-8 sm:mb-10">
          {site.name}.
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-2">
          Loan calculator
        </div>
        <h1 className="font-display text-3xl sm:text-4xl leading-none tracking-tightest font-light text-foreground mb-1">
          Interest estimator.
        </h1>
        <p className="text-muted-foreground mb-8">
          Enter your loan details to compute compounded interest.
        </p>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-5">
              {/* Loan date */}
              <div className="space-y-1.5">
                <Label htmlFor="loanTakenDate">Loan taken date</Label>
                <NepaliDatePicker
                  id="loanTakenDate"
                  required
                  value={form.loanTakenDate}
                  onChange={(v) => setForm((f) => ({ ...f, loanTakenDate: v }))}
                />
              </div>

              {/* Amount + Interest rate */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Loan amount</Label>
                  <div className="flex items-center border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <span className="px-3 text-sm text-muted-foreground bg-muted h-9 flex items-center border-r border-input shrink-0">
                      {CURRENCY_SYMBOL}
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      min="1"
                      step="any"
                      required
                      placeholder="50000"
                      value={form.amount}
                      onChange={set('amount')}
                      className="border-0 focus-visible:ring-0 rounded-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="interestRateInPercentage">Interest rate</Label>
                  <div className="flex items-center border border-input rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                    <Input
                      id="interestRateInPercentage"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      required
                      placeholder="20"
                      value={form.interestRateInPercentage}
                      onChange={set('interestRateInPercentage')}
                      className="border-0 focus-visible:ring-0 rounded-none"
                    />
                    <span className="px-3 text-sm text-muted-foreground bg-muted h-9 flex items-center border-l border-input shrink-0">
                      % p.a.
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">Annual percentage rate</p>
                </div>
              </div>

              {/* Compounding days */}
              <div className="space-y-1.5">
                <Label htmlFor="compoundingDays">Compounding days</Label>
                <Input
                  id="compoundingDays"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="90"
                  value={form.compoundingDays}
                  onChange={set('compoundingDays')}
                  onKeyDown={(e) => {
                    if (e.key === '.' || e.key === '-' || e.key === 'e') e.preventDefault()
                  }}
                />
                {errors.compoundingDays ? (
                  <p className="text-xs text-destructive">{errors.compoundingDays}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Whole number only — e.g. 30, 90, 365. No decimals or negatives.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={!canSubmit || submitting}>
                  {submitting ? 'Calculating…' : 'Calculate interest'}
                </Button>
              </div>
            </form>

            {/* Results */}
            {result && (
              <div className="mt-6 pt-6 border-t border-border space-y-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Result
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total interest</p>
                    <p className="text-xl font-medium text-foreground">{fmt(result.sumInterest)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Compounded amount</p>
                    <p className="text-xl font-medium text-foreground">{fmt(result.compoundedAmount)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Loan: {fmt(parseFloat(form.amount))} · Rate: {form.interestRateInPercentage}% p.a. · Compounding: every {form.compoundingDays} day(s)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
