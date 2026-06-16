import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import {
  adLabel,
  adToBs,
  bsLabel,
  BS_MAX_YEAR,
  BS_MIN_YEAR,
  BS_MONTH_NAMES_EN,
  BS_MONTH_NAMES_NE,
  bsMonthLength,
  bsMonthStartWeekday,
  bsToAd,
  clampBsYear,
  isoDate,
  parseIsoDate,
  type BSDate,
} from '@/lib/nepali-date'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Dual-calendar (Bikram Sambat + AD) date picker.
 *
 * The component is controlled. The `value` and `onChange` are ALWAYS expressed
 * in AD (YYYY-MM-DD) — so the payload sent to the backend stays unchanged. The
 * popover surfaces both calendars side-by-side, with the BS grid being the
 * primary navigation; selecting a BS day computes the AD date and emits it
 * through `onChange`.
 *
 * Drop-in replacement for `<Input type="date" />` in our existing forms.
 */
export type NepaliDatePickerProps = {
  id?: string
  value: string                       // AD YYYY-MM-DD
  onChange: (next: string) => void    // AD YYYY-MM-DD
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
  /** Optional name attribute for form serialization. */
  name?: string
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_NE = ['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श']

export function NepaliDatePicker({
  id,
  value,
  onChange,
  required,
  disabled,
  className,
  placeholder,
  name,
}: NepaliDatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Derive BS from the AD value.
  const adDate = useMemo(() => parseIsoDate(value), [value])
  const bs = useMemo<BSDate | null>(
    () => (adDate ? adToBs(adDate) : null),
    [adDate],
  )

  // The "viewed" BS month — what's shown in the grid. Defaults to selected
  // date's BS month, or current date's BS month if nothing selected.
  const todayBs = useMemo(() => adToBs(new Date()), [])
  const [viewYear, setViewYear] = useState(bs?.year ?? todayBs.year)
  const [viewMonth, setViewMonth] = useState(bs?.month ?? todayBs.month)

  // Keep view in sync when external value changes meaningfully.
  useEffect(() => {
    if (bs) {
      setViewYear(bs.year)
      setViewMonth(bs.month)
    }
  }, [bs?.year, bs?.month])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Build the BS grid for the viewed month.
  const grid = useMemo(() => {
    const len = bsMonthLength(viewYear, viewMonth)
    const startDow = bsMonthStartWeekday(viewYear, viewMonth)
    const cells: (BSDate | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= len; d++) {
      cells.push({ year: viewYear, month: viewMonth, day: d })
    }
    // Pad to multiple of 7
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  const goPrev = () => {
    let m = viewMonth - 1
    let y = viewYear
    if (m < 1) { m = 12; y -= 1 }
    setViewMonth(m)
    setViewYear(clampBsYear(y))
  }

  const goNext = () => {
    let m = viewMonth + 1
    let y = viewYear
    if (m > 12) { m = 1; y += 1 }
    setViewMonth(m)
    setViewYear(clampBsYear(y))
  }

  const pickBs = (b: BSDate) => {
    const ad = bsToAd(b)
    onChange(isoDate(ad))
    setOpen(false)
  }

  const goToday = () => {
    const today = new Date()
    onChange(isoDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))))
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setOpen(false)
  }

  // Trigger label: show both BS and AD when present.
  const triggerLabel = useMemo(() => {
    if (!adDate || !bs) return placeholder ?? 'Pick a date…'
    return `${bsLabel(bs, 'en')} · ${adLabel(adDate)}`
  }, [adDate, bs, placeholder])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Hidden native field — keeps form `required` behaviour working. */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value ?? ''}
          required={required}
        />
      )}

      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !adDate && 'text-muted-foreground',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{triggerLabel}</span>
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-2 w-[20rem] rounded-md border border-border bg-popover p-3 shadow-xl"
          role="dialog"
        >
          {/* Header: month nav + year select */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={viewYear <= BS_MIN_YEAR && viewMonth <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-1 items-center gap-2 justify-center">
              <select
                className="rounded-md border border-input bg-background px-1.5 py-1 text-xs font-medium"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
              >
                {BS_MONTH_NAMES_EN.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m} / {BS_MONTH_NAMES_NE[i]}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-input bg-background px-1.5 py-1 text-xs font-medium"
                value={viewYear}
                onChange={(e) => setViewYear(clampBsYear(Number(e.target.value)))}
              >
                {Array.from(
                  { length: BS_MAX_YEAR - BS_MIN_YEAR + 1 },
                  (_, i) => BS_MIN_YEAR + i,
                ).map((y) => (
                  <option key={y} value={y}>
                    {y} BS
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={viewYear >= BS_MAX_YEAR && viewMonth >= 12}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* AD month spanning hint */}
          <div className="text-[10px] text-muted-foreground font-mono mb-2 text-center">
            BS {BS_MONTH_NAMES_NE[viewMonth - 1]} {viewYear} ≈{' '}
            {adLabel(bsToAd({ year: viewYear, month: viewMonth, day: 1 }))} →{' '}
            {adLabel(
              bsToAd({
                year: viewYear,
                month: viewMonth,
                day: bsMonthLength(viewYear, viewMonth),
              }),
            )}
          </div>

          {/* Day-of-week strip */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS_EN.map((w, i) => (
              <div
                key={w}
                className="text-[10px] text-center text-muted-foreground font-mono"
              >
                {w}
                <span className="block text-[9px] opacity-70">
                  {WEEKDAYS_NE[i]}
                </span>
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((cell, idx) => {
              if (!cell) return <div key={idx} className="h-9" />
              const isSelected =
                bs &&
                bs.year === cell.year &&
                bs.month === cell.month &&
                bs.day === cell.day
              const isToday =
                todayBs.year === cell.year &&
                todayBs.month === cell.month &&
                todayBs.day === cell.day
              const ad = bsToAd(cell)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => pickBs(cell)}
                  title={`BS ${cell.day} ${BS_MONTH_NAMES_EN[cell.month - 1]} ${cell.year} · ${adLabel(ad)}`}
                  className={cn(
                    'h-9 rounded-md text-center flex flex-col items-center justify-center transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                    !isSelected && isToday && 'ring-1 ring-primary',
                  )}
                >
                  <span className="text-xs font-medium leading-none">
                    {cell.day}
                  </span>
                  <span className="text-[9px] opacity-60 font-mono leading-none mt-0.5">
                    {ad.getUTCDate()}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={goToday}>
              Today
            </Button>
            <div className="text-[10px] text-muted-foreground font-mono">
              {adDate ? `AD: ${isoDate(adDate)}` : 'Choose a date'}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
