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
  // Some browsers may cancel the download if we revoke immediately.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  // Some endpoints wrap payloads as { message, data }
  const unwrapped = raw && typeof raw === 'object' && 'data' in raw && !Array.isArray(raw.data)
    ? raw.data
    : raw

  if (Array.isArray(unwrapped)) {
    return { items: unwrapped as T[], total: unwrapped.length, page: 1, pageSize: unwrapped.length }
  }

  // Support multiple backend pagination shapes:
  // - { items, total, page, pageSize }
  // - { data, meta: { total, page, pageSize } } (NestJS PaginatedResponse)
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
