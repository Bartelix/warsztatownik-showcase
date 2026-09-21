<script setup lang="ts">
import type { VehicleInput } from '~/composables/useVehicles'

definePageMeta({ layout: 'default' })

const route = useRoute()
const clientIdFromQuery = route.query.klient as string | undefined

const { create } = useVehicles()
const { getById: getClientById, list: listClients } = useClients()

const { data: presetClient, error: presetClientError } = await useAsyncData(
  `vehicle-new-client-${clientIdFromQuery ?? 'none'}`,
  () => clientIdFromQuery ? getClientById(clientIdFromQuery) : Promise.resolve(null)
)

if (clientIdFromQuery && presetClientError.value) {
  throw createError({ statusCode: 503, statusMessage: 'Brak połączenia', fatal: true })
}
if (clientIdFromQuery && !presetClient.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono klienta', fatal: true })
}

const { data: clients } = await useAsyncData(
  'vehicle-new-clients-list',
  () => clientIdFromQuery ? Promise.resolve([]) : listClients()
)

const clientOptions = computed(() =>
  (clients.value ?? []).map(client => ({ label: client.full_name, value: client.id }))
)

const selectedClientId = ref(clientIdFromQuery ?? '')

const backTo = computed(() => clientIdFromQuery ? `/klienci/${clientIdFromQuery}` : '/klienci')
const backLabel = computed(() => presetClient.value?.full_name ?? 'Klienci')

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit(payload: VehicleInput) {
  if (!selectedClientId.value) return

  errorMessage.value = ''
  loading.value = true

  try {
    const vehicle = await create(selectedClientId.value, payload)
    await navigateTo(`/auta/${vehicle.id}`)
  } catch {
    errorMessage.value = 'Nie udało się zapisać auta. Spróbuj ponownie.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-md py-6">
    <UButton
      :to="backTo"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      {{ backLabel }}
    </UButton>

    <h1 class="mb-2 text-2xl font-bold">
      Nowe auto
    </h1>
    <p
      v-if="presetClient"
      class="mb-6 text-muted"
    >
      Klient: <span class="font-medium text-default">{{ presetClient.full_name }}</span>
    </p>

    <UFormField
      v-if="!clientIdFromQuery"
      label="Klient"
      required
      class="mb-6"
    >
      <USelect
        v-model="selectedClientId"
        :items="clientOptions"
        placeholder="Wybierz klienta"
        class="w-full"
      />
    </UFormField>

    <VehicleForm
      v-if="selectedClientId"
      :loading="loading"
      submit-label="Dodaj auto"
      @submit="onSubmit"
    />
    <UAlert
      v-else
      icon="i-lucide-info"
      title="Wybierz klienta, aby dodać auto."
    />

    <UAlert
      v-if="errorMessage"
      class="mt-4"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="errorMessage"
    />
  </UContainer>
</template>
