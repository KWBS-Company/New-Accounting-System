import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: Props) {
  return (
    <header className="px-10 pt-10 pb-6 border-b border-sand">
      <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
        <div>
          {eyebrow && (
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald_ledger-500 mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display font-light text-5xl leading-none tracking-tightest text-ink-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-ink-500 max-w-xl">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
