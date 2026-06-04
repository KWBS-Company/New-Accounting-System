import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

/**
 * Page-level header used at the top of every authenticated route.
 * Mobile-first: actions wrap below title on small screens, sit beside it on md+.
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: Props) {
  return (
    <header className="px-4 sm:px-6 lg:px-10 pt-6 sm:pt-10 pb-6 border-b border-border">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
        <div className="min-w-0">
          {eyebrow && (
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display font-light text-3xl sm:text-4xl lg:text-5xl leading-none tracking-tightest text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        )}
      </div>
    </header>
  )
}
