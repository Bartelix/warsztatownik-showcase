<script setup lang="ts">
import { emptySearchResults, type SearchResults } from '~/composables/useSearch'
import { repairStatusColor, repairStatusLabel } from '~/utils/labels'

definePageMeta({ layout: 'default' })

const { search } = useSearch()

const searchText = ref('')
const results = ref<SearchResults>(emptySearchResults)
const searching = ref(false)
const searched = ref(false)
const searchError = ref(false)

let debounceTimer: ReturnType<typeof setTimeout>
let requestId = 0

async function runSearch(query: string) {
  if (!query) {
    results.value = emptySearchResults
    searching.value = false
    searched.value = false
    searchError.value = false
    return
  }

  searching.value = true
  searchError.value = false
  const currentRequest = ++requestId

  try {
    const data = await search(query)
    if (currentRequest !== requestId) return
    results.value = data
    searched.value = true
  } catch {
    if (currentRequest !== requestId) return
    results.value = emptySearchResults
    searched.value = false
    searchError.value = true
  } finally {
    if (currentRequest === requestId) searching.value = false
  }
}

watch(searchText, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runSearch(value.trim()), 300)
})

onUnmounted(() => clearTimeout(debounceTimer))
</script>

<template>
  <UContainer class="py-6">
    <h1 class="mb-4 text-2xl font-bold">
      Szukaj
    </h1>

    <UInput
      v-model="searchText"
      icon="i-lucide-search"
      placeholder="Numer rejestracyjny, nazwisko, telefon, VIN…"
      autofocus
      class="w-full"
      size="lg"
    />

    <div
      v-if="searching"
      class="py-12 text-center text-muted"
    >
      Szukanie…
    </div>

    <LoadErrorAlert
      v-else-if="searchError"
      class="mt-6"
      action="wyszukać"
    />

    <template v-else-if="searched">
      <UAlert
        v-if="!results.clients.length && !results.vehicles.length && !results.repairs.length"
        class="mt-6"
        icon="i-lucide-search-x"
        title="Brak wyników."
        :description="`Nic nie znaleziono dla „${searchText.trim()}”.`"
      />

      <template v-else>
        <div
          v-if="results.clients.length"
          class="mt-6"
        >
          <h2 class="mb-2 text-lg font-semibold">
            Klienci
          </h2>
          <ul class="divide-y divide-default">
            <li
              v-for="client in results.clients"
              :key="client.id"
            >
              <NuxtLink
                :to="`/klienci/${client.id}`"
                class="flex items-center gap-3 py-3"
              >
                <UIcon
                  name="i-lucide-user"
                  class="shrink-0 text-muted"
                />
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ client.full_name }}
                  </p>
                  <p
                    v-if="client.phone"
                    class="text-sm text-muted"
                  >
                    {{ formatPhone(client.phone) }}
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div
          v-if="results.vehicles.length"
          class="mt-6"
        >
          <h2 class="mb-2 text-lg font-semibold">
            Auta
          </h2>
          <ul class="divide-y divide-default">
            <li
              v-for="vehicle in results.vehicles"
              :key="vehicle.id"
            >
              <NuxtLink
                :to="`/auta/${vehicle.id}`"
                class="flex items-center gap-3 py-3"
              >
                <UIcon
                  name="i-lucide-car"
                  class="shrink-0 text-muted"
                />
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ vehicle.make }} {{ vehicle.model }}
                  </p>
                  <p class="truncate text-sm text-muted">
                    <span v-if="vehicle.plate">{{ vehicle.plate }}</span>
                    <span v-if="vehicle.plate && vehicle.client"> · </span>
                    <span v-if="vehicle.client">{{ vehicle.client.full_name }}</span>
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div
          v-if="results.repairs.length"
          class="mt-6"
        >
          <h2 class="mb-2 text-lg font-semibold">
            Naprawy
          </h2>
          <ul class="divide-y divide-default">
            <li
              v-for="repair in results.repairs"
              :key="repair.id"
            >
              <NuxtLink
                :to="`/naprawy/${repair.id}`"
                class="flex items-center gap-3 py-3"
              >
                <UIcon
                  name="i-lucide-wrench"
                  class="shrink-0 text-muted"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="truncate font-medium">
                      {{ repair.vehicle.make }} {{ repair.vehicle.model }}
                    </p>
                    <UBadge
                      v-if="repair.status !== 'zrobione'"
                      :color="repairStatusColor(repair.status)"
                      variant="subtle"
                      size="sm"
                    >
                      {{ repairStatusLabel(repair.status) }}
                    </UBadge>
                  </div>
                  <p class="truncate text-sm text-muted">
                    {{ formatDate(repair.repair_date) }} · {{ repair.vehicle.client.full_name }}
                  </p>
                  <p class="truncate text-sm text-muted">
                    {{ repair.description }}
                  </p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </UContainer>
</template>
