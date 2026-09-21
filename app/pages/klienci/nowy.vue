<script setup lang="ts">
import type { ClientInput } from '~/composables/useClients'

definePageMeta({ layout: 'default' })

const { create } = useClients()

const loading = ref(false)
const errorMessage = ref('')

async function onSubmit(payload: ClientInput) {
  errorMessage.value = ''
  loading.value = true

  try {
    const client = await create(payload)
    await navigateTo(`/klienci/${client.id}`)
  } catch {
    errorMessage.value = 'Nie udało się zapisać klienta. Spróbuj ponownie.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-md py-6">
    <UButton
      to="/klienci"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="mb-4"
    >
      Klienci
    </UButton>

    <h1 class="mb-6 text-2xl font-bold">
      Nowy klient
    </h1>

    <ClientForm
      :loading="loading"
      submit-label="Dodaj klienta"
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
