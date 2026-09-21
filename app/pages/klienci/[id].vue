<script setup lang="ts">
import type { ClientInput } from '~/composables/useClients'
import { ClientHasVehiclesError } from '~/composables/useClients'

definePageMeta({ layout: 'default' })

const route = useRoute()
const clientId = route.params.id as string

const { getById, update, remove, assertDeletable } = useClients()
const { scheduleDelete } = useUndoableDelete()

const { data: client, error: fetchError, refresh } = await useAsyncData(`client-${clientId}`, () => getById(clientId))

if (fetchError.value) {
  throw createError({ statusCode: 503, statusMessage: 'Brak połączenia', fatal: true })
}
if (!client.value) {
  throw createError({ statusCode: 404, statusMessage: 'Nie znaleziono klienta', fatal: true })
}

const editOpen = ref(false)
const editLoading = ref(false)
const editError = ref('')

async function onEditSubmit(payload: ClientInput) {
  editError.value = ''
  editLoading.value = true

  try {
    await update(clientId, payload)
    await refresh()
    editOpen.value = false
  } catch {
    editError.value = 'Nie udało się zapisać zmian. Spróbuj ponownie.'
  } finally {
    editLoading.value = false
  }
}

const deleteOpen = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')

async function onDelete() {
  deleteError.value = ''
  deleteLoading.value = true

  try {
    await assertDeletable(clientId)
    deleteOpen.value = false

    scheduleDelete({
      message: 'Klient zostanie usunięty.',
      onCommit: () => remove(clientId)
    })

    await navigateTo('/klienci')
  } catch (error) {
    deleteError.value = error instanceof ClientHasVehiclesError
      ? error.message
      : 'Nie udało się usunąć klienta. Spróbuj ponownie.'
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <UContainer
    v-if="client"
    class="max-w-md py-6"
  >
    <UButton
      to="/klienci"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      Klienci
    </UButton>

    <div class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold">
          {{ client.full_name }}
        </h1>
        <a
          v-if="client.phone"
          :href="`tel:${phoneHref(client.phone)}`"
          class="mt-1 inline-flex items-center gap-1 text-primary"
        >
          <UIcon name="i-lucide-phone" />
          {{ formatPhone(client.phone) }}
        </a>
      </div>

      <div class="flex shrink-0 gap-2">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="subtle"
          aria-label="Edytuj klienta"
          @click="editOpen = true"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="subtle"
          aria-label="Usuń klienta"
          @click="deleteOpen = true"
        />
      </div>
    </div>

    <p
      v-if="client.notes"
      class="mb-6 whitespace-pre-line text-muted"
    >
      {{ client.notes }}
    </p>

    <UButton
      :to="`/terminarz/nowa?klient=${clientId}`"
      icon="i-lucide-calendar-plus"
      color="neutral"
      variant="subtle"
      block
      class="mb-6"
    >
      Umów wizytę
    </UButton>

    <div class="mb-2 flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        Auta
      </h2>
      <UButton
        :to="`/auta/nowe?klient=${clientId}`"
        icon="i-lucide-plus"
        size="sm"
        variant="subtle"
      >
        Dodaj auto
      </UButton>
    </div>

    <p
      v-if="!client.vehicles.length"
      class="text-muted"
    >
      Brak aut.
    </p>

    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="vehicle in client.vehicles"
        :key="vehicle.id"
      >
        <NuxtLink
          :to="`/auta/${vehicle.id}`"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ vehicle.make }} {{ vehicle.model }}
            </p>
            <p
              v-if="vehicle.plate"
              class="text-sm text-muted"
            >
              {{ vehicle.plate }}
            </p>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="shrink-0 text-muted"
          />
        </NuxtLink>
      </li>
    </ul>

    <UModal
      v-model:open="editOpen"
      title="Edytuj klienta"
    >
      <template #body>
        <ClientForm
          :initial="{ full_name: client.full_name, phone: client.phone, notes: client.notes }"
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
      title="Usunąć klienta?"
      :loading="deleteLoading"
      :error="deleteError"
      @confirm="onDelete"
    />
  </UContainer>
</template>
