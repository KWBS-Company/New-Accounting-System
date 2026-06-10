import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import {
  COUNTRIES,
  combinePhone,
  countryByIso2,
  flagEmoji,
  parseStoredPhone,
  type Country,
} from '@/lib/countries'
import { cn } from '@/lib/utils'

type Props = {
  id?: string
  /** Stored phone in E.164 form: '+97798234550'. Empty string when blank. */
  value: string
  /** Called with the combined E.164 string ('' when local part is empty). */
  onChange: (value: string) => void
  /** Optional initial country (ISO-2) when `value` is empty. Defaults to NP. */
  defaultCountryIso2?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Phone input with a country-code + flag picker on the left and a plain
 * number input on the right. Emits a single E.164-style string upward,
 * e.g. '+97798234550'. The picker is a custom popover (rather than a
 * Radix Select) so the search box can receive focus.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  defaultCountryIso2,
  placeholder = 'Phone number',
  required,
  disabled,
  className,
}: Props) {
  // Derive the current country + local part from the stored value.
  const parsed = useMemo(() => {
    if (value) return parseStoredPhone(value)
    const c = defaultCountryIso2 ? countryByIso2(defaultCountryIso2) : undefined
    return { country: c ?? parseStoredPhone('').country, local: '' }
  }, [value, defaultCountryIso2])

  const [country, setCountry] = useState<Country>(parsed.country)
  const [local, setLocal] = useState<string>(parsed.local)

  // Keep internal state in sync when `value` changes from outside.
  useEffect(() => {
    if (value) {
      const p = parseStoredPhone(value)
      setCountry(p.country)
      setLocal(p.local)
    } else {
      setLocal('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const emit = (c: Country, l: string) => {
    onChange(combinePhone(c, l))
  }

  const setCountryAndEmit = (c: Country) => {
    setCountry(c)
    emit(c, local)
  }

  const onLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/[^\d]/g, '')
    setLocal(stripped)
    emit(country, stripped)
  }

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <CountryPicker
        value={country}
        onChange={setCountryAndEmit}
        disabled={disabled}
      />
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        disabled={disabled}
        value={local}
        onChange={onLocalChange}
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
    </div>
  )
}

// ---------- Country picker (popover with search) ----------
function CountryPicker({
  value,
  onChange,
  disabled,
}: {
  value: Country
  onChange: (c: Country) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const popRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.dialCode.includes(q.replace(/[^\d]/g, '')),
    )
  }, [query])

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm',
          'ring-offset-background hover:bg-muted/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{flagEmoji(value.iso2)}</span>
        <span className="font-mono tabular-nums">+{value.dialCode}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-50 mt-1 left-0 w-72 max-w-[80vw] rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
          role="listbox"
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                placeholder="Search country or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No matches.
              </li>
            ) : (
              filtered.map((c) => {
                const isActive = c.iso2 === value.iso2
                return (
                  <li key={`${c.iso2}-${c.dialCode}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(c)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60',
                        isActive && 'bg-muted/40',
                      )}
                    >
                      <span className="text-base leading-none">
                        {flagEmoji(c.iso2)}
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        +{c.dialCode}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
