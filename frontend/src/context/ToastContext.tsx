import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; type: ToastType; message: string }

type ToastCtx = {
  toast: (message: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto px-4 py-3 shadow-card border text-sm',
              'animate-[fadeIn_0.18s_ease-out]',
              t.type === 'success' &&
                'bg-emerald_ledger-500 text-parchment-50 border-emerald_ledger-600',
              t.type === 'error' &&
                'bg-claret-500 text-parchment-50 border-claret-600',
              t.type === 'info' &&
                'bg-ink-900 text-parchment-50 border-ink-800',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex items-start gap-2">
              <span className="font-mono text-[10px] mt-0.5 uppercase tracking-wider opacity-70">
                {t.type}
              </span>
              <span className="flex-1">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
