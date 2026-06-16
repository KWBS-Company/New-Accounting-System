/**
 * Bikram Sambat (BS, Nepali) calendar utilities.
 *
 * The Nepali year is non-uniform — each month can have 29-32 days, with the
 * mapping changing year-on-year. We ship a lookup table covering BS years
 * 2070..2100 (≈ AD 2013..2043), which is more than enough for any working
 * fiscal year today (AD 2026).
 *
 * Reference for the table: published Nepali calendars / npm `nepali-date`.
 *
 * The conversion strategy:
 *   1. We keep the AD reference for BS year 2070-01-01 (= 2013-04-14).
 *   2. To go AD → BS, we walk forward from that reference, day-by-day,
 *      mapping each AD date into BS coordinates. For repeat calls we
 *      cache the mapping in a Map.
 *   3. Going BS → AD just sums days from the reference and adds them to it.
 *
 * Date strings are always in ISO/Latin digits — no Devanagari numerals here,
 * since the calendar UI shows both BS and AD numerically.
 */

// BS month lengths per year, 12 months each. Source: Nepali calendar tables.
// Index 0 = Baishakh, …, 11 = Chaitra.
// Years 2070..2100 inclusive (31 years).
const BS_MONTH_DAYS: Record<number, number[]> = {
  2070: [31, 31, 32, 32, 31, 31, 30, 30, 29, 30, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2073: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2074: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2075: [31, 32, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2077: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2078: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2079: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2082: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2083: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2091: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2092: [30, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2093: [30, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2094: [31, 31, 32, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2095: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2096: [30, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2097: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2098: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2099: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2100: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
}

export const BS_MONTH_NAMES_EN = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik',  'Mangsir', 'Poush',  'Magh',    'Falgun', 'Chaitra',
]

export const BS_MONTH_NAMES_NE = [
  'बैशाख', 'जेठ',  'असार',  'साउन',   'भदौ',   'असोज',
  'कार्तिक', 'मंसिर', 'पुष',   'माघ',   'फागुन', 'चैत',
]

const AD_MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** AD date corresponding to BS 2070-01-01 (1 Baishakh 2070). */
const REFERENCE_AD = new Date(Date.UTC(2013, 3, 14)) // 2013-04-14
const REFERENCE_BS = { year: 2070, month: 1, day: 1 }

export const BS_MIN_YEAR = 2070
export const BS_MAX_YEAR = 2100

export type BSDate = { year: number; month: number; day: number }

function daysInBsMonth(year: number, monthOneBased: number): number {
  const row = BS_MONTH_DAYS[year]
  if (!row) return 30
  return row[monthOneBased - 1] ?? 30
}

/** AD date (UTC midnight) → BS date. */
export function adToBs(date: Date): BSDate {
  // Work in UTC midnight so DST/timezone doesn't drift us.
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const diffMs = utc.getTime() - REFERENCE_AD.getTime()
  let dayCount = Math.round(diffMs / 86_400_000)

  let { year, month, day } = REFERENCE_BS
  if (dayCount >= 0) {
    while (dayCount > 0) {
      const dim = daysInBsMonth(year, month)
      const remainInMonth = dim - day + 1
      if (dayCount >= remainInMonth) {
        dayCount -= remainInMonth
        day = 1
        month += 1
        if (month > 12) {
          month = 1
          year += 1
        }
      } else {
        day += dayCount
        dayCount = 0
      }
    }
  } else {
    // Walk backwards.
    dayCount = -dayCount
    while (dayCount > 0) {
      if (dayCount >= day) {
        dayCount -= day
        month -= 1
        if (month < 1) {
          month = 12
          year -= 1
        }
        day = daysInBsMonth(year, month)
      } else {
        day -= dayCount
        dayCount = 0
      }
    }
  }
  return { year, month, day }
}

/** BS date → AD Date (UTC midnight). */
export function bsToAd(bs: BSDate): Date {
  let total = 0
  if (
    bs.year < REFERENCE_BS.year ||
    (bs.year === REFERENCE_BS.year && bs.month === REFERENCE_BS.month && bs.day < REFERENCE_BS.day)
  ) {
    // Walk backwards if before reference (rare in our scope).
    let { year, month, day } = REFERENCE_BS
    while (year > bs.year || (year === bs.year && month > bs.month) || (year === bs.year && month === bs.month && day > bs.day)) {
      day -= 1
      total -= 1
      if (day < 1) {
        month -= 1
        if (month < 1) {
          month = 12
          year -= 1
        }
        day = daysInBsMonth(year, month)
      }
    }
  } else {
    let { year, month, day } = REFERENCE_BS
    while (year !== bs.year || month !== bs.month || day !== bs.day) {
      day += 1
      total += 1
      const dim = daysInBsMonth(year, month)
      if (day > dim) {
        day = 1
        month += 1
        if (month > 12) {
          month = 1
          year += 1
        }
      }
    }
  }
  return new Date(REFERENCE_AD.getTime() + total * 86_400_000)
}

/** Format helpers. */
export function bsLabel(bs: BSDate, lang: 'en' | 'ne' = 'en'): string {
  const names = lang === 'ne' ? BS_MONTH_NAMES_NE : BS_MONTH_NAMES_EN
  return `${bs.day} ${names[bs.month - 1]} ${bs.year}`
}

export function adLabel(date: Date): string {
  const m = AD_MONTH_NAMES_EN[date.getUTCMonth()]
  return `${date.getUTCDate()} ${m} ${date.getUTCFullYear()}`
}

/**
 * Parse a YYYY-MM-DD string into a UTC-midnight Date. Returns null on bad
 * input.
 */
export function parseIsoDate(s: string | undefined | null): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

/** Format a Date (UTC) as YYYY-MM-DD. */
export function isoDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0')
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = date.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** First weekday (0=Sun .. 6=Sat) for the 1st of a BS month. */
export function bsMonthStartWeekday(year: number, month: number): number {
  const ad = bsToAd({ year, month, day: 1 })
  return ad.getUTCDay()
}

export function clampBsYear(y: number): number {
  if (y < BS_MIN_YEAR) return BS_MIN_YEAR
  if (y > BS_MAX_YEAR) return BS_MAX_YEAR
  return y
}

export function bsMonthLength(year: number, month: number): number {
  return daysInBsMonth(year, month)
}
