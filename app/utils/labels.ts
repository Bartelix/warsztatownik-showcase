/**
 * Database statuses → Polish labels.
 * Values must match the CHECK constraints in supabase/migrations/0001_schemat_poczatkowy.sql.
 */

export type RepairStatus = 'w_trakcie' | 'czeka_na_czesci' | 'zrobione'
export type AppointmentStatus = 'umowiona' | 'potwierdzona' | 'odwolana'
export type ReminderStatus = 'aktywne' | 'zrealizowane' | 'anulowane'

export const repairStatusLabels: Record<RepairStatus, string> = {
  w_trakcie: 'W trakcie',
  czeka_na_czesci: 'Czeka na części',
  zrobione: 'Zrobione'
}

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  umowiona: 'Umówiona',
  potwierdzona: 'Potwierdzona',
  odwolana: 'Odwołana'
}

export const reminderStatusLabels: Record<ReminderStatus, string> = {
  aktywne: 'Aktywne',
  zrealizowane: 'Zrealizowane',
  anulowane: 'Anulowane'
}

/** An open repair = not finished yet; both such statuses show up on the dashboard */
export const openRepairStatuses: RepairStatus[] = ['w_trakcie', 'czeka_na_czesci']

export function repairStatusLabel(status: string): string {
  return repairStatusLabels[status as RepairStatus] ?? status
}

/** Only the open statuses get a distinct color — a finished repair is not something to flag. */
export function repairStatusColor(status: string): 'warning' | 'error' | 'neutral' {
  if (status === 'w_trakcie') return 'warning'
  if (status === 'czeka_na_czesci') return 'error'
  return 'neutral'
}

export function appointmentStatusLabel(status: string): string {
  return appointmentStatusLabels[status as AppointmentStatus] ?? status
}

export function appointmentStatusColor(status: string): 'warning' | 'success' | 'error' | 'neutral' {
  if (status === 'umowiona') return 'warning'
  if (status === 'potwierdzona') return 'success'
  if (status === 'odwolana') return 'error'
  return 'neutral'
}

export function reminderStatusLabel(status: string): string {
  return reminderStatusLabels[status as ReminderStatus] ?? status
}
