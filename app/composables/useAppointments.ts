import type { Tables, TablesInsert } from '~/types/database.types'
import type { AppointmentStatus } from '~/utils/labels'

export type Appointment = Tables<'appointments'>

export interface AppointmentWithClient extends Appointment {
  client: Tables<'clients'> | null
  vehicle: Tables<'vehicles'> | null
}

export interface AppointmentInput {
  appointment_date: string
  appointment_time: string | null
  client_id: string | null
  vehicle_id: string | null
  title: string | null
  note: string | null
}

function normalize(input: AppointmentInput): AppointmentInput {
  return {
    appointment_date: input.appointment_date,
    appointment_time: input.appointment_time || null,
    client_id: input.client_id || null,
    vehicle_id: input.vehicle_id || null,
    title: input.title?.trim() || null,
    note: input.note?.trim() || null
  }
}

export function useAppointments() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { activeWorkshopId } = useWorkshops()

  /** Day view: entries with a time sort first (ascending), the rest — no time — sort after. */
  async function listByDate(date: string): Promise<AppointmentWithClient[]> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('appointments')
      .select('*, client:clients(*), vehicle:vehicles(*)')
      .eq('workshop_id', activeWorkshopId.value)
      .eq('appointment_date', date)
      .order('appointment_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as unknown as AppointmentWithClient[]
  }

  /** Dashboard "Dziś" section. */
  function listToday(): Promise<AppointmentWithClient[]> {
    return listByDate(todayIso())
  }

  /** workshop_id is set by the app — the DB trigger only re-derives it when client_id is set. */
  async function create(input: AppointmentInput): Promise<Appointment> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        ...normalize(input),
        workshop_id: activeWorkshopId.value,
        created_by: user.value?.sub
      } satisfies TablesInsert<'appointments'>)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) throw error
  }

  return { listByDate, listToday, create, updateStatus, remove, activeWorkshopId }
}
