<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { RepairInput } from '~/composables/useRepairs'
import { repairStatusLabels, type RepairStatus } from '~/utils/labels'

const props = defineProps<{
  initial?: RepairInput
  lastKnownMileage?: number | null
  loading?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: RepairInput]
}>()

const state = reactive({
  repair_date: props.initial?.repair_date ?? todayIso(),
  description: props.initial?.description ?? '',
  mileage: props.initial?.mileage ?? null,
  status: props.initial?.status ?? 'w_trakcie' as RepairStatus
})

const statusOptions = Object.entries(repairStatusLabels).map(([value, label]) => ({ label, value }))

/** Non-blocking nudge: a lower mileage than last known is usually a typo, not an error. */
const mileageWarning = computed(() => {
  if (state.mileage === null || !props.lastKnownMileage) return null
  if (state.mileage >= props.lastKnownMileage) return null
  return `Wpisany przebieg jest niższy niż ostatni znany (${formatMileage(props.lastKnownMileage)}). Sprawdź, czy to nie pomyłka — zapis i tak jest możliwy.`
})

function validate(state: { description: string }): FormError[] {
  const errors: FormError[] = []
  if (!state.description.trim()) errors.push({ name: 'description', message: 'Opisz naprawę' })
  return errors
}

function onSubmit(event: FormSubmitEvent<typeof state>) {
  emit('submit', {
    repair_date: event.data.repair_date,
    description: event.data.description,
    mileage: event.data.mileage,
    status: event.data.status
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
      label="Data"
      name="repair_date"
      required
    >
      <UInput
        v-model="state.repair_date"
        type="date"
        class="w-full"
      />
    </UFormField>

    <UFormField
      label="Opis"
      name="description"
      required
    >
      <UTextarea
        v-model="state.description"
        class="w-full"
        :rows="4"
        placeholder="Co zostało zrobione"
      />
    </UFormField>

    <UFormField
      label="Przebieg"
      name="mileage"
      :hint="lastKnownMileage ? `Ostatni znany: ${formatMileage(lastKnownMileage)}` : undefined"
    >
      <UInputNumber
        v-model="state.mileage"
        class="w-full"
        :increment="false"
        :decrement="false"
        :min="0"
      />
    </UFormField>

    <UAlert
      v-if="mileageWarning"
      color="warning"
      icon="i-lucide-triangle-alert"
      :title="mileageWarning"
    />

    <UFormField
      label="Status"
      name="status"
      required
    >
      <USelect
        v-model="state.status"
        :items="statusOptions"
        class="w-full"
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
