import axios, { AxiosError, AxiosInstance } from 'axios'

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://localhost:3001/api/v1'

export const TOKEN_KEY = 'ledger.token'
export const USER_KEY = 'ledger.user'

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
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
      if (!['/login', '/register', '/verify-email'].includes(path)) {
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

export default client
export { API_BASE_URL }
