import { useEffect, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  maxWidth?: string
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative bg-parchment-50 border border-sand shadow-card w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="px-6 py-5 border-b border-sand">
            {title && (
              <h2 className="font-display text-2xl tracking-tightest text-ink-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-ink-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-parchment-200 transition-colors"
        >
          ✕
        </button>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
