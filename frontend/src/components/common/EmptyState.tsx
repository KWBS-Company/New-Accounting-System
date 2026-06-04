import type { ReactNode } from 'react'
import { CircleDashed } from 'lucide-react'

type Props = {
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="px-6 py-16 sm:py-20 text-center">
      <CircleDashed className="mx-auto h-8 w-8 text-primary mb-3" strokeWidth={1.5} />
      <h3 className="font-display text-xl sm:text-2xl tracking-tightest text-foreground mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
