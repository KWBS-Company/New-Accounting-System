// -----------------------------------------------------------------------------
// Theme registry — what themes exist, what's the default, storage key.
// Visual tokens (colors, radii) live in src/index.css under :root / .dark.
// -----------------------------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'ledger.theme'
export const DEFAULT_THEME: Theme = 'system'

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light',  label: 'Light'  },
  { value: 'dark',   label: 'Dark'   },
  { value: 'system', label: 'System' },
]
