<script setup lang="ts">
import type { RepairInput } from '~/composables/useRepairs'
import { repairStatusLabels, type RepairStatus } from '~/utils/labels'

definePageMeta({ layout: 'default' })

const route = useRoute()
const repairId = route.params.id as string

const { getById, update, updateStatus, remove } = useRepairs()
const { create: createReminder } = useReminders()
const { scheduleDelete } = useUndoableDelete()

const { data: repair, error: fetchError, refresh } = await useAsyncData(`repair-${repairId}`, () => getById(repairId))

if (fetchError.value) {
  throw createError({ statusCode: 503, statusMessage: 'Brak połączenia', fatal: true })
}
if (!repair.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono naprawy', fatal: true })
}

const statusOptions = Object.entries(repairStatusLabels).map(([value, label]) => ({ label, value }))

const statusLoading = ref(false)
const statusError = ref('')

async function onStatusChange(status: string | number | undefined) {
  if (!repair.value || !status || status === repair.value.status) return

  statusError.value = ''
  statusLoading.value = true

  try {
    await updateStatus(repairId, status as RepairStatus)
    await refresh()
    if (status === 'zrobione') showOilReminderPrompt.value = true
  } catch {
    statusError.value = 'Nie udało się zmienić statusu. Spróbuj ponownie.'
  } finally {
    statusLoading.value = false
  }
}

/** Nudge after marking a repair done — a shortcut past navigating to the vehicle card just to add an oil reminder. */
const showOilReminderPrompt = ref(false)
const oilReminderLoading = ref(false)
const oilReminderError = ref('')
const oilReminderAdded = ref(false)

async function addOilReminder(mode: '12m' | '15000km') {
  if (!repair.value) return

  oilReminderError.value = ''
  oilReminderLoading.value = true

  try {
    await createReminder(repair.value.vehicle_id, {
      reminder_type: 'Olej',
      due_date: mode === '12m' ? addMonths(todayIso(), 12) : null,
      due_mileage: mode === '15000km' ? (repair.value.vehicle.current_mileage ?? 0) + 15000 : null,
      note: null
    })
    showOilReminderPrompt.value = false
    oilReminderAdded.value = true
  } catch {
    oilReminderError.value = 'Nie udało się dodać przypomnienia. Spróbuj ponownie.'
  } finally {
    oilReminderLoading.value = false
  }
}

const editOpen = ref(false)
const editLoading = ref(false)
const editError = ref('')

async function onEditSubmit(payload: RepairInput) {
  editError.value = ''
  editLoading.value = true

  try {
    await update(repairId, payload)
    await refresh()
    editOpen.value = false
  } catch {
    editError.value = 'Nie udało się zapisać zmian. Spróbuj ponownie.'
  } finally {
    editLoading.value = false
  }
}

const deleteOpen = ref(false)

async function onDelete() {
  if (!repair.value) return

  deleteOpen.value = false
  const vehicleId = repair.value.vehicle_id

  scheduleDelete({
    message: 'Naprawa zostanie usunięta.',
    onCommit: () => remove(repairId)
  })

  await navigateTo(`/auta/${vehicleId}`)
}
</script>

<template>
  <UContainer
    v-if="repair"
    class="max-w-md py-6"
  >
    <UButton
      :to="`/auta/${repair.vehicle_id}`"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      {{ repair.vehicle.make }} {{ repair.vehicle.model }}
    </UButton>

    <div class="mb-6 flex items-start justify-between gap-4">
      <h1 class="text-2xl font-bold">
        {{ formatDate(repair.repair_date) }}
      </h1>

      <div class="flex shrink-0 gap-2">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="subtle"
          aria-label="Edytuj naprawę"
          @click="editOpen = true"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          aria-label="Usuń naprawę"
          @click="deleteOpen = true"
        />
      </div>
    </div>

    <UFormField
      label="Status"
      class="mb-6"
    >
      <USelect
        :model-value="repair.status"
        :items="statusOptions"
        :loading="statusLoading"
        class="w-full"
        @update:model-value="onStatusChange"
      />
    </UFormField>

    <UAlert
      v-if="statusError"
      class="mb-6"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="statusError"
    />

    <UAlert
      v-if="showOilReminderPrompt"
      class="mb-6"
      color="info"
      icon="i-lucide-bell-plus"
      title="Zrobione. Przypomnieć o oleju za?"
    >
      <template #actions>
        <UButton
          size="xs"
          :loading="oilReminderLoading"
          @click="addOilReminder('12m')"
        >
          12 miesięcy
        </UButton>
        <UButton
          size="xs"
          :loading="oilReminderLoading"
          :disabled="repair.vehicle.current_mileage == null"
          @click="addOilReminder('15000km')"
        >
          15 000 km
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          @click="showOilReminderPrompt = false"
        >
          Nie teraz
        </UButton>
      </template>
    </UAlert>

    <UAlert
      v-if="oilReminderAdded"
      class="mb-6"
      color="success"
      icon="i-lucide-check"
      title="Dodano przypomnienie o oleju."
    />

    <UAlert
      v-if="oilReminderError"
      class="mb-6"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="oilReminderError"
    />

    <p class="mb-6 whitespace-pre-line">
      {{ repair.description }}
    </p>

    <dl
      v-if="repair.mileage"
      class="mb-6 divide-y divide-default"
    >
      <div class="flex justify-between py-2">
        <dt class="text-muted">
          Przebieg
        </dt>
        <dd class="font-medium">
          {{ formatMileage(repair.mileage) }}
        </dd>
      </div>
    </dl>

    <h2 class="mb-2 text-lg font-semibold">
      Części
    </h2>

    <PartsEditor
      :repair-id="repairId"
      :parts="repair.parts"
      @change="refresh"
    />

    <p
      v-if="repair.authorName"
      class="mt-6 text-xs text-muted"
    >
      Dodał: {{ repair.authorName }}
    </p>

    <UModal
      v-model:open="editOpen"
      title="Edytuj naprawę"
    >
      <template #body>
        <RepairForm
          :initial="{
            repair_date: repair.repair_date,
            description: repair.description,
            mileage: repair.mileage,
            status: repair.status as RepairStatus
          }"
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

    <ConfirmDeleteModal
      v-model:open="deleteOpen"
      title="Usunąć naprawę?"
      @confirm="onDelete"
    />
  </UContainer>
</template>
