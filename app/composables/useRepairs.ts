import type { Tables, TablesInsert } from '~/types/database.types'
import type { VehicleWithClient } from '~/composables/useVehicles'
import { openRepairStatuses, type RepairStatus } from '~/utils/labels'

export type Repair = Tables<'repairs'>
export type RepairPart = Tables<'repair_parts'>

export interface RepairWithParts extends Repair {
  parts: RepairPart[]
}

export interface RepairDetails extends RepairWithParts {
  vehicle: Tables<'vehicles'>
  authorName: string | null
}

export interface OpenRepair extends RepairWithParts {
  vehicle: VehicleWithClient
}

export interface RepairInput {
  repair_date: string
  description: string
  mileage: number | null
  status: RepairStatus
}

export interface RepairPartInput {
  name: string
  catalog_number: string | null
  supplier: string | null
}

function normalize(input: RepairInput): RepairInput {
  return {
    repair_date: input.repair_date,
    description: input.description.trim(),
    mileage: input.mileage ?? null,
    status: input.status
  }
}

function normalizePart(input: RepairPartInput): RepairPartInput {
  return {
    name: input.name.trim(),
    catalog_number: input.catalog_number?.trim() || null,
    supplier: input.supplier?.trim() || null
  }
}

export function useRepairs() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { activeWorkshopId } = useWorkshops()

  /** Parts are joined in eagerly — the vehicle history list shows them next to each repair. */
  async function list(vehicleId: string): Promise<RepairWithParts[]> {
    const { data, error } = await supabase
      .from('repairs')
      .select('*, parts:repair_parts(*)')
      .eq('vehicle_id', vehicleId)
      .order('repair_date', { ascending: false })
      .order('created_at', { referencedTable: 'repair_parts', ascending: true })

    if (error) throw error
    return data ?? []
  }

  /** Dashboard: every unfinished repair across the workshop, not scoped to one vehicle. */
  async function listOpen(): Promise<OpenRepair[]> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('repairs')
      .select('*, parts:repair_parts(*), vehicle:vehicles(*, client:clients(*))')
      .eq('workshop_id', activeWorkshopId.value)
      .in('status', openRepairStatuses)
      .order('repair_date', { ascending: false })
      .order('created_at', { referencedTable: 'repair_parts', ascending: true })

    if (error) throw error
    return (data ?? []) as unknown as OpenRepair[]
  }

  /** `maybeSingle` (not `single`) so a missing repair returns `null` instead of throwing — callers tell "not found" apart from a real fetch error. */
  async function getById(id: string): Promise<RepairDetails | null> {
    const { data, error } = await supabase
      .from('repairs')
      .select('*, parts:repair_parts(*), vehicle:vehicles(*)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'repair_parts', ascending: true })
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    const authorName = await getAuthorName(data.created_by)

    return { ...data, authorName } as RepairDetails
  }

  /** created_by references auth.users, not public.profiles — no FK for PostgREST to embed, so a second query. */
  async function getAuthorName(profileId: string | null): Promise<string | null> {
    if (!profileId) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', profileId)
      .single()

    if (error) throw error
    return data.display_name
  }

  /** workshop_id is set by the repairs_set_workshop_id DB trigger, not by the app. */
  async function create(vehicleId: string, input: RepairInput): Promise<Repair> {
    const { data, error } = await supabase
      .from('repairs')
      .insert({
        ...normalize(input),
        vehicle_id: vehicleId,
        created_by: user.value?.sub,
        workshop_id: undefined as unknown as string
      } satisfies TablesInsert<'repairs'>)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function update(id: string, input: RepairInput): Promise<Repair> {
    const { data, error } = await supabase
      .from('repairs')
      .update(normalize(input))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function updateStatus(id: string, status: RepairStatus): Promise<Repair> {
    const { data, error } = await supabase
      .from('repairs')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function remove(id: string): Promise<void> {
    const { error } = await supabase.from('repairs').delete().eq('id', id)
    if (error) throw error
  }

  /** workshop_id is set by the repair_parts_set_workshop_id DB trigger, derived from repair_id. */
  async function addPart(repairId: string, input: RepairPartInput): Promise<RepairPart> {
    const { data, error } = await supabase
      .from('repair_parts')
      .insert({
        ...normalizePart(input),
        repair_id: repairId,
        workshop_id: undefined as unknown as string
      } satisfies TablesInsert<'repair_parts'>)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function updatePart(id: string, input: RepairPartInput): Promise<RepairPart> {
    const { data, error } = await supabase
      .from('repair_parts')
      .update(normalizePart(input))
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function removePart(id: string): Promise<void> {
    const { error } = await supabase.from('repair_parts').delete().eq('id', id)
    if (error) throw error
  }

  /** Supplier suggestions: distinct values from this workshop's own past entries, no separate wholesaler screen. */
  async function listSuppliers(): Promise<string[]> {
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const { data, error } = await supabase
      .from('repair_parts')
      .select('supplier')
      .eq('workshop_id', activeWorkshopId.value)
      .not('supplier', 'is', null)

    if (error) throw error
    return [...new Set(data.map(row => row.supplier as string))].sort((a, b) => a.localeCompare(b, 'pl'))
  }

  return { list, listOpen, getById, create, update, updateStatus, remove, addPart, updatePart, removePart, listSuppliers, activeWorkshopId }
}
