import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="px-6 py-20 text-center">
      <div className="font-mono text-emerald_ledger-500 text-2xl mb-3">∅</div>
      <h3 className="font-display text-2xl tracking-tightest text-ink-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-ink-500 max-w-sm mx-auto mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
