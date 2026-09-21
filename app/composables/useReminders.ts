import type { Tables, TablesInsert } from '~/types/database.types'
import type { VehicleWithClient } from '~/composables/useVehicles'
import type { ReminderStatus } from '~/utils/labels'

export type Reminder = Tables<'service_reminders'>

export interface ReminderWithVehicle extends Reminder {
  vehicle: VehicleWithClient
}

export interface ReminderInput {
  reminder_type: string
  due_date: string | null
  due_mileage: number | null
  note: string | null
}

function normalize(input: ReminderInput): ReminderInput {
  return {
    reminder_type: input.reminder_type.trim(),
    due_date: input.due_date || null,
    due_mileage: input.due_mileage ?? null,
    note: input.note?.trim() || null
  }
}

export function useReminders() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { activeWorkshopId } = useWorkshops()

  /** /przypomnienia and the dashboard "Do przypomnienia" section both read from here. */
  async function listActive(): Promise<ReminderWithVehicle[]> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('service_reminders')
      .select('*, vehicle:vehicles(*, client:clients(*))')
      .eq('workshop_id', activeWorkshopId.value)
      .eq('status', 'aktywne')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('due_mileage', { ascending: true, nullsFirst: false })

    if (error) throw error
    return (data ?? []) as unknown as ReminderWithVehicle[]
  }

  /** Dashboard "Do przypomnienia": only reminders that are actually due right now. */
  async function listDue(): Promise<ReminderWithVehicle[]> {
    const active = await listActive()
    return active.filter(reminder => isReminderDue(reminder, reminder.vehicle.current_mileage))
  }

  /** workshop_id is set by the service_reminders_set_workshop_id DB trigger, not by the app. */
  async function create(vehicleId: string, input: ReminderInput): Promise<Reminder> {
    const { data, error } = await supabase
      .from('service_reminders')
      .insert({
        ...normalize(input),
        vehicle_id: vehicleId,
        created_by: user.value?.sub,
        workshop_id: undefined as unknown as string
      } satisfies TablesInsert<'service_reminders'>)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function updateStatus(id: string, status: ReminderStatus): Promise<Reminder> {
    const { data, error } = await supabase
      .from('service_reminders')
      .update({ status, completed_at: status === 'aktywne' ? null : new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from('service_reminders').delete().eq('id', id)
    if (error) throw error
  }

  /** Used to warn before a vehicle delete cascades into its reminders. */
  async function countByVehicle(vehicleId: string): Promise<number> {
    const { count, error } = await supabase
      .from('service_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('vehicle_id', vehicleId)

    if (error) throw error
    return count ?? 0
  }

  return { listActive, listDue, create, updateStatus, remove, countByVehicle, activeWorkshopId }
}
