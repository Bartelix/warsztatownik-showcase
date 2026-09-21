<script setup lang="ts">
import type { RepairInput } from '~/composables/useRepairs'

definePageMeta({ layout: 'default' })

const route = useRoute()
const vehicleId = route.query.auto as string | undefined

if (!vehicleId) {
  throw createError({ statusCode: 400, statusMessage: 'Nie wskazano auta', fatal: true })
}

const { create } = useRepairs()
const { getById: getVehicleById } = useVehicles()

const { data: vehicle, error: vehicleError } = await useAsyncData(`repair-new-vehicle-${vehicleId}`, () => getVehicleById(vehicleId))

if (vehicleError.value) {
  throw createError({ statusCode: 503, statusMessage: 'Brak połączenia', fatal: true })
}
if (!vehicle.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono auta', fatal: true })
}

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit(payload: RepairInput) {
  errorMessage.value = ''
  loading.value = true

  try {
    await create(vehicleId!, payload)
    await navigateTo(`/auta/${vehicleId}`)
  } catch {
    errorMessage.value = 'Nie udało się zapisać naprawy. Spróbuj ponownie.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer
    v-if="vehicle"
    class="max-w-md py-6"
  >
    <UButton
      :to="`/auta/${vehicleId}`"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      {{ vehicle.make }} {{ vehicle.model }}
    </UButton>

    <h1 class="mb-6 text-2xl font-bold">
      Nowa naprawa
    </h1>

    <RepairForm
      :loading="loading"
      :last-known-mileage="vehicle.current_mileage"
      submit-label="Zapisz naprawę"
      @submit="onSubmit"
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
