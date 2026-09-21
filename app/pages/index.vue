<script setup lang="ts">
import { appointmentStatusColor, appointmentStatusLabel, repairStatusColor, repairStatusLabel } from '~/utils/labels'

definePageMeta({ layout: 'default' })

const { listOpen, activeWorkshopId } = useRepairs()
const { listToday } = useAppointments()
const { listDue } = useReminders()

const { data: repairs, status, error } = await useAsyncData(
  'dashboard-open-repairs',
  () => listOpen(),
  { watch: [activeWorkshopId] }
)
const { data: appointments, status: appointmentsStatus, error: appointmentsError } = await useAsyncData(
  'dashboard-today-appointments',
  () => listToday(),
  { watch: [activeWorkshopId] }
)
const { data: dueReminders, error: dueRemindersError } = await useAsyncData(
  'dashboard-due-reminders',
  () => listDue(),
  { watch: [activeWorkshopId] }
)
</script>

<template>
  <UContainer class="py-6">
    <h1 class="mb-4 text-2xl font-bold">
      Warsztatownik
    </h1>

    <LoadErrorAlert
      v-if="dueRemindersError"
      class="mb-6"
      action="wczytać przypomnień"
    />

    <template v-else-if="dueReminders?.length">
      <h2 class="mb-2 text-lg font-semibold">
        Do przypomnienia
      </h2>
      <ul class="mb-6 divide-y divide-default">
        <li
          v-for="reminder in dueReminders"
          :key="reminder.id"
        >
          <NuxtLink
            :to="`/auta/${reminder.vehicle.id}`"
            class="flex items-start justify-between gap-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-error">
                {{ reminder.reminder_type }}
              </p>
              <p class="mt-0.5 truncate text-sm text-muted">
                {{ reminder.vehicle.make }} {{ reminder.vehicle.model }} · {{ reminder.vehicle.client.full_name }}
              </p>
              <p class="mt-0.5 text-sm text-muted">
                {{ reminderDueSummary(reminder) }}
              </p>
            </div>
            <UIcon
              name="i-lucide-chevron-right"
              class="mt-1 shrink-0 text-muted"
            />
          </NuxtLink>
        </li>
      </ul>
    </template>

    <h2 class="mb-2 text-lg font-semibold">
      Dziś
    </h2>

    <div
      v-if="appointmentsStatus === 'pending'"
      class="py-6 text-center text-muted"
    >
      Wczytywanie…
    </div>

    <LoadErrorAlert
      v-else-if="appointmentsError"
      class="mb-6"
      action="wczytać wizyt"
    />

    <UAlert
      v-else-if="!appointments?.length"
      class="mb-6"
      icon="i-lucide-calendar-check"
      title="Brak wizyt na dziś."
    />

    <ul
      v-else
      class="mb-6 divide-y divide-default"
    >
      <li
        v-for="appointment in appointments"
        :key="appointment.id"
      >
        <NuxtLink
          to="/terminarz"
          class="flex items-start justify-between gap-4 py-3"
        >
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
            </div>
            <p class="mt-0.5 truncate">
              <span
                v-if="appointment.client"
                class="font-medium"
              >
                {{ appointment.client.full_name }}
              </span>
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
              {{ appointment.vehicle.make }} {{ appointment.vehicle.model }}
            </p>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="mt-1 shrink-0 text-muted"
          />
        </NuxtLink>
      </li>
    </ul>

    <h2 class="mb-2 text-lg font-semibold">
      Otwarte naprawy
    </h2>

    <div
      v-if="status === 'pending'"
      class="py-12 text-center text-muted"
    >
      Wczytywanie…
    </div>

    <LoadErrorAlert
      v-else-if="error"
      action="wczytać napraw"
    />

    <UAlert
      v-else-if="!repairs?.length"
      icon="i-lucide-circle-check"
      title="Brak otwartych napraw."
      description="Wszystko zrobione."
    />

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
              <p class="truncate font-medium">
                {{ repair.vehicle.make }} {{ repair.vehicle.model }}
              </p>
              <UBadge
                :color="repairStatusColor(repair.status)"
                variant="subtle"
                size="sm"
              >
                {{ repairStatusLabel(repair.status) }}
              </UBadge>
            </div>
            <p class="mt-0.5 truncate text-sm text-muted">
              {{ formatDate(repair.repair_date) }} · {{ repair.vehicle.client.full_name }}
            </p>
            <p class="mt-0.5 text-sm text-muted">
              {{ repair.description }}
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
  </UContainer>
</template>
