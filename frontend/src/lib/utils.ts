import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Account } from '@/types'

// -----------------------------------------------------------------------------
// cn() — class merger used by all shadcn components.
// -----------------------------------------------------------------------------
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// -----------------------------------------------------------------------------
// Currency / number / date formatters. Default currency is configurable via
// src/lib/currency.ts — these here are plain helpers used across the app.
// -----------------------------------------------------------------------------
import { DEFAULT_CURRENCY_SYMBOL } from './currency'

/** Format a value as the app's default currency (Rs.). */
export function formatCurrency(value: number | string, symbol = DEFAULT_CURRENCY_SYMBOL) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(n)) return '—'
  const num = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
  return `${symbol} ${num}`
}

/** Format a value as a plain decimal — no currency prefix. */
export function formatNumber(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatDateTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// -----------------------------------------------------------------------------
// Defensive pagination normalizer — supports several common backend shapes.
// (preserved verbatim from previous version)
// -----------------------------------------------------------------------------
export function normalizeList<T>(raw: any): {
  items: T[]
  total: number
  page: number
  pageSize: number
} {
  if (!raw) return { items: [], total: 0, page: 1, pageSize: 20 }

  const unwrapped =
    raw && typeof raw === 'object' && 'data' in raw && !Array.isArray(raw.data)
      ? raw.data
      : raw

  if (Array.isArray(unwrapped)) {
    return {
      items: unwrapped as T[],
      total: unwrapped.length,
      page: 1,
      pageSize: unwrapped.length,
    }
  }

  const rawItems: unknown =
    unwrapped?.items ??
    unwrapped?.data ??
    unwrapped?.results ??
    unwrapped?.rows ??
    unwrapped?.data?.items ??
    unwrapped?.data?.data ??
    []

  const items: T[] = Array.isArray(rawItems) ? (rawItems as T[]) : []
  const meta = unwrapped?.meta ?? unwrapped?.data?.meta
  const total: number =
    Number(
      unwrapped?.total ??
        unwrapped?.count ??
        unwrapped?.totalCount ??
        meta?.total ??
        items.length,
    ) || 0
  const page: number = Number(unwrapped?.page ?? meta?.page ?? 1) || 1
  const pageSize: number =
    Number(unwrapped?.pageSize ?? unwrapped?.limit ?? meta?.pageSize ?? items.length) ||
    items.length

  return { items, total, page, pageSize }
}

/** Keep dropdown options in sync after inline create — server list may lag or filter. */
export function mergeAccounts(
  items: Account[],
  ...ensure: (Account | null | undefined)[]
): Account[] {
  const merged = [...items]
  for (const acc of ensure) {
    if (acc?.id && !merged.some((a) => a.id === acc.id)) {
      merged.push(acc)
    }
  }
  return merged.sort((a, b) =>
    (a.code || a.name).localeCompare(b.code || b.name),
  )
}

export function accountTypeChipClass(t?: string) {
  switch (t) {
    case 'ASSET':     return 'chip-asset'
    case 'LIABILITY': return 'chip-liability'
    case 'EQUITY':    return 'chip-equity'
    case 'REVENUE':   return 'chip-revenue'
    case 'EXPENSE':   return 'chip-expense'
    default:          return 'chip-equity'
  }
}
