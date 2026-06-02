# Ledger — Frontend for the Accounting System API

A React + Vite + TypeScript frontend for the NestJS Accounting System
backend (`accounting-system-backend`).

> Editorial parchment + deep-emerald aesthetic, Fraunces display serif paired
> with IBM Plex Sans and JetBrains Mono tabular numerics. Built to feel like a
> bound ledger, not a generic SaaS dashboard.

---

## What's inside

A full UI for every public endpoint exposed by the backend:

| Module               | Pages                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Auth**             | Sign up (two-step), sign in, email verification, resend verification, current user (`me`) |
| **Accounts**         | List with search/type filter, create (top-level or sub-account), edit name, delete       |
| **Account types**    | Pulled from `/account-types` and shown in account-type selectors                         |
| **Transactions**     | List, create / edit / delete, view detail, Excel template download, Excel upload, voucher PDF download |
| **Transaction rules**| List, create / edit / delete, dynamic rule lines (debit / credit toggle)                 |
| **Reports**          | Trial balance · Profit & loss · Balance sheet; Excel + PDF download for each            |

Auth state is persisted in `localStorage`. A 401 response anywhere clears
credentials and bounces to `/login`.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env if your API isn't at http://localhost:3001/api/v1

# 3. Run
npm run dev          # vite dev server on http://localhost:3000
```

Other scripts:

```bash
npm run build        # type-check + production build → ./dist
npm run preview      # preview the production build locally
```

---

## Configuration

Create `.env` from `.env.example`:

```ini
VITE_API_URL=http://localhost:3001/api/v1
```

The base URL **must** include the API prefix (`/api/v1` by default in the
backend's `app.config.ts`). The backend's CORS allows `http://localhost:3000`
out of the box, which matches the Vite dev server.

---

## Running against the backend

1.  Start the backend (in its own directory):
    ```bash
    npm install
    npm run migration:run
    npm run seed                # if you have a seed for transaction types
    npm run start:dev           # API on :3001
    ```
2.  Start the frontend:
    ```bash
    npm install
    npm run dev                 # UI on :3000
    ```
3.  Open <http://localhost:3000>, register, verify your email (check the
    backend logs for the link if `MAIL_*` isn't fully configured), and sign in.

---

## Project structure

```
frontend/
├── index.html
├── package.json
├── vite.config.ts                # path alias `@/` → src
├── tsconfig.json
├── tailwind.config.js            # custom palette: parchment / ink / emerald / claret
├── postcss.config.js
├── .env.example
└── src/
    ├── main.tsx                  # React + BrowserRouter entry
    ├── App.tsx                   # Route definitions, provider wiring
    ├── index.css                 # Tailwind base + component classes (btn, field, table-ledger…)
    ├── api/
    │   ├── client.ts             # axios instance, JWT interceptor, 401 redirect, error parser
    │   ├── auth.ts
    │   ├── accounts.ts
    │   ├── transactions.ts
    │   ├── transactionRules.ts
    │   └── reports.ts
    ├── context/
    │   ├── AuthContext.tsx       # token + user state, login / logout / refresh
    │   └── ToastContext.tsx      # global toast notifications
    ├── components/
    │   ├── Layout.tsx            # sidebar shell for authed pages
    │   ├── ProtectedRoute.tsx    # auth guard
    │   ├── PageHeader.tsx        # consistent eyebrow + title + actions header
    │   ├── Modal.tsx             # backdrop + escape-to-close
    │   ├── Pagination.tsx
    │   └── EmptyState.tsx
    ├── pages/
    │   ├── Login.tsx
    │   ├── Register.tsx          # two-step: user info → company info
    │   ├── VerifyEmail.tsx       # handles ?token= and resend
    │   ├── Dashboard.tsx
    │   ├── Accounts.tsx
    │   ├── Transactions.tsx
    │   ├── TransactionRules.tsx
    │   └── Reports.tsx
    ├── types/
    │   └── index.ts              # TS types mirroring the backend DTOs
    └── lib/
        └── utils.ts              # formatters, blob download, list normaliser
```

---

## Design system

All design tokens live in `tailwind.config.js` so the look is easy to change.

| Token              | Role                                  |
| ------------------ | ------------------------------------- |
| `parchment-50/100/200` | Page background, surface, hover    |
| `ink-900/700/500`  | Body text, muted text                 |
| `emerald_ledger-500` | Primary accent (buttons, links, active nav) |
| `claret-500`       | Danger / destructive                  |
| `sand`             | Borders and dividers                  |
| `font-display`     | Fraunces (serif, big numbers and titles) |
| `font-sans`        | IBM Plex Sans (body)                  |
| `font-mono`        | JetBrains Mono (codes, dates, amounts) |

Reusable component classes in `index.css`:

- `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`
- `field`, `label`
- `card`
- `table-ledger`
- `chip-asset`, `chip-liability`, `chip-equity`, `chip-revenue`, `chip-expense`
- `rule-ornament` — decorative divider with a centered diamond

---

## API contracts assumed

The frontend follows the controllers in `nodeapi/src`:

| Endpoint                                  | Method  | Notes                                                         |
| ----------------------------------------- | ------- | ------------------------------------------------------------- |
| `/auth/register`                          | POST    | Body matches `RegisterDto` (10 fields)                       |
| `/auth/login`                             | POST    | Returns `{ data: { accessToken, user } }`                    |
| `/auth/verify-email?token=`               | GET     | Public                                                       |
| `/auth/resend-verification`               | POST    | Public                                                       |
| `/auth/me`                                | GET     | Bearer                                                       |
| `/accounts`                               | GET/POST| List query: `search`, `accountType`, `page`, `pageSize`      |
| `/accounts/:id`                           | GET/PATCH/DELETE | `PATCH` accepts `{ name }`                          |
| `/account-types`                          | GET     | Returns `{ label, value }[]`                                 |
| `/transactions`                           | GET/POST| `POST` matches `CreateTransactionDto`                        |
| `/transactions/:id`                       | GET/PUT/DELETE |                                                        |
| `/transactions/template-download`         | GET     | XLSX blob                                                    |
| `/transactions/:id/download`              | GET     | PDF blob                                                     |
| `/transactions/upload-excel`              | POST    | `multipart/form-data`, field `file`                          |
| `/transaction-rules`                      | GET/POST|                                                              |
| `/transaction-rules/:id`                  | GET/PUT/DELETE | Rules array has min length 2                          |
| `/account-reports/trial-balance` (+ pl, balance-sheet) | GET | Optional `accountType`, `transactionFrom/To`, `accountCode` |
| `/account-reports/{report}/{excel\|pdf}`  | GET     | Blob download                                                |

Because the report endpoints in NestJS return varying shapes
(`[]`, `{ rows }`, `{ items }`, or sectioned objects for P&L / BS), the Reports
page uses a defensive `normaliseReport` helper that flattens whatever comes
back. If your backend uses a shape not yet handled, the page will show the raw
JSON in a `<details>` panel so you can adjust.

---

## Auth flow

1. **Login** → `POST /auth/login` → JWT saved in `localStorage` under `ledger.token`.
2. **`AuthContext`** then calls `GET /auth/me` to hydrate the full user.
3. The **axios request interceptor** in `api/client.ts` attaches
   `Authorization: Bearer <token>` to every subsequent call.
4. **Any 401 response** clears credentials and bounces to `/login`.
5. **Logout** simply clears `localStorage` and navigates to `/login`.

---

## Notes & gotchas

- **Transaction rules must exist before posting a transaction.** The
  `CreateTransactionDto` requires a `transactionTypeId`, which the UI sources
  from the transaction-rules list. The "New entry" modal warns when no rules
  are defined yet.
- **Account codes** must be uppercase alphabetical only — the input
  auto-uppercases.
- **Excel uploads** for transactions expect the format produced by the
  template download endpoint.
- **Email verification** depends on the backend's `MAIL_*` configuration. In
  dev, you'll usually find the verification token in the API logs.

---

## License

MIT
