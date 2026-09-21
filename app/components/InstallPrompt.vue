<script setup lang="ts">
const { visible, dismiss } = useIosInstallPrompt()
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-x-4 bottom-20 z-30 flex items-start gap-3 rounded-lg border border-default bg-default p-4 shadow-lg"
  >
    <UIcon
      name="i-lucide-square-arrow-up"
      class="mt-0.5 size-5 shrink-0 text-primary"
    />
    <p class="flex-1 text-sm">
      Zainstaluj Warsztatownika na ekranie głównym: dotknij ikony
      <span class="font-medium">Udostępnij</span> na dole ekranu, a potem
      <span class="font-medium">„Dodaj do ekranu głównego”</span>.
    </p>
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      size="xs"
      aria-label="Zamknij podpowiedź"
      @click="dismiss"
    />
  </div>
</template>
