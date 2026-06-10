// ------------------------------------------------------------------
// Mirrors of the NestJS backend DTOs / entities, only what the UI uses
// ------------------------------------------------------------------

export type ApiResponse<T> = {
  message: string
  data: T
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}

export type RoleType = 'super_admin' | 'customer_admin' | 'customer_user'

export type Customer = {
  id: string
  companyName: string
  description?: string
  companyEmail: string
  companyAddress: string
  companyPhone: string
  companyWebsite?: string
  /** Backend stores as `/uploads/logo/<name>` — use `assetUrl()` to render. */
  companyLogo?: string | null
  panNumber?: string
  vatNumber?: string
  fiscalStartDate?: string
  fiscalEndDate?: string
  transactionCurrencyCode: string
  createdAt?: string
  updatedAt?: string
}

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  isActive: boolean
  isEmailVerified: boolean
  lastLoginDate?: string | null
  /** URL/path to the user's avatar/profile image (optional). */
  avatarUrl?: string | null
  userRoles: Array<{
    id: string
    roleType: RoleType
    customerId: string
    customer?: Customer
  }>
}

export type LoginResponse = {
  accessToken: string
  user: Partial<User>
}

export type RegisterPayload = {
  email: string
  firstName: string
  lastName: string
  phone?: string
  password: string
  companyName: string
  companyEmail: string
  companyAddress: string
  companyPhone: string
  companyWebsite?: string
  transactionCurrencyCode: string
  fiscalStartDate: string
  fiscalEndDate: string
  vatNumber?: string
  panNumber?: string
}

// ----------------------- Password / Profile -----------------------
export type ForgotPasswordPayload = { email: string }
export type ResetPasswordPayload   = { token: string; password: string }
export type ChangePasswordPayload  = {
  currentPassword: string
  newPassword: string
}

export type UpdateProfilePayload = {
  firstName?: string
  lastName?: string
  phone?: string
}

// ----------------------- SSO -----------------------
export type GoogleAuthUrlResponse = { authUrl: string }

export type SignUpSSOPayload = {
  authorizationCode: string
  companyName: string
  companyEmail: string
  companyAddress: string
  companyPhone: string
  companyWebsite?: string
  transactionCurrencyCode: string
  fiscalStartDate: string
  fiscalEndDate: string
  vatNumber?: string
  panNumber?: string
}

export type SignInSSOPayload = {
  authorizationCode: string
}

// ----------------------- Users (super_admin / customer_admin) -----------------------
export type InviteUserPayload = {
  email: string
  firstName: string
}

export type VerifyInviteUserPayload = {
  token: string
  firstName: string
  lastName: string
  phone?: string
  password: string
}

// ----------------------- Customers (super_admin) -----------------------
export type UpdateCustomerPayload = {
  companyName: string
  description?: string
  companyEmail: string
  companyAddress: string
  companyPhone: string
  companyWebsite?: string
  transactionCurrencyCode: string
  fiscalStartDate: string
  fiscalEndDate: string
  vatNumber?: string
  panNumber?: string
}

// ----------------------- Accounts -----------------------
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

export type Account = {
  id: string
  name: string
  code: string
  accountType: AccountType
  parentId: string | null
  parent?: Account | null
  children?: Account[]
  createdAt?: string
  updatedAt?: string
}

export type CreateAccountPayload = {
  name: string
  accountType?: AccountType
  code?: string
  parentId?: string
}

export type AccountTypeOption = {
  label: string
  value: AccountType
}

// ----------------------- Transactions -----------------------
export type TransactionLine = {
  id?: string
  accountId: string
  account?: Account
  debit: number | string
  credit: number | string
  description: string
}

export type TransactionType = {
  id: string
  name?: string
  description?: string
}

export type Transaction = {
  id: string
  reference?: string
  /** Invoice number — may come from backend as `invoiceNo` or `invoiceNumber`. */
  invoiceNo?: string
  transactionDate: string
  transactionTypeId: string
  transactionType?: TransactionType
  amount?: number | string
  lines?: TransactionLine[]
  createdAt?: string
  updatedAt?: string
}

export type CreateTransactionPayload = {
  description: string
  reference?: string
  amount: string
  transactionTypeId: string
  transactionDate: string // ISO
}

// ----------------------- Transaction Rules -----------------------
export type RuleLine = {
  ruleId?: string
  accountId: string
  account?: Account
  increase: boolean
}

export type TransactionRule = {
  id: string
  name: string
  description: string
  transactionType: string
  rules?: RuleLine[]
  createdAt?: string
}

export type CreateTransactionRulePayload = {
  name: string
  description: string
  transactionType: string
  rules: Array<{ accountId: string; increase: boolean }>
}

// ----------------------- Reports -----------------------
export type TrialBalanceRow = {
  accountId: string
  code: string
  name: string
  accountType: AccountType
  debit: number
  credit: number
  balance?: number
}

export type ReportQuery = {
  accountType?: AccountType
  transactionFrom?: string
  transactionTo?: string
  accountCode?: string
}
