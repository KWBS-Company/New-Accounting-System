# Architecture & Where to Change Things

This refactor preserved every existing API call, state shape, validation flow,
auth flow, and route — only the presentation layer changed. Below is the map.

## Project layout

```
src/
├── App.tsx                      Routes + providers (Theme/Toast/Auth)
├── main.tsx                     Entry
├── index.css                    THEME TOKENS — light + dark, all in one place
│
├── config/                      Static app config
│   ├── site.ts                  Brand name, tagline, quote
│   └── navigation.ts            Sidebar items + lucide icons
│
├── lib/                         Pure helpers (no React)
│   ├── utils.ts                 cn(), formatCurrency, formatDate, normalizeList…
│   ├── currency.ts              Default currency: "Rs." (Nepali Rupee)
│   ├── theme.ts                 Theme registry (light/dark/system)
│   └── validators.ts            UPPERCASE_UNDERSCORE regex + password rules
│
├── context/                     React providers
│   ├── AuthContext.tsx          login/logout/refresh — LOGIC UNCHANGED
│   ├── ToastContext.tsx
│   └── ThemeContext.tsx         {theme, setTheme, resolvedTheme}
│
├── api/                         One file per backend resource
│   ├── client.ts                axios + 401 interceptor + error parser
│   ├── auth.ts                  + forgotPassword, resetPassword
│   ├── profile.ts               NEW: updateProfile, changePassword, uploadAvatar
│   ├── accounts.ts
│   ├── transactions.ts          + transactionFrom / transactionTo filters
│   ├── transactionRules.ts
│   └── reports.ts
│
├── components/
│   ├── ProtectedRoute.tsx
│   │
│   ├── ui/                      shadcn primitives — leave alone
│   │   ├── button.tsx           CVA variants: default, destructive, outline, secondary, ghost, link
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── label.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx           Radix Dialog (Modal wraps this)
│   │   ├── select.tsx           Radix Select
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── index.ts             barrel
│   │
│   ├── common/                  App-specific composables on top of ui/
│   │   ├── PasswordInput.tsx    Eye-toggle wrapper around <Input>
│   │   ├── ThemeToggle.tsx      Sun/Moon/Monitor dropdown
│   │   ├── Modal.tsx            Same {open, onClose, title, subtitle} API
│   │   ├── PageHeader.tsx       eyebrow / title / subtitle / actions
│   │   ├── EmptyState.tsx
│   │   └── Pagination.tsx
│   │
│   ├── layout/
│   │   ├── Layout.tsx           desktop sidebar + mobile drawer + topbar
│   │   └── Sidebar.tsx          nav + user footer (avatar → Profile)
│   │
│   └── PageHeader.tsx / Modal.tsx / Pagination.tsx / EmptyState.tsx
│       Shim re-exports — kept so old imports keep working.
│
├── pages/
│   ├── Login.tsx                + show/hide pwd + "Forgot password?" link
│   ├── Register.tsx             + show/hide pwd, multi-step preserved
│   ├── VerifyEmail.tsx
│   ├── ForgotPassword.tsx       NEW — step 1 of reset
│   ├── ResetPassword.tsx        NEW — step 2 of reset
│   ├── Profile.tsx              NEW — avatar upload + edit info + change pwd
│   ├── Dashboard.tsx
│   ├── Accounts.tsx
│   ├── Transactions.tsx         + date filter, renamed columns, row click,
│   │                              invoice no + transaction date in detail
│   ├── TransactionRules.tsx     + UPPERCASE_UNDERSCORE validation on type
│   └── Reports.tsx              + robust P&L / Balance Sheet parser
│
└── types/index.ts               + User.avatarUrl, Transaction.invoiceNo
```

## Where to change…

| Want to change…                              | Edit                                                  |
|----------------------------------------------|-------------------------------------------------------|
| Brand name / tagline                         | `src/config/site.ts`                                  |
| Sidebar items / order / icons                | `src/config/navigation.ts`                            |
| Theme colors (light AND dark)                | `src/index.css` (HSL CSS vars under `:root` and `.dark`) |
| Default currency symbol                      | `src/lib/currency.ts` → `DEFAULT_CURRENCY_SYMBOL`     |
| Password complexity                          | `src/lib/validators.ts`                               |
| Allowed chars for `transactionType`          | `src/lib/validators.ts` → `UPPERCASE_UNDERSCORE_REGEX`|
| Tailwind tokens (radius, fonts)              | `tailwind.config.js`                                  |
| Look of any shadcn component                 | the file in `src/components/ui/`                      |
| Add a new authenticated route                | `App.tsx` + create page in `src/pages/`               |
| API base URL                                 | `VITE_API_URL` env var → `src/api/client.ts`          |

## Theme system

- Whole palette is HSL CSS variables in `src/index.css`.
- Tailwind reads those vars via `tailwind.config.js → theme.extend.colors`.
- `ThemeProvider` flips `light` or `dark` class on `<html>`.
- `useTheme()` exposes `{theme, setTheme, resolvedTheme}`.
- `ThemeToggle` (top-right in app, also in mobile topbar) picks light / dark / system.
- Preference persisted in `localStorage` under `ledger.theme`.
- To add a new theme (e.g. "sepia"): add `.sepia { --background: …; … }` in
  `index.css`, list it in `lib/theme.ts`, add the class set in `ThemeContext`.

## Currency

- All amounts go through `formatCurrency()` in `src/lib/utils.ts`.
- Default symbol is **`Rs.`** for Nepali Rupee, defined in `src/lib/currency.ts`.
- Change `DEFAULT_CURRENCY_SYMBOL` in one place and everything updates.

## Icons

- All icons come from **lucide-react** (≈900 icons, tree-shakable,
  the pairing shadcn uses out of the box). Old text glyphs (◆ ₪ ✎ § ⏚) removed.
- Import directly: `import { Save, Trash2 } from 'lucide-react'`.

## Backend endpoints required by the new features

| Endpoint                       | Method  | Body / params                              |
|--------------------------------|---------|--------------------------------------------|
| `/auth/forgot-password`        | POST    | `{ email }`                                |
| `/auth/reset-password`         | POST    | `{ token, password }`                      |
| `/auth/change-password`        | POST    | `{ currentPassword, newPassword }`         |
| `/auth/profile`                | PATCH   | `{ firstName?, lastName?, phone? }`        |
| `/auth/avatar`                 | POST    | multipart `file` → `{ data: { avatarUrl } }` |
| `/transactions?transactionFrom=&transactionTo=` | GET | (existing list endpoint, new filter params) |

## Notes on rule changes

- **Rule 1 — Responsive:** every page uses `px-4 sm:px-6 lg:px-10`, responsive
  grids `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`, tables wrapped in
  overflow-x-auto, and the sidebar collapses into a hamburger drawer below `lg`.
- **Rule 2 — Transactions:** date filter mirrors Reports; columns renamed to
  "Transaction Date" and "Transaction Amount"; the whole `<tr>` is clickable
  (with action buttons doing `stopPropagation`); detail modal now shows
  Invoice No + Transaction Date as separate fields.
- **Rule 3 — Rules:** the `transactionType` field sanitizes every keystroke
  through `sanitizeTransactionType()` (uppercases letters, strips everything
  else), is constrained by HTML5 `pattern` matching `/^[A-Z]+(?:_[A-Z]+)*$/`,
  and the submit button is disabled when the value doesn't match.
- **Rule 4 — Reports:** P&L and Balance Sheet payloads are parsed by
  `parsePnl()` and `parseBalanceSheet()` in `Reports.tsx`. They look for known
  section keys (`revenue|revenues|income|sales`, `expense|expenses|cost|cogs`,
  `assets|asset`, `liabilities|liability`, `equity|equities|capital`) at the
  top level OR under `data`/`sections`. Each section can be a raw array OR
  `{ items, total }`. Net income / totals fall back to summed amounts when
  the backend doesn't provide them. A "Show raw response" toggle is always
  available — if your response is shaped differently, share what's inside and
  the parser extends in one place.
- **Rule 5 — Icons:** lucide-react throughout.
- **Rule 6 — Forgot password + profile + avatar:** dedicated pages + new API
  module `profile.ts`.
- **Rule 7 — Currency:** `Rs.` by default via `lib/currency.ts`.
- **Rule 8 — Show/hide password:** `<PasswordInput>` wherever a password is
  asked for (Login, Register, ResetPassword, Profile/change-password).
- **Rule 9 — Dark + shadcn:** done; tokens in `index.css`, components in
  `components/ui/`, theme in `context/ThemeContext` and `lib/theme.ts`.

## Sanity-check

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # tsc + vite build, both clean
```
