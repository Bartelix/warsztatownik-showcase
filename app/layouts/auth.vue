<script setup lang="ts">
const { isOnline } = useNetworkStatus()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <p
      v-if="!isOnline"
      class="bg-error px-4 py-2 text-center text-sm font-medium text-inverted"
    >
      Brak połączenia z internetem
    </p>

    <div class="flex flex-1 items-center justify-center px-4">
      <slot />
    </div>
  </div>
</template>
