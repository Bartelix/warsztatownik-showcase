/**
 * Reminder due logic. A reminder counts as "wymagalne" (due) once its due
 * date is within REMINDER_DUE_SOON_DAYS days (or already passed), or the
 * vehicle's current mileage has already reached its due mileage.
 */

export const REMINDER_DUE_SOON_DAYS = 7

/** Suggested reminder types offered in the form, next to a free-text option. */
export const reminderTypePresets = ['Olej', 'Przegląd', 'Rozrząd', 'Opony'] as const

export function isReminderDue(
  reminder: { due_date: string | null, due_mileage: number | null },
  currentMileage: number | null | undefined
): boolean {
  if (reminder.due_date && reminder.due_date <= addDays(todayIso(), REMINDER_DUE_SOON_DAYS)) return true
  if (reminder.due_mileage !== null && currentMileage != null && currentMileage >= reminder.due_mileage) return true
  return false
}

/** "13.08.2027" / "165 000 km" — joins whichever due conditions the reminder has. */
export function reminderDueSummary(reminder: { due_date: string | null, due_mileage: number | null }): string {
  const parts: string[] = []
  if (reminder.due_date) parts.push(formatDate(reminder.due_date))
  if (reminder.due_mileage !== null) parts.push(formatMileage(reminder.due_mileage))
  return parts.join(' / ')
}
