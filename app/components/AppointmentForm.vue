<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { ClientListItem, ClientWithVehicles } from '~/composables/useClients'
import type { Vehicle } from '~/composables/useVehicles'
import type { AppointmentInput } from '~/composables/useAppointments'

const props = defineProps<{
  /** Set when navigating from a client's card — locks the entry to this client, hides the toggle and picker. */
  presetClient?: ClientWithVehicles | null
  clients?: ClientListItem[]
  presetDate?: string
  loading?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: AppointmentInput]
}>()

const mode = ref<'client' | 'custom'>('client')

const clientOptions = computed(() =>
  (props.clients ?? []).map(client => ({ label: client.full_name, value: client.id }))
)

const state = reactive({
  appointment_date: props.presetDate ?? todayIso(),
  appointment_time: '',
  client_id: props.presetClient?.id ?? '',
  vehicle_id: '',
  title: '',
  note: ''
})

const clientVehicles = ref<Vehicle[]>(props.presetClient?.vehicles ?? [])
const loadingVehicles = ref(false)
const vehiclesError = ref('')

const { getById: getClientById } = useClients()

/** Vehicle list follows the chosen client — restricted to that client's own vehicles. */
let vehiclesRequestId = 0
watch(() => state.client_id, async (clientId) => {
  state.vehicle_id = ''
  vehiclesError.value = ''
  const requestId = ++vehiclesRequestId

  if (!clientId) {
    clientVehicles.value = []
    return
  }

  if (props.presetClient?.id === clientId) {
    clientVehicles.value = props.presetClient.vehicles
    return
  }

  loadingVehicles.value = true
  try {
    const client = await getClientById(clientId)
    if (requestId !== vehiclesRequestId) return
    clientVehicles.value = client?.vehicles ?? []
  } catch {
    if (requestId !== vehiclesRequestId) return
    clientVehicles.value = []
    vehiclesError.value = 'Nie udało się wczytać aut klienta.'
  } finally {
    if (requestId === vehiclesRequestId) loadingVehicles.value = false
  }
})

const vehicleOptions = computed(() =>
  clientVehicles.value.map(vehicle => ({ label: `${vehicle.make} ${vehicle.model ?? ''}`.trim(), value: vehicle.id }))
)

function validate(state: { client_id: string, title: string }): FormError[] {
  const errors: FormError[] = []
  if (mode.value === 'client' && !state.client_id) errors.push({ name: 'client_id', message: 'Wybierz klienta' })
  if (mode.value === 'custom' && !state.title.trim()) errors.push({ name: 'title', message: 'Podaj tytuł wpisu' })
  return errors
}

function onSubmit(event: FormSubmitEvent<typeof state>) {
  emit('submit', {
    appointment_date: event.data.appointment_date,
    appointment_time: event.data.appointment_time || null,
    client_id: mode.value === 'client' ? event.data.client_id : null,
    vehicle_id: mode.value === 'client' ? (event.data.vehicle_id || null) : null,
    title: mode.value === 'custom' ? event.data.title : null,
    note: event.data.note
  })
}
</script>

<template>
  <UForm
    :state="state"
    :validate="validate"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UButtonGroup
      v-if="!presetClient"
      class="w-full"
    >
      <UButton
        :variant="mode === 'client' ? 'solid' : 'outline'"
        color="neutral"
        block
        @click="mode = 'client'"
      >
        Klient
      </UButton>
      <UButton
        :variant="mode === 'custom' ? 'solid' : 'outline'"
        color="neutral"
        block
        @click="mode = 'custom'"
      >
        Wpis własny
      </UButton>
    </UButtonGroup>

    <UFormField
      v-if="mode === 'client' && !presetClient"
      label="Klient"
      name="client_id"
      required
    >
      <UInputMenu
        v-model="state.client_id"
        :items="clientOptions"
        value-key="value"
        placeholder="Szukaj klienta…"
        class="w-full"
      />
    </UFormField>

    <template v-if="mode === 'client'">
      <UFormField
        v-if="vehicleOptions.length"
        label="Auto"
        name="vehicle_id"
        hint="Opcjonalnie"
      >
        <USelect
          v-model="state.vehicle_id"
          :items="vehicleOptions"
          :loading="loadingVehicles"
          placeholder="Wybierz auto"
          class="w-full"
        />
      </UFormField>
      <p
        v-else-if="vehiclesError"
        class="text-sm text-error"
      >
        {{ vehiclesError }}
      </p>
      <p
        v-else-if="state.client_id && !loadingVehicles"
        class="text-sm text-muted"
      >
        Klient nie ma jeszcze żadnego auta.
      </p>
    </template>

    <UFormField
      v-if="mode === 'custom'"
      label="Tytuł wpisu"
      name="title"
      required
    >
      <UInput
        v-model="state.title"
        class="w-full"
        placeholder="np. urlop, odbiór części o 12"
      />
    </UFormField>

    <div class="grid grid-cols-2 gap-4">
      <UFormField
        label="Data"
        name="appointment_date"
        required
      >
        <UInput
          v-model="state.appointment_date"
          type="date"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Godzina"
        name="appointment_time"
        hint="Opcjonalnie"
      >
        <UInput
          v-model="state.appointment_time"
          type="time"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      label="Notatka"
      name="note"
    >
      <UTextarea
        v-model="state.note"
        class="w-full"
        :rows="3"
      />
    </UFormField>

    <UButton
      type="submit"
      :loading="loading"
      block
    >
      {{ submitLabel ?? 'Zapisz' }}
    </UButton>
  </UForm>
</template>
