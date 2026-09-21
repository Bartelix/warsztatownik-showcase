import type { Tables } from '~/types/database.types'

export type Client = Tables<'clients'>

export interface ClientListItem extends Client {
  vehicleCount: number
}

export interface ClientWithVehicles extends Client {
  vehicles: Tables<'vehicles'>[]
}

export interface ClientInput {
  full_name: string
  phone: string | null
  notes: string | null
}

/** Thrown by `remove` instead of letting the FK violation reach the caller as a raw Postgres error. */
export class ClientHasVehiclesError extends Error {
  constructor(public readonly vehicleCount: number) {
    super(`Nie można usunąć — klient ma ${formatVehicleCount(vehicleCount)}`)
  }
}

function normalize(input: ClientInput): ClientInput {
  return {
    full_name: input.full_name.trim(),
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null
  }
}

export function useClients() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { activeWorkshopId } = useWorkshops()

  async function list(): Promise<ClientListItem[]> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('clients')
      .select('*, vehicles(count)')
      .eq('workshop_id', activeWorkshopId.value)
      .order('full_name')

    if (error) throw error

    return (data ?? []).map(({ vehicles, ...client }) => ({
      ...client,
      vehicleCount: vehicles[0]?.count ?? 0
    }))
  }

  /** `maybeSingle` (not `single`) so a missing client returns `null` instead of throwing — callers tell "not found" apart from a real fetch error. */
  async function getById(id: string): Promise<ClientWithVehicles | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*, vehicles(*)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'vehicles', ascending: false })
      .maybeSingle()

    if (error) throw error
    return data
  }

  async function create(input: ClientInput): Promise<Client> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...normalize(input),
        workshop_id: activeWorkshopId.value,
        created_by: user.value?.sub
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function update(id: string, input: ClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update(normalize(input))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /** Throws ClientHasVehiclesError if deleting would hit the ON DELETE RESTRICT on vehicles.client_id. */
  async function assertDeletable(id: string): Promise<void> {
    const { count, error } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', id)

    if (error) throw error
    if (count) throw new ClientHasVehiclesError(count)
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
  }

  return { list, getById, create, update, remove, assertDeletable, activeWorkshopId }
}
