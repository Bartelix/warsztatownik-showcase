<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  error?: string
}>(), {
  description: 'Zostanie usunięte po kilku sekundach — można to cofnąć w tym czasie.',
  confirmLabel: 'Usuń'
})

const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
  >
    <template #body>
      <p class="text-muted">
        {{ description }}
      </p>

      <UAlert
        v-if="error"
        class="mt-4"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="error"
      />

      <div class="mt-4 flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="open = false"
        >
          Anuluj
        </UButton>
        <UButton
          color="error"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
