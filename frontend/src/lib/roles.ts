import type { RoleType, User } from '@/types'

/** Returns the primary (first) role of a user, or undefined when not loaded. */
export function primaryRole(user?: User | null): RoleType | undefined {
  return user?.userRoles?.[0]?.roleType
}

/** Returns the customerId attached to the user's primary role. */
export function primaryCustomerId(user?: User | null): string | undefined {
  return user?.userRoles?.[0]?.customerId
}

export const isSuperAdmin    = (u?: User | null) => primaryRole(u) === 'super_admin'
export const isCustomerAdmin = (u?: User | null) => primaryRole(u) === 'customer_admin'
export const isCustomerUser  = (u?: User | null) => primaryRole(u) === 'customer_user'

/** Human-readable role labels for the UI. */
export function roleLabel(r?: RoleType): string {
  switch (r) {
    case 'super_admin':    return 'Super admin'
    case 'customer_admin': return 'Customer admin'
    case 'customer_user':  return 'Customer user'
    default:               return '—'
  }
}
