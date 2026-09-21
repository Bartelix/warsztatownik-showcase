<script setup lang="ts">
import type { ReminderWithVehicle } from '~/composables/useReminders'
import type { ReminderStatus } from '~/utils/labels'

definePageMeta({ layout: 'default' })

const { listActive, updateStatus, remove, activeWorkshopId } = useReminders()
const { scheduleDelete } = useUndoableDelete()

const { data: reminders, status, error, refresh } = await useAsyncData(
  'reminders-active',
  () => listActive(),
  { watch: [activeWorkshopId] }
)

/** Hides a reminder the moment its delete is confirmed, without waiting for the undo window to pass. */
const pendingDeleteIds = ref(new Set<string>())
const visibleReminders = computed(() => reminders.value?.filter(reminder => !pendingDeleteIds.value.has(reminder.id)))

const statusUpdatingId = ref<string | null>(null)
const actionError = ref('')

async function onStatusChange(id: string, newStatus: ReminderStatus) {
  actionError.value = ''
  statusUpdatingId.value = id

  try {
    await updateStatus(id, newStatus)
    await refresh()
  } catch {
    actionError.value = 'Nie udało się zaktualizować przypomnienia. Spróbuj ponownie.'
  } finally {
    statusUpdatingId.value = null
  }
}

function vehicleLabel(reminder: ReminderWithVehicle): string {
  return `${reminder.vehicle.make} ${reminder.vehicle.model ?? ''}`.trim()
}

const deleteTarget = ref<ReminderWithVehicle | null>(null)
const deleteOpen = ref(false)

function openDelete(reminder: ReminderWithVehicle) {
  deleteTarget.value = reminder
  deleteOpen.value = true
}

function onDelete() {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id

  deleteOpen.value = false
  pendingDeleteIds.value.add(id)

  scheduleDelete({
    message: 'Przypomnienie zostanie usunięte.',
    onCommit: async () => {
      await remove(id)
      pendingDeleteIds.value.delete(id)
      await refresh()
    },
    onCancel: () => pendingDeleteIds.value.delete(id)
  })
}
</script>

<template>
  <UContainer class="py-6">
    <h1 class="mb-4 text-2xl font-bold">
      Przypomnienia
    </h1>

    <div
      v-if="status === 'pending'"
      class="py-12 text-center text-muted"
    >
      Wczytywanie…
    </div>

    <LoadErrorAlert
      v-else-if="error"
      action="wczytać przypomnień"
    />

    <UAlert
      v-else-if="!visibleReminders?.length"
      icon="i-lucide-bell-off"
      title="Brak aktywnych przypomnień."
    />

    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="reminder in visibleReminders"
        :key="reminder.id"
        class="py-3"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p
              class="font-medium"
              :class="{ 'text-error': isReminderDue(reminder, reminder.vehicle.current_mileage) }"
            >
              {{ reminderDueSummary(reminder) }}
            </p>
            <p class="mt-0.5 truncate">
              {{ reminder.reminder_type }}
            </p>
            <p class="mt-0.5 truncate text-sm text-muted">
              <NuxtLink
                :to="`/auta/${reminder.vehicle.id}`"
                class="text-primary"
              >
                {{ vehicleLabel(reminder) }}
              </NuxtLink>
              · {{ reminder.vehicle.client.full_name }}
            </p>
            <p
              v-if="reminder.note"
              class="mt-0.5 text-sm text-muted"
            >
              {{ reminder.note }}
            </p>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-1">
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              aria-label="Usuń przypomnienie"
              @click="openDelete(reminder)"
            />
            <UButton
              size="xs"
              color="success"
              variant="subtle"
              :loading="statusUpdatingId === reminder.id"
              @click="onStatusChange(reminder.id, 'zrealizowane')"
            >
              Zrealizowane
            </UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="subtle"
              :loading="statusUpdatingId === reminder.id"
              @click="onStatusChange(reminder.id, 'anulowane')"
            >
              Anuluj
            </UButton>
          </div>
        </div>
      </li>
    </ul>

    <UAlert
      v-if="actionError"
      class="mt-4"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="actionError"
    />

    <ConfirmDeleteModal
      v-model:open="deleteOpen"
      title="Usunąć przypomnienie?"
      @confirm="onDelete"
    />
  </UContainer>
</template>
