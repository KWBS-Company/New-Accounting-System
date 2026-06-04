import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Password field with show/hide eye toggle.
 *
 * Drop-in replacement for <Input type="password" />. Same props.
 * Used by Login, Register, ForgotPassword reset step, and Profile change-password.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false)
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? 'text' : 'password'}
          // leave room for the toggle button on the right
          className={cn('pr-10 font-mono', className)}
          {...props}
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'h-7 w-7 inline-flex items-center justify-center rounded-md',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
