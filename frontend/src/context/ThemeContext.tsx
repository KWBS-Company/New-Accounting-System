import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

type ThemeProviderState = {
  theme: Theme
  setTheme: (t: Theme) => void
  /** The effective theme actually applied to <html> ('light' or 'dark'). */
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeProviderState | undefined>(undefined)

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME
    return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || DEFAULT_THEME
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? getSystemTheme() : (theme as 'light' | 'dark'),
  )

  // Apply theme to <html class="...">
  useEffect(() => {
    const root = document.documentElement
    const next: 'light' | 'dark' =
      theme === 'system' ? getSystemTheme() : theme
    root.classList.remove('light', 'dark')
    root.classList.add(next)
    setResolvedTheme(next)
  }, [theme])

  // Watch system changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const next: 'light' | 'dark' = mq.matches ? 'dark' : 'light'
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(next)
      setResolvedTheme(next)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (t: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
