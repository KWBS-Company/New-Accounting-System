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
  CalculatorIcon,
  SpeakerIcon,
  SpeechIcon,
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
 *
 * Note: super_admin only sees Users and Customers — all accounting pages
 * are hidden for them (they manage the platform, not the books).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true,
    roles: ['customer_admin', 'customer_user']
  },
  {
    to: '/accounts', label: 'Chart of Accounts', icon: Wallet,
    roles: ['customer_admin', 'customer_user']
  },
  {
    to: '/transactions', label: 'Journal Transaction', icon: BookOpen,
    roles: ['customer_admin', 'customer_user']
  },
  {
    to: '/transaction-rules', label: 'Accounting Journal Rule', icon: Scale,
    roles: ['customer_admin', 'customer_user']
  },
  {
    to: '/reports', label: 'Account Reports', icon: BarChart3,
    roles: ['customer_admin', 'customer_user']
  },
  {
    to: '/users', label: 'Users', icon: UsersIcon,
    roles: ['super_admin', 'customer_admin']
  },
  {
    to: '/customers', label: 'Customers', icon: Building2,
    roles: ['super_admin']
  },
  {
    to: '/loan-interest-calculator', label: 'Loan interest calculator', icon: CalculatorIcon,
    roles: ['customer_admin']
  },
  {
    to: '/chat', label: 'Chat', icon: SpeechIcon,
    roles: ['customer_admin']
  },
]

export function navItemsForRole(role?: RoleType): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  )
}
