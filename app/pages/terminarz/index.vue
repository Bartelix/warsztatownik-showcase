<script setup lang="ts">
import type { AppointmentWithClient } from '~/composables/useAppointments'
import { appointmentStatusColor, appointmentStatusLabel, type AppointmentStatus } from '~/utils/labels'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const selectedDate = ref((route.query.data as string) || todayIso())

watch(selectedDate, (value) => {
  router.replace({ query: { ...route.query, data: value } })
})

const yesterday = computed(() => addDays(todayIso(), -1))
const today = computed(() => todayIso())
const tomorrow = computed(() => addDays(todayIso(), 1))

const { listByDate, updateStatus, remove, activeWorkshopId } = useAppointments()
const { scheduleDelete } = useUndoableDelete()

const { data: appointments, status, error, refresh } = await useAsyncData(
  'terminarz-day',
  () => listByDate(selectedDate.value),
  { watch: [selectedDate, activeWorkshopId] }
)

/** Hides an appointment the moment its delete is confirmed, without waiting for the undo window to pass. */
const pendingDeleteIds = ref(new Set<string>())
const visibleAppointments = computed(() => appointments.value?.filter(appointment => !pendingDeleteIds.value.has(appointment.id)))

const statusUpdatingId = ref<string | null>(null)
const statusError = ref('')

async function onStatusChange(id: string, newStatus: AppointmentStatus) {
  statusError.value = ''
  statusUpdatingId.value = id

  try {
    await updateStatus(id, newStatus)
    await refresh()
  } catch {
    statusError.value = 'Nie udało się zmienić statusu. Spróbuj ponownie.'
  } finally {
    statusUpdatingId.value = null
  }
}

function vehicleLabel(appointment: AppointmentWithClient): string {
  if (!appointment.vehicle) return ''
  return `${appointment.vehicle.make} ${appointment.vehicle.model ?? ''}`.trim()
}

const deleteTarget = ref<AppointmentWithClient | null>(null)
const deleteOpen = ref(false)

function openDelete(appointment: AppointmentWithClient) {
  deleteTarget.value = appointment
  deleteOpen.value = true
}

function onDelete() {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id

  deleteOpen.value = false
  pendingDeleteIds.value.add(id)

  scheduleDelete({
    message: 'Wizyta zostanie usunięta.',
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
    <div class="mb-4 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold">
        Terminarz
      </h1>
      <UButton
        :to="`/terminarz/nowa?data=${selectedDate}`"
        icon="i-lucide-plus"
        size="sm"
      >
        Nowa wizyta
      </UButton>
    </div>

    <div class="mb-2 flex flex-wrap items-center gap-2">
      <UButton
        :variant="selectedDate === yesterday ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        @click="selectedDate = yesterday"
      >
        Wczoraj
      </UButton>
      <UButton
        :variant="selectedDate === today ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        @click="selectedDate = today"
      >
        Dziś
      </UButton>
      <UButton
        :variant="selectedDate === tomorrow ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        @click="selectedDate = tomorrow"
      >
        Jutro
      </UButton>
      <UInput
        v-model="selectedDate"
        type="date"
        size="sm"
        class="ml-auto w-40"
      />
    </div>

    <p class="mb-4 text-sm text-muted">
      {{ formatDate(selectedDate) }}
    </p>

    <div
      v-if="status === 'pending'"
      class="py-12 text-center text-muted"
    >
      Wczytywanie…
    </div>

    <LoadErrorAlert
      v-else-if="error"
      action="wczytać terminarza"
    />

    <UAlert
      v-else-if="!visibleAppointments?.length"
      icon="i-lucide-calendar-x"
      title="Brak wizyt tego dnia."
    />

    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="appointment in visibleAppointments"
        :key="appointment.id"
        class="py-3"
      >
        <div class="flex items-start justify-between gap-4">
          <div
            class="min-w-0 flex-1"
            :class="{ 'opacity-50 line-through': appointment.status === 'odwolana' }"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">
                {{ appointment.appointment_time ? formatTime(appointment.appointment_time) : 'Bez godziny' }}
              </span>
              <UBadge
                :color="appointmentStatusColor(appointment.status)"
                variant="subtle"
                size="sm"
              >
                {{ appointmentStatusLabel(appointment.status) }}
              </UBadge>
              <UBadge
                v-if="!appointment.client"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                Wpis własny
              </UBadge>
            </div>

            <p class="mt-0.5 truncate">
              <NuxtLink
                v-if="appointment.client"
                :to="`/klienci/${appointment.client.id}`"
                class="font-medium text-primary"
              >
                {{ appointment.client.full_name }}
              </NuxtLink>
              <span
                v-else
                class="font-medium"
              >
                {{ appointment.title }}
              </span>
            </p>

            <p
              v-if="appointment.vehicle"
              class="mt-0.5 text-sm text-muted"
            >
              {{ vehicleLabel(appointment) }}
            </p>

            <p
              v-if="appointment.note"
              class="mt-0.5 text-sm text-muted"
            >
              {{ appointment.note }}
            </p>

            <div
              v-if="appointment.vehicle"
              class="mt-2 flex gap-2"
            >
              <UButton
                :to="`/auta/${appointment.vehicle.id}`"
                size="xs"
                variant="subtle"
                color="neutral"
                icon="i-lucide-car"
              >
                Auto
              </UButton>
              <UButton
                :to="`/naprawy/nowa?auto=${appointment.vehicle.id}`"
                size="xs"
                variant="subtle"
                icon="i-lucide-wrench"
              >
                Nowa naprawa
              </UButton>
            </div>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-1">
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              aria-label="Usuń wizytę"
              @click="openDelete(appointment)"
            />
            <template v-if="appointment.status !== 'odwolana'">
              <UButton
                v-if="appointment.status === 'umowiona'"
                size="xs"
                color="success"
                variant="subtle"
                :loading="statusUpdatingId === appointment.id"
                @click="onStatusChange(appointment.id, 'potwierdzona')"
              >
                Potwierdź
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="subtle"
                :loading="statusUpdatingId === appointment.id"
                @click="onStatusChange(appointment.id, 'odwolana')"
              >
                Odwołaj
              </UButton>
            </template>
          </div>
        </div>
      </li>
    </ul>

    <UAlert
      v-if="statusError"
      class="mt-4"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="statusError"
    />

    <ConfirmDeleteModal
      v-model:open="deleteOpen"
      title="Usunąć wizytę?"
      @confirm="onDelete"
    />
  </UContainer>
</template>
