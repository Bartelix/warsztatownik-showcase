<script setup lang="ts">
import type { AppointmentInput } from '~/composables/useAppointments'

definePageMeta({ layout: 'default' })

const route = useRoute()
const clientIdFromQuery = route.query.klient as string | undefined
const dateFromQuery = route.query.data as string | undefined

const { create } = useAppointments()
const { getById: getClientById, list: listClients } = useClients()

const { data: presetClient, error: presetClientError } = await useAsyncData(
  `appointment-new-client-${clientIdFromQuery ?? 'none'}`,
  () => clientIdFromQuery ? getClientById(clientIdFromQuery) : Promise.resolve(null)
)

if (clientIdFromQuery && presetClientError.value) {
  throw createError({ statusCode: 503, statusMessage: 'Brak połączenia', fatal: true })
}
if (clientIdFromQuery && !presetClient.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono klienta', fatal: true })
}

const { data: clients } = await useAsyncData(
  'appointment-new-clients-list',
  () => clientIdFromQuery ? Promise.resolve([]) : listClients()
)

const backTo = computed(() => clientIdFromQuery ? `/klienci/${clientIdFromQuery}` : '/terminarz')
const backLabel = computed(() => presetClient.value?.full_name ?? 'Terminarz')

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit(payload: AppointmentInput) {
  errorMessage.value = ''
  loading.value = true

  try {
    await create(payload)
    await navigateTo(`/terminarz?data=${payload.appointment_date}`)
  } catch {
    errorMessage.value = 'Nie udało się zapisać wizyty. Spróbuj ponownie.'
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
      Nowa wizyta
    </h1>
    <p
      v-if="presetClient"
      class="mb-6 text-muted"
    >
      Klient: <span class="font-medium text-default">{{ presetClient.full_name }}</span>
    </p>

    <AppointmentForm
      :preset-client="presetClient"
      :clients="clients ?? []"
      :preset-date="dateFromQuery"
      :loading="loading"
      submit-label="Zapisz wizytę"
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
