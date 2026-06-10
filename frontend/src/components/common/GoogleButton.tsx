import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authApi } from '@/api/auth'
import { extractApiError } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'

type Props = {
  /** Whether this button kicks off sign-in or sign-up — controls API + label. */
  mode: Mode
  className?: string
}

/** localStorage key used by /google-sso to know how to handle the redirect. */
export const SSO_INTENT_KEY = 'ledger.sso.intent'

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.12A6.6 6.6 0 0 1 5.49 12c0-.74.13-1.45.35-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.96l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
)

/**
 * Single "Continue with Google" button used by both the login and the
 * register pages. Stashes the intent in localStorage so the post-OAuth
 * redirect page (`/google-sso`) can branch correctly.
 */
export function GoogleButton({ mode, className }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    setLoading(true)
    try {
      const fetcher = mode === 'signup'
        ? authApi.googleRegisterUrl
        : authApi.googleLoginUrl
      const raw = await fetcher()
      const authUrl =
        (raw as any)?.authUrl ?? (raw as any)?.data?.authUrl
      if (!authUrl) throw new Error('No auth URL returned')

      localStorage.setItem(SSO_INTENT_KEY, mode)
      window.location.href = authUrl
    } catch (err) {
      toast(extractApiError(err), 'error')
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn('w-full', className)}
      disabled={loading}
      onClick={onClick}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting…
        </>
      ) : (
        <>
          <GoogleLogo />
          {mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
        </>
      )}
    </Button>
  )
}
