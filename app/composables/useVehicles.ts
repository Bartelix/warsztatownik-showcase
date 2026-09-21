import type { Tables, TablesInsert } from '~/types/database.types'

export type Vehicle = Tables<'vehicles'>

export interface VehicleWithClient extends Vehicle {
  client: Tables<'clients'>
}

export interface VehicleInput {
  make: string
  model: string | null
  year: number | null
  engine: string | null
  vin: string | null
  plate: string | null
  current_mileage: number | null
  notes: string | null
}

function normalize(input: VehicleInput): VehicleInput {
  return {
    make: input.make.trim(),
    model: input.model?.trim() || null,
    year: input.year ?? null,
    engine: input.engine?.trim() || null,
    vin: input.vin?.trim() ? normalizePlate(input.vin) : null,
    plate: input.plate?.trim() ? normalizePlate(input.plate) : null,
    current_mileage: input.current_mileage ?? null,
    notes: input.notes?.trim() || null
  }
}

export function useVehicles() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  /** `maybeSingle` (not `single`) so a missing vehicle returns `null` instead of throwing — callers tell "not found" apart from a real fetch error. */
  async function getById(id: string): Promise<VehicleWithClient | null> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, client:clients(*)')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data as unknown as VehicleWithClient | null
  }

  /** workshop_id is set by the vehicles_set_workshop_id DB trigger, not by the app. */
  async function create(clientId: string, input: VehicleInput): Promise<Vehicle> {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        ...normalize(input),
        client_id: clientId,
        created_by: user.value?.sub,
        workshop_id: undefined as unknown as string
      } satisfies TablesInsert<'vehicles'>)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function update(id: string, input: VehicleInput): Promise<Vehicle> {
    const { data, error } = await supabase
      .from('vehicles')
      .update(normalize(input))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** Ownership change: only client_id moves, workshop_id follows automatically via trigger. */
  async function reassignClient(id: string, clientId: string): Promise<Vehicle> {
    const { data, error } = await supabase
      .from('vehicles')
      .update({ client_id: clientId })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) throw error
  }

  /** Non-blocking duplicate check: returns matching vehicles, caller decides what to do with them. */
  async function findByVin(vin: string): Promise<Vehicle[]> {
    const normalized = normalizePlate(vin)
    if (!normalized) return []

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('vin', normalized)

    if (error) throw error
    return data ?? []
  }

  return { getById, create, update, reassignClient, remove, findByVin }
}
