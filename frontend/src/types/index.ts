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

export type FiscalYearStatus = 'open' | 'closed'

export type CustomerFiscalYear = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: FiscalYearStatus
  customerId?: string
  createdAt?: string
  updatedAt?: string
}

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
  fiscalYears?: CustomerFiscalYear[]
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
  /**
   * Present hash if the user has set a password, empty/null otherwise (e.g.
   * SSO-only accounts). The frontend uses this to decide whether the
   * "current password" field is required when changing the password.
   */
  password?: string | null
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
  vatNumber?: string
  panNumber?: string
}

// ----------------------- Password / Profile -----------------------
export type ForgotPasswordPayload = { email: string }
export type ResetPasswordPayload = { token: string; password: string }
export type ChangePasswordPayload = {
  currentPassword?: string
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
  // fiscalStartDate: string
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
  lines?: AccountTransactionLine[]
  createdAt?: string
  updatedAt?: string
}

export type AccountTransactionLine = {
  id: string
  accountId: string
  debit: number | string
  credit: number | string
  description?: string
  transaction?: {
    id: string
    reference?: string
    transactionDate: string
    amount?: number | string
  }
  createdAt?: string
}

export type CreateAccountPayload = {
  name: string
  accountType?: AccountType
  code?: string
  parentId?: string
}

/** POST /accounts — backend returns id + message, not the full account row. */
export type CreateAccountResponse = {
  id: string
  message?: string
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
  transactionTypeId?: string
  transactionType?: TransactionType
  amount?: number | string
  lines?: TransactionLine[]
  createdAt?: string
  updatedAt?: string
}

/** Preview API request — body for POST /transactions/preview-lines */
export type PreviewLinesPayload = {
  amount: string
  description: string
  transactionTypeId: string
}

/** Line shape for CREATE — no lineId. */
export type CreateLinePayload = {
  accountId: string
  debit: number
  credit: number
  description: string
}

/** Line shape for UPDATE — includes lineId. */
export type UpdateLinePayload = {
  lineId: string
  accountId: string
  debit: number
  credit: number
  description: string
}

export type CreateTransactionPayload = {
  reference?: string
  amount: number
  transactionDate: string // ISO
  lines: CreateLinePayload[]
}

export type UpdateTransactionPayload = {
  reference?: string
  amount: number
  transactionDate: string // ISO
  lines: UpdateLinePayload[]
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
  id: string
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
  fiscalYearId?: string
}


export type LoanInterestCalculatorPayload = {
  loanTakenDate: string;
  amount: number;
  interestRateInPercentage: number;
  compoundingDays: number;
}

// ----------------------- Ledger -----------------------
export type LedgerQuery = {
  fiscalYearId?: string
  transactionFrom?: string
  transactionTo?: string
}

export type LedgerLine = {
  transactionDate: string
  fiscalYear: string
  fiscalYearId: string
  startDate: string
  endDate: string
  debit: number
  credit: number
  balance: number
  serialNumber: number
  description: string
}

export type LedgerSummary = {
  openingBalance: number
  totalBalance: number
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

export type LedgerResponse = {
  ledger: {
    id: string
    name: string
    accountType: AccountType
    code: string
  }
  lines: LedgerLine[]
  summary: LedgerSummary
}


// ----------------------- AI Chat -----------------------
export type ChatModel = {
  name: string
}

export type ChatListItem = {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  chatTitle: string
  customerId: string
}

export type ChatConversation = {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  chatId: string
  question: string
  answer: string
  like: boolean
  dislike: boolean
}

export type ChatDetail = ChatListItem & {
  conversations: ChatConversation[]
}

export type AiChatPayload = {
  question: string
  chatId?: string
  model?: string
}

export type UpdateChatTitlePayload = {
  chatId: string
  title: string
}

export type ChatAttachment = {
  id: string
  fileName: string
  url?: string
}
