// -----------------------------------------------------------------------------
// Global app config. Change brand name, tagline, etc. in ONE place.
// -----------------------------------------------------------------------------

export const site = {
  name: 'Accounting System',
  tagline: 'Double-entry · Est. 2026',
  description: 'Double-entry accounting for the modern small business.',
  quote: {
    text: '“Every credit finds its debit; balance is not an opinion.”',
    attribution: "— A bookkeeper's first principle",
  },
} as const

export type SiteConfig = typeof site
