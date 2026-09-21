/**
 * Formatting of values shown to the user.
 * One place — so dates and mileage look the same on every screen.
 */

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})

const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const numberFormatter = new Intl.NumberFormat('pl-PL')

/** Today's local date as YYYY-MM-DD — for date-only comparisons and default form values. */
export function todayIso(): string {
  return dateToIso(new Date())
}

/** A Date's local calendar date as YYYY-MM-DD (not UTC — toISOString() shifts across midnight in +offset zones). */
export function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** YYYY-MM-DD + days, in local time — e.g. "wczoraj / dziś / jutro" in the terminarz. */
export function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return dateToIso(date)
}

/** YYYY-MM-DD + months, in local time — used for the "12 miesięcy" reminder due date. */
export function addMonths(dateIso: string, months: number): string {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setMonth(date.getMonth() + months)
  return dateToIso(date)
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 2026-08-13 → "13.08.2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateFormatter.format(date) : '—'
}

/** 2026-08-13T09:30 → "13.08.2026, 09:30" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateTimeFormatter.format(date) : '—'
}

/** "09:30:00" → "09:30" (appointment time is sometimes optional) */
export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}

/** 152300 → "152 300 km" */
export function formatMileage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${numberFormatter.format(value)} km`
}

/** "+48123456789" → "+48 123 456 789", "123456789" → "123 456 789" */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const cleaned = value.replace(/\s+/g, '')
  const match = cleaned.match(/^(\+\d{2})?(\d{9})$/)
  if (!match) return value
  const [, prefix, digits] = match
  const grouped = digits!.replace(/(\d{3})(?=\d)/g, '$1 ')
  return prefix ? `${prefix} ${grouped}` : grouped
}

/** Number for a `tel:` link — no spaces or dashes */
export function phoneHref(value: string | null | undefined): string {
  return (value ?? '').replace(/[^\d+]/g, '')
}

/** Plate numbers and VINs are always stored uppercase, without spaces */
export function normalizePlate(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/\s+/g, '')
}

/** Polish plural for count nouns: 1 → jeden, 2-4 (not 12-14) → kilka, else → wiele */
function polishPlural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few
  return many
}

/** 0 → "0 aut", 1 → "1 auto", 2 → "2 auta", 5 → "5 aut" */
export function formatVehicleCount(count: number): string {
  return `${count} ${polishPlural(count, 'auto', 'auta', 'aut')}`
}

/** 0 → "0 napraw", 1 → "1 naprawa", 2 → "2 naprawy", 5 → "5 napraw" */
export function formatRepairCount(count: number): string {
  return `${count} ${polishPlural(count, 'naprawa', 'naprawy', 'napraw')}`
}

/** 0 → "0 przypomnień", 1 → "1 przypomnienie", 2 → "2 przypomnienia", 5 → "5 przypomnień" */
export function formatReminderCount(count: number): string {
  return `${count} ${polishPlural(count, 'przypomnienie', 'przypomnienia', 'przypomnień')}`
}
