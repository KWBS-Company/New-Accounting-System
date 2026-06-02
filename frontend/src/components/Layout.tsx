import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const NAV = [
  { to: '/', label: 'Ledger', icon: '◆' },
  { to: '/accounts', label: 'Accounts', icon: '₪' },
  { to: '/transactions', label: 'Journal', icon: '✎' },
  { to: '/transaction-rules', label: 'Rules', icon: '§' },
  { to: '/reports', label: 'Reports', icon: '⏚' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  const handleLogout = () => {
    logout()
    nav('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — narrow, fixed, editorial */}
      <aside className="w-60 shrink-0 border-r border-sand bg-parchment-100/60 backdrop-blur-sm">
        <div className="sticky top-0 p-6 flex flex-col h-screen">
          {/* Wordmark */}
          <Link to="/" className="block mb-10">
            <div className="font-display text-3xl leading-none tracking-tightest font-light text-ink-900">
              Ledger
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald_ledger-500 mt-1">
              Double-entry · Est. 2026
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex-1 flex flex-col gap-0.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'text-ink-900 bg-parchment-50 border-l-2 border-emerald_ledger-500 -ml-px'
                      : 'text-ink-500 hover:text-ink-900 hover:bg-parchment-50/50 border-l-2 border-transparent -ml-px',
                  ].join(' ')
                }
              >
                <span className="font-mono text-emerald_ledger-500 text-base w-4">
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Account footer */}
          <div className="pt-4 mt-4 border-t border-sand">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-emerald_ledger-500 text-parchment-50 flex items-center justify-center font-display text-sm">
                {(user?.firstName?.[0] ?? '?') + (user?.lastName?.[0] ?? '')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900 truncate">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-[11px] text-ink-500 truncate">
                  {user?.email}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left text-xs font-mono uppercase tracking-wider text-ink-500 hover:text-claret-500 transition-colors"
            >
              ↳ Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
