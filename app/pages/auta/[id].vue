<script setup lang="ts">
import type { ReminderInput } from '~/composables/useReminders'
import type { VehicleInput } from '~/composables/useVehicles'
import { repairStatusColor, repairStatusLabel } from '~/utils/labels'

definePageMeta({ layout: 'default' })

const route = useRoute()
const vehicleId = route.params.id as string

const { getById, update, reassignClient, remove } = useVehicles()
const { list: listClients } = useClients()
const { list: listRepairs } = useRepairs()
const { create: createReminder, countByVehicle: countReminders } = useReminders()
const { scheduleDelete } = useUndoableDelete()
const toast = useToast()

const { data: vehicle, error: fetchError, refresh } = await useAsyncData(`vehicle-${vehicleId}`, () => getById(vehicleId))

if (fetchError.value) {
  throw createError({ statusCode: 503, statusMessage: 'Brak połączenia', fatal: true })
}
if (!vehicle.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono auta', fatal: true })
}

const { data: repairs } = await useAsyncData(`vehicle-${vehicleId}-repairs`, () => listRepairs(vehicleId))
const { data: reminderCount } = await useAsyncData(`vehicle-${vehicleId}-reminder-count`, () => countReminders(vehicleId))

async function copyVin() {
  if (!vehicle.value?.vin) return
  await navigator.clipboard.writeText(vehicle.value.vin)
  toast.add({ title: 'Skopiowano', icon: 'i-lucide-check' })
}

const { data: clients } = await useAsyncData('vehicle-reassign-clients', () => listClients())

const clientOptions = computed(() =>
  (clients.value ?? [])
    .filter(client => client.id !== vehicle.value?.client.id)
    .map(client => ({ label: client.full_name, value: client.id }))
)

const reassignOpen = ref(false)
const reassignLoading = ref(false)
const reassignError = ref('')
const newClientId = ref('')

function openReassign() {
  newClientId.value = ''
  reassignError.value = ''
  reassignOpen.value = true
}

async function onReassign() {
  if (!newClientId.value) return

  reassignError.value = ''
  reassignLoading.value = true

  try {
    await reassignClient(vehicleId, newClientId.value)
    await refresh()
    reassignOpen.value = false
  } catch {
    reassignError.value = 'Nie udało się zmienić właściciela. Spróbuj ponownie.'
  } finally {
    reassignLoading.value = false
  }
}

const editOpen = ref(false)
const editLoading = ref(false)
const editError = ref('')

async function onEditSubmit(payload: VehicleInput) {
  editError.value = ''
  editLoading.value = true

  try {
    await update(vehicleId, payload)
    await refresh()
    editOpen.value = false
  } catch {
    editError.value = 'Nie udało się zapisać zmian. Spróbuj ponownie.'
  } finally {
    editLoading.value = false
  }
}

const deleteOpen = ref(false)

const deleteDescription = computed(() => {
  const counts = [
    repairs.value?.length ? formatRepairCount(repairs.value.length) : null,
    reminderCount.value ? formatReminderCount(reminderCount.value) : null
  ].filter((count): count is string => count !== null)

  if (!counts.length) return 'Zostanie usunięte po kilku sekundach — można to cofnąć.'
  return `Zostaną też usunięte: ${counts.join(' i ')}. Można to cofnąć przez kilka sekund.`
})

async function onDelete() {
  if (!vehicle.value) return

  deleteOpen.value = false
  const clientId = vehicle.value.client.id

  scheduleDelete({
    message: 'Auto zostanie usunięte.',
    onCommit: () => remove(vehicleId)
  })

  await navigateTo(`/klienci/${clientId}`)
}

const reminderOpen = ref(false)
const reminderLoading = ref(false)
const reminderError = ref('')

async function onReminderSubmit(payload: ReminderInput) {
  if (!vehicle.value) return

  reminderError.value = ''
  reminderLoading.value = true

  try {
    await createReminder(vehicleId, payload)
    reminderOpen.value = false
    toast.add({ title: 'Dodano przypomnienie', icon: 'i-lucide-check' })
  } catch {
    reminderError.value = 'Nie udało się dodać przypomnienia. Spróbuj ponownie.'
  } finally {
    reminderLoading.value = false
  }
}
</script>

<template>
  <UContainer
    v-if="vehicle"
    class="max-w-md py-6"
  >
    <UButton
      :to="`/klienci/${vehicle.client.id}`"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      {{ vehicle.client.full_name }}
    </UButton>

    <div class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold">
          {{ vehicle.make }} {{ vehicle.model }}
        </h1>
        <p
          v-if="vehicle.year || vehicle.engine"
          class="mt-1 text-muted"
        >
          <span v-if="vehicle.year">{{ vehicle.year }}</span>
          <span v-if="vehicle.year && vehicle.engine"> · </span>
          <span v-if="vehicle.engine">{{ vehicle.engine }}</span>
        </p>
      </div>

      <div class="flex shrink-0 gap-2">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="subtle"
          aria-label="Edytuj auto"
          @click="editOpen = true"
        />
        <UButton
          icon="i-lucide-user-round-cog"
          color="neutral"
          variant="subtle"
          aria-label="Przepisz auto na innego klienta"
          @click="openReassign"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          aria-label="Usuń auto"
          @click="deleteOpen = true"
        />
      </div>
    </div>

    <div class="mb-6 rounded-lg border-2 border-primary bg-primary/5 p-4">
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        VIN
      </p>
      <button
        type="button"
        class="mt-1 flex w-full items-center justify-between gap-2 text-left font-mono text-lg tracking-wide"
        :disabled="!vehicle.vin"
        @click="copyVin"
      >
        <span>{{ vehicle.vin ?? '—' }}</span>
        <UIcon
          v-if="vehicle.vin"
          name="i-lucide-copy"
          class="shrink-0 text-muted"
        />
      </button>
    </div>

    <dl class="mb-6 divide-y divide-default">
      <div class="flex justify-between py-2">
        <dt class="text-muted">
          Właściciel
        </dt>
        <dd>
          <NuxtLink
            :to="`/klienci/${vehicle.client.id}`"
            class="font-medium text-primary"
          >
            {{ vehicle.client.full_name }}
          </NuxtLink>
        </dd>
      </div>
      <div class="flex justify-between py-2">
        <dt class="text-muted">
          Rejestracja
        </dt>
        <dd class="font-medium">
          {{ vehicle.plate ?? '—' }}
        </dd>
      </div>
      <div class="flex justify-between py-2">
        <dt class="text-muted">
          Przebieg
        </dt>
        <dd class="font-medium">
          {{ formatMileage(vehicle.current_mileage) }}
        </dd>
      </div>
    </dl>

    <p
      v-if="vehicle.notes"
      class="mb-6 whitespace-pre-line text-muted"
    >
      {{ vehicle.notes }}
    </p>

    <div class="mb-2 flex items-center justify-between gap-2">
      <h2 class="text-lg font-semibold">
        Historia napraw
      </h2>
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-bell-plus"
          size="sm"
          variant="subtle"
          color="neutral"
          @click="reminderOpen = true"
        >
          Przypomnienie
        </UButton>
        <UButton
          :to="`/naprawy/nowa?auto=${vehicle.id}`"
          icon="i-lucide-plus"
          size="sm"
          variant="subtle"
        >
          Nowa naprawa
        </UButton>
      </div>
    </div>
    <p
      v-if="!repairs?.length"
      class="text-muted"
    >
      Brak napraw.
    </p>

    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="repair in repairs"
        :key="repair.id"
      >
        <NuxtLink
          :to="`/naprawy/${repair.id}`"
          class="flex items-start justify-between gap-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="font-medium">
                {{ formatDate(repair.repair_date) }}
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
            <p class="mt-0.5 text-sm text-muted">
              {{ repair.description }}
            </p>
            <p
              v-if="repair.mileage"
              class="mt-0.5 text-sm text-muted"
            >
              {{ formatMileage(repair.mileage) }}
            </p>
            <p
              v-if="repair.parts.length"
              class="mt-1 text-sm text-muted"
            >
              Części: {{ repair.parts.map(part => part.name).join(', ') }}
            </p>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="mt-1 shrink-0 text-muted"
          />
        </NuxtLink>
      </li>
    </ul>

    <UModal
      v-model:open="editOpen"
      title="Edytuj auto"
    >
      <template #body>
        <VehicleForm
          :initial="{
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            engine: vehicle.engine,
            vin: vehicle.vin,
            plate: vehicle.plate,
            current_mileage: vehicle.current_mileage,
            notes: vehicle.notes
          }"
          :exclude-id="vehicleId"
          :loading="editLoading"
          submit-label="Zapisz zmiany"
          @submit="onEditSubmit"
        />

        <UAlert
          v-if="editError"
          class="mt-4"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="editError"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="reassignOpen"
      title="Przepisz auto na innego klienta"
    >
      <template #body>
        <UFormField
          label="Nowy właściciel"
          required
        >
          <USelect
            v-model="newClientId"
            :items="clientOptions"
            placeholder="Wybierz klienta"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="reassignError"
          class="mt-4"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="reassignError"
        />

        <div class="mt-4 flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="reassignOpen = false"
          >
            Anuluj
          </UButton>
          <UButton
            :loading="reassignLoading"
            :disabled="!newClientId"
            @click="onReassign"
          >
            Przepisz
          </UButton>
        </div>
      </template>
    </UModal>

    <ConfirmDeleteModal
      v-model:open="deleteOpen"
      title="Usunąć auto?"
      :description="deleteDescription"
      @confirm="onDelete"
    />

    <UModal
      v-model:open="reminderOpen"
      title="Nowe przypomnienie"
    >
      <template #body>
        <ReminderForm
          :current-mileage="vehicle.current_mileage"
          :loading="reminderLoading"
          submit-label="Zapisz przypomnienie"
          @submit="onReminderSubmit"
        />

        <UAlert
          v-if="reminderError"
          class="mt-4"
          color="error"
          icon="i-lucide-triangle-alert"
          :title="reminderError"
        />
      </template>
    </UModal>
  </UContainer>
</template>
