export function formatCurrency(value: number | string, currency = 'USD') {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n)
}

export function formatNumber(value: number | string) {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', {
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
  URL.revokeObjectURL(url)
}

// Pull paginated items out of whatever shape the backend returns.
// Falls back gracefully — defensive because shapes vary across services.
export function normalizeList<T>(raw: any): {
  items: T[]
  total: number
  page: number
  pageSize: number
} {
  if (!raw) return { items: [], total: 0, page: 1, pageSize: 20 }
  if (Array.isArray(raw)) {
    return { items: raw as T[], total: raw.length, page: 1, pageSize: raw.length }
  }
  const items: T[] =
    raw.items ?? raw.data ?? raw.results ?? raw.rows ?? []
  const total: number =
    raw.total ?? raw.count ?? raw.totalCount ?? items.length
  const page: number = raw.page ?? 1
  const pageSize: number = raw.pageSize ?? raw.limit ?? items.length
  return { items, total, page, pageSize }
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
