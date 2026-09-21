<script setup lang="ts">
/** A failed fetch isn't always a dropped connection — `navigator.onLine` tells the two apart instead of always blaming "no internet". */
defineProps<{ action: string }>()

const { isOnline } = useNetworkStatus()
</script>

<template>
  <UAlert
    color="error"
    :icon="isOnline ? 'i-lucide-triangle-alert' : 'i-lucide-wifi-off'"
    :title="isOnline ? 'Błąd wczytywania.' : 'Brak połączenia.'"
    :description="isOnline
      ? `Nie udało się ${action}. Spróbuj ponownie.`
      : `Nie udało się ${action}. Sprawdź internet i spróbuj ponownie.`"
  />
</template>
