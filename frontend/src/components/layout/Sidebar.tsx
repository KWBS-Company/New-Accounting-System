import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { NAV_ITEMS } from '@/config/navigation'
import { site } from '@/config/site'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  /** Called whenever a nav item is clicked — used to close mobile drawer. */
  onNavigate?: () => void
}

/**
 * Sidebar — used as a fixed left column on desktop, and inside a slide-out
 * drawer on mobile (see Layout.tsx). Has no responsive concerns of its own;
 * its parent controls visibility.
 */
export default function Sidebar({ onNavigate }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    onNavigate?.()
    navigate('/login')
  }

  const initials =
    (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || '?'

  return (
    <div className="flex flex-col h-full p-6 bg-card border-r border-border">
      {/* Wordmark */}
      <Link to="/" onClick={onNavigate} className="block mb-10">
        <div className="font-display text-3xl leading-none tracking-tightest font-light text-foreground">
          {site.name}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary mt-1">
          {site.tagline}
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-md',
                  'border-l-2 -ml-px',
                  isActive
                    ? 'text-foreground bg-background border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50 border-transparent',
                )
              }
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Account footer */}
      <div className="pt-4 mt-4 border-t border-border">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 mb-3 group"
        >
          <Avatar className="w-9 h-9">
            <AvatarImage src={(user as any)?.avatarUrl} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate group-hover:underline underline-offset-2 decoration-1">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {user?.email}
            </div>
          </div>
        </Link>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="justify-start text-xs uppercase tracking-wider font-mono"
          >
            <Link to="/profile" onClick={onNavigate}>
              <UserIcon className="h-3.5 w-3.5" />
              Profile
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="justify-start text-xs uppercase tracking-wider font-mono hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
