import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '@/api/auth'
import { TOKEN_KEY, USER_KEY } from '@/api/client'
import type { User } from '@/types'

type AuthState = {
  token: string | null
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  /** Persist a token obtained externally (e.g. Google SSO), then refresh `user`. */
  setAuthToken: (accessToken: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  })
  const [loading, setLoading] = useState<boolean>(!!token && !user)

  const refresh = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await authApi.me()
      setUser(me.data)
      localStorage.setItem(USER_KEY, JSON.stringify(me.data))
    } catch {
      setUser(null)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token && !user) void refresh()
    else setLoading(false)
  }, [token, user, refresh])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    const accessToken = res.data.accessToken
    localStorage.setItem(TOKEN_KEY, accessToken)
    setToken(accessToken)
    // refresh me to get full user incl. roles
    const me = await authApi.me()
    setUser(me.data)
    localStorage.setItem(USER_KEY, JSON.stringify(me.data))
  }, [])

  const setAuthToken = useCallback(async (accessToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setToken(accessToken)
    const me = await authApi.me()
    setUser(me.data)
    localStorage.setItem(USER_KEY, JSON.stringify(me.data))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ token, user, loading, login, setAuthToken, logout, refresh }),
    [token, user, loading, login, setAuthToken, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
