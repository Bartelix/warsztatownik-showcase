import type { Client } from '~/composables/useClients'
import type { Repair } from '~/composables/useRepairs'
import type { VehicleWithClient } from '~/composables/useVehicles'

export interface RepairSearchResult extends Repair {
  vehicle: VehicleWithClient
}

export interface SearchResults {
  clients: Client[]
  vehicles: VehicleWithClient[]
  repairs: RepairSearchResult[]
}

export const emptySearchResults: SearchResults = { clients: [], vehicles: [], repairs: [] }

/** Escapes characters that are structural in PostgREST's `.or()` filter list syntax. */
function escapeFilterValue(value: string): string {
  return value.replace(/[,()]/g, char => `\\${char}`)
}

export function useSearch() {
  const supabase = useSupabaseClient()
  const { activeWorkshopId } = useWorkshops()

  async function search(query: string): Promise<SearchResults> {
    const trimmed = query.trim()
    if (!trimmed) return emptySearchResults
    if (!activeWorkshopId.value) throw new Error('Brak aktywnego warsztatu')

    const pattern = `%${escapeFilterValue(trimmed)}%`
    // .ilike() takes the value as a single query param, not part of an .or() list — no structural escaping needed.
    const rawPattern = `%${trimmed}%`

    const [clientsResult, vehiclesResult, repairsResult, partsResult] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .eq('workshop_id', activeWorkshopId.value)
        .or(`full_name.ilike.${pattern},phone.ilike.${pattern}`)
        .order('full_name'),
      supabase
        .from('vehicles')
        .select('*, client:clients(*)')
        .eq('workshop_id', activeWorkshopId.value)
        .or(`plate.ilike.${pattern},vin.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('repairs')
        .select('*, vehicle:vehicles(*, client:clients(*))')
        .eq('workshop_id', activeWorkshopId.value)
        .ilike('description', rawPattern)
        .order('repair_date', { ascending: false }),
      supabase
        .from('repair_parts')
        .select('repair:repairs(*, vehicle:vehicles(*, client:clients(*)))')
        .eq('workshop_id', activeWorkshopId.value)
        .ilike('catalog_number', rawPattern)
    ])

    if (clientsResult.error) throw clientsResult.error
    if (vehiclesResult.error) throw vehiclesResult.error
    if (repairsResult.error) throw repairsResult.error
    if (partsResult.error) throw partsResult.error

    const repairs = new Map<string, RepairSearchResult>()
    for (const repair of (repairsResult.data ?? []) as unknown as RepairSearchResult[]) {
      repairs.set(repair.id, repair)
    }
    for (const row of partsResult.data ?? []) {
      const repair = row.repair as unknown as RepairSearchResult | null
      if (repair) repairs.set(repair.id, repair)
    }

    return {
      clients: clientsResult.data ?? [],
      vehicles: (vehiclesResult.data ?? []) as unknown as VehicleWithClient[],
      repairs: [...repairs.values()].sort((a, b) => b.repair_date.localeCompare(a.repair_date))
    }
  }

  return { search }
}
