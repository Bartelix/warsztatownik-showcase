<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

useHead({
  htmlAttrs: { lang: 'pl' },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'color-scheme', content: 'light' }
  ]
})

const isFetchFailure = computed(() => props.error.statusCode === 503)
const isNotFound = computed(() => props.error.statusCode === 404)
const { isOnline } = useNetworkStatus()

const title = computed(() => {
  if (isFetchFailure.value) return isOnline.value ? 'Błąd wczytywania' : 'Brak połączenia'
  if (isNotFound.value) return 'Nie znaleziono'
  return 'Coś poszło nie tak'
})

const description = computed(() => {
  if (isFetchFailure.value) {
    return isOnline.value
      ? 'Nie udało się pobrać danych. Spróbuj ponownie.'
      : 'Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.'
  }
  if (isNotFound.value) return 'Ta strona nie istnieje albo została usunięta.'
  return 'Spróbuj ponownie. Jeśli to się powtarza, daj znać synowi.'
})

const icon = computed(() => {
  if (isFetchFailure.value) return isOnline.value ? 'i-lucide-triangle-alert' : 'i-lucide-wifi-off'
  if (isNotFound.value) return 'i-lucide-search-x'
  return 'i-lucide-triangle-alert'
})

function retry() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <UApp>
    <div class="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <UIcon
        :name="icon"
        class="size-12 text-muted"
      />
      <h1 class="text-xl font-bold">
        {{ title }}
      </h1>
      <p class="max-w-xs text-muted">
        {{ description }}
      </p>
      <UButton
        icon="i-lucide-rotate-cw"
        @click="retry"
      >
        Spróbuj ponownie
      </UButton>
    </div>
  </UApp>
</template>
