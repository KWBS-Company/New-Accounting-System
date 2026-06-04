import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  /** Max width modifier — pass a Tailwind class like 'max-w-xl'. */
  maxWidth?: string
}

/**
 * Backwards-compatible Modal — keeps the same `<Modal open onClose>` API the
 * old pages use, but renders shadcn's Dialog underneath (Radix + animations
 * + accessibility + responsive mobile sheet behavior).
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('sm:max-w-lg', maxWidth)}>
        {(title || subtitle) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}
