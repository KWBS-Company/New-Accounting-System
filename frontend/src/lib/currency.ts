// -----------------------------------------------------------------------------
// Currency configuration. Change DEFAULT_CURRENCY_SYMBOL to switch the symbol
// shown throughout the app. Used by formatCurrency() in lib/utils.ts.
//
// Default: Rs. (Nepali Rupee).
// -----------------------------------------------------------------------------

export const DEFAULT_CURRENCY_CODE   = 'NPR'
export const DEFAULT_CURRENCY_SYMBOL = 'Rs.'
export const DEFAULT_LOCALE          = 'en-IN'

export const CURRENCIES = [
  { code: 'NPR', symbol: 'Rs.', label: 'Nepali Rupee' },
  { code: 'INR', symbol: '₹',   label: 'Indian Rupee'  },
  { code: 'USD', symbol: '$',   label: 'US Dollar'    },
  { code: 'EUR', symbol: '€',   label: 'Euro'         },
  { code: 'GBP', symbol: '£',   label: 'British Pound' },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']
