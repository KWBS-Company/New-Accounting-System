import axios, { AxiosError, AxiosInstance } from 'axios'

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://7360-103-134-217-179.ngrok-free.app/api/v1'

/**
 * Bare backend origin (without the `/api/v1` prefix). Used to build
 * absolute URLs for media files like `/uploads/logo/foo.png` that the
 * backend serves from its static root rather than the API prefix.
 *
 * Example:
 *   API_BASE_URL  → https://api.example.com/api/v1
 *   API_ORIGIN    → https://api.example.com
 */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '')

export const TOKEN_KEY = 'ledger.token'
export const USER_KEY = 'ledger.user'

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
})

// Inject JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global 401 → logout
client.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      // Only redirect if we're not already on a public page
      const path = window.location.pathname
      if (
        ![
          '/login',
          '/register',
          '/verify-email',
          '/forgot-password',
          '/reset-password',
          '/google-sso',
          '/invite-user',
        ].includes(path)
      ) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

// Pretty-print backend validation errors
export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data: any = err.response?.data
    if (!data) return err.message
    if (typeof data.message === 'string') return data.message
    if (Array.isArray(data.message)) return data.message.join(' · ')
    if (data.error) return data.error
  }
  return (err as Error)?.message ?? 'Unknown error'
}

/**
 * Build an absolute URL for a media path returned by the backend (e.g.
 * `/uploads/logo/foo.png`, `/uploads/profile-pic/bar.jpg`). The backend
 * gives us a path relative to its origin; we prefix the origin so the
 * <img> can load it directly.
 *
 * Two adjustments matter in practice:
 *   1. ngrok-free origins block direct `<img>` requests with an HTML
 *      "warning" interstitial unless the request carries an
 *      `ngrok-skip-browser-warning` signal. Browsers can't add arbitrary
 *      request headers to an <img> fetch, so we send the signal as a
 *      query string — ngrok accepts either.
 *   2. After an upload, the backend-stored path may or may not change
 *      (depending on filename collision), and Radix' <AvatarImage>
 *      keeps a cached load. The `bust` arg lets callers force a fresh
 *      fetch by appending a version suffix.
 *
 * Pass-throughs:
 *  - empty / nullish   → undefined
 *  - already absolute  → ngrok / cache-buster suffixes still applied
 */
export function assetUrl(
  path?: string | null,
  bust?: number | string,
): string | undefined {
  if (!path) return undefined
  const isAbsolute = /^https?:\/\//i.test(path)
  const url = isAbsolute
    ? path
    : `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
  
  const params: string[] = []
  if (/\bngrok(-free)?\.(app|dev|io)\b/i.test(url)) {
    params.push('ngrok-skip-browser-warning=true')
  }
  if (bust !== undefined && bust !== null && String(bust) !== '') {
    params.push(`v=${encodeURIComponent(String(bust))}`)
  }
  if (params.length === 0) return url
  return url.includes('?')
    ? `${url}&${params.join('&')}`
    : `${url}?${params.join('&')}`
}

export default client
export { API_BASE_URL }
