export interface WorkshopOption {
  id: string
  name: string
}

/**
 * Which workshop contexts the signed-in profile belongs to, and which one is
 * active. `active_workshop_id` is a UI-level preference (not an RLS boundary —
 * RLS already grants access to every workshop the profile is a member of) that
 * later stages use to scope reads/writes to a single context.
 */
export function useWorkshops() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const { data: workshops, refresh: refreshWorkshops } = useAsyncData<WorkshopOption[]>(
    'workshops-memberships',
    async () => {
      if (!user.value) return []

      const { data, error } = await supabase
        .from('workshop_members')
        .select('workshops(id, name)')
        .eq('profile_id', user.value.sub)

      if (error) throw error

      return (data ?? [])
        .map(row => row.workshops)
        .filter((workshop): workshop is WorkshopOption => workshop !== null)
    },
    { watch: [user], default: () => [] }
  )

  const { data: activeWorkshopId } = useAsyncData<string | null>(
    'workshops-active',
    async () => {
      if (!user.value) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('active_workshop_id')
        .eq('id', user.value.sub)
        .single()

      if (error) throw error

      return data.active_workshop_id
    },
    { watch: [user], default: () => null }
  )

  /** A profile with memberships but no saved preference yet defaults to its first workshop. */
  watch([workshops, activeWorkshopId], () => {
    if (activeWorkshopId.value) return

    const firstWorkshop = workshops.value?.[0]
    if (!firstWorkshop) return

    setActiveWorkshop(firstWorkshop.id)
  })

  async function setActiveWorkshop(workshopId: string) {
    if (!user.value || workshopId === activeWorkshopId.value) return

    const { error } = await supabase
      .from('profiles')
      .update({ active_workshop_id: workshopId })
      .eq('id', user.value.sub)

    if (error) throw error

    activeWorkshopId.value = workshopId
    await refreshNuxtData()
  }

  /** The `workshops_add_creator_as_member` DB trigger adds the caller as a member automatically. */
  async function createWorkshop(name: string): Promise<string> {
    const { data, error } = await supabase
      .from('workshops')
      .insert({ name: name.trim() })
      .select('id')
      .single()

    if (error) throw error

    await refreshWorkshops()
    await setActiveWorkshop(data.id)

    return data.id
  }

  return { workshops, activeWorkshopId, setActiveWorkshop, refreshWorkshops, createWorkshop }
}
