// -----------------------------------------------------------------------------
// Shared input validators. Change rules here — pages & forms read from this.
// -----------------------------------------------------------------------------

/**
 * Uppercase letters and underscores only, e.g.  AASSHISH_MONTHLY, SALE_INVOICE.
 * - must start with a letter
 * - underscores are allowed between segments
 * - no digits, no lowercase, no whitespace, no special chars
 */
export const UPPERCASE_UNDERSCORE_REGEX = /^[A-Z]+(?:_[A-Z]+)*$/

export function isValidTransactionType(value: string): boolean {
  return UPPERCASE_UNDERSCORE_REGEX.test(value)
}

/** Strip anything that's not A–Z or `_`, then collapse multiple underscores. */
export function sanitizeTransactionType(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z_]/g, '')
    .replace(/_+/g, '_')
}

// -----------------------------------------------------------------------------
// Password rules — mirrors backend expectations: 8+ chars, upper, lower,
// number, special. UI hint text comes from PASSWORD_HINT below.
// -----------------------------------------------------------------------------
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_HINT       = '≥ 8 chars · upper · lower · number · special'

export function passwordIssues(p: string): string[] {
  const issues: string[] = []
  if (p.length < PASSWORD_MIN_LENGTH) issues.push(`At least ${PASSWORD_MIN_LENGTH} characters`)
  if (!/[A-Z]/.test(p))               issues.push('One uppercase letter')
  if (!/[a-z]/.test(p))               issues.push('One lowercase letter')
  if (!/\d/.test(p))                  issues.push('One digit')
  if (!/[^A-Za-z0-9]/.test(p))        issues.push('One special character')
  return issues
}
