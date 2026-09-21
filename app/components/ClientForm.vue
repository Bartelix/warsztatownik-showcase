<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { ClientInput } from '~/composables/useClients'

const props = defineProps<{
  initial?: ClientInput
  loading?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: ClientInput]
}>()

const state = reactive({
  full_name: props.initial?.full_name ?? '',
  phone: props.initial?.phone ?? '',
  notes: props.initial?.notes ?? ''
})

function validate(state: { full_name: string }): FormError[] {
  const errors: FormError[] = []
  if (!state.full_name.trim()) errors.push({ name: 'full_name', message: 'Podaj imię i nazwisko' })
  return errors
}

function onSubmit(event: FormSubmitEvent<typeof state>) {
  emit('submit', {
    full_name: event.data.full_name,
    phone: event.data.phone,
    notes: event.data.notes
  })
}
</script>

<template>
  <UForm
    :state="state"
    :validate="validate"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      label="Imię i nazwisko"
      name="full_name"
      required
    >
      <UInput
        v-model="state.full_name"
        class="w-full"
        placeholder="Jan Kowalski"
      />
    </UFormField>

    <UFormField
      label="Telefon"
      name="phone"
    >
      <UInput
        v-model="state.phone"
        class="w-full"
        type="tel"
        placeholder="123 456 789"
      />
    </UFormField>

    <UFormField
      label="Notatki"
      name="notes"
    >
      <UTextarea
        v-model="state.notes"
        class="w-full"
        :rows="3"
      />
    </UFormField>

    <UButton
      type="submit"
      :loading="loading"
      block
    >
      {{ submitLabel ?? 'Zapisz' }}
    </UButton>
  </UForm>
</template>
