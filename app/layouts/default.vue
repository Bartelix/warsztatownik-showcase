<script setup lang="ts">
const supabase = useSupabaseClient()
const { workshops, activeWorkshopId, setActiveWorkshop, createWorkshop } = useWorkshops()
const { isOnline } = useNetworkStatus()

const workshopOptions = computed(() =>
  (workshops.value ?? []).map(workshop => ({ label: workshop.name, value: workshop.id }))
)

const newWorkshopOpen = ref(false)
const newWorkshopName = ref('')
const newWorkshopLoading = ref(false)
const newWorkshopError = ref('')

async function onCreateWorkshop() {
  if (!newWorkshopName.value.trim()) return

  newWorkshopError.value = ''
  newWorkshopLoading.value = true

  try {
    await createWorkshop(newWorkshopName.value)
    newWorkshopOpen.value = false
    newWorkshopName.value = ''
  } catch {
    newWorkshopError.value = 'Nie udało się utworzyć warsztatu. Spróbuj ponownie.'
  } finally {
    newWorkshopLoading.value = false
  }
}

const navItems = [
  { label: 'Pulpit', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Klienci', icon: 'i-lucide-users', to: '/klienci' },
  { label: 'Terminarz', icon: 'i-lucide-calendar-days', to: '/terminarz' },
  { label: 'Przypomnienia', icon: 'i-lucide-bell', to: '/przypomnienia' }
]

async function handleLogout() {
  await supabase.auth.signOut()
  await navigateTo('/logowanie')
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <p
      v-if="!isOnline"
      class="bg-error px-4 py-2 text-center text-sm font-medium text-inverted"
    >
      Brak połączenia z internetem
    </p>

    <header
      class="sticky top-0 z-10 flex items-center justify-between border-b border-default bg-default py-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <NuxtLink
        to="/"
        aria-label="Warsztatownik"
      >
        <img
          src="/images/warsztatownik-icon.svg"
          alt=""
          class="size-8 rounded-md"
        >
      </NuxtLink>

      <div class="flex min-w-0 items-center gap-2">
        <USelect
          v-if="workshopOptions.length > 0"
          :model-value="activeWorkshopId ?? undefined"
          :items="workshopOptions"
          :disabled="workshopOptions.length === 1"
          :ui="{ base: 'w-auto max-w-32', content: 'w-auto min-w-(--reka-select-trigger-width)' }"
          @update:model-value="(value) => setActiveWorkshop(value as string)"
        />

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-briefcase"
          aria-label="Nowy warsztat"
          @click="newWorkshopOpen = true"
        />

        <UButton
          to="/szukaj"
          color="neutral"
          variant="ghost"
          icon="i-lucide-search"
          aria-label="Szukaj"
        />

        <UColorModeSwitch />

        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          aria-label="Wyloguj"
          @click="handleLogout"
        />
      </div>
    </header>

    <main class="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-10 flex border-t border-default bg-default pb-[env(safe-area-inset-bottom)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))]"
    >
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted"
        active-class="text-primary"
      >
        <UIcon
          :name="item.icon"
          class="size-5"
        />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <UModal
      v-model:open="newWorkshopOpen"
      title="Nowy warsztat"
    >
      <template #body>
        <UInput
          v-model="newWorkshopName"
          placeholder="np. Praca, Garaż"
          autofocus
          @keyup.enter="onCreateWorkshop"
        />

        <UAlert
          v-if="newWorkshopError"
          class="mt-4"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="newWorkshopError"
        />

        <div class="mt-4 flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="newWorkshopOpen = false"
          >
            Anuluj
          </UButton>
          <UButton
            :loading="newWorkshopLoading"
            :disabled="!newWorkshopName.trim()"
            @click="onCreateWorkshop"
          >
            Utwórz
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
