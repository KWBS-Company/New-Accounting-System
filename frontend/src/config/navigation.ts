// -----------------------------------------------------------------------------
// Sidebar / top-nav items. Add new pages to NAV_ITEMS and they appear in the
// sidebar automatically. Icons are lucide-react components.
// -----------------------------------------------------------------------------
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  Scale,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  // exact match required (for index routes)
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/',                  label: 'Ledger',       icon: LayoutDashboard, end: true },
  { to: '/accounts',          label: 'Accounts',     icon: Wallet },
  { to: '/transactions',      label: 'Journal',      icon: BookOpen },
  { to: '/transaction-rules', label: 'Rules',        icon: Scale },
  { to: '/reports',           label: 'Reports',      icon: BarChart3 },
]
