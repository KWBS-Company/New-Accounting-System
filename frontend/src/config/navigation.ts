// -----------------------------------------------------------------------------
// Sidebar / top-nav items. Items are filtered per role. Add to the relevant
// list and they appear in the sidebar automatically. Icons are lucide-react
// components.
// -----------------------------------------------------------------------------
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  Scale,
  BarChart3,
  Users as UsersIcon,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import type { RoleType } from '@/types'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Roles that should see this item. Omit/empty = visible to everyone. */
  roles?: RoleType[]
  /** exact match required (for index routes) */
  end?: boolean
}

/**
 * Master list. Items without `roles` are visible to all authenticated users.
 * Items with `roles` only show if the user's primary role matches.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/',                  label: 'Ledger',    icon: LayoutDashboard, end: true },
  { to: '/accounts',          label: 'Accounts',  icon: Wallet },
  { to: '/transactions',      label: 'Journal',   icon: BookOpen },
  { to: '/transaction-rules', label: 'Rules',     icon: Scale },
  { to: '/reports',           label: 'Reports',   icon: BarChart3 },
  { to: '/users',             label: 'Users',     icon: UsersIcon,
    roles: ['super_admin', 'customer_admin'] },
  { to: '/customers',         label: 'Customers', icon: Building2,
    roles: ['super_admin'] },
]

export function navItemsForRole(role?: RoleType): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  )
}
