<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { ReminderInput } from '~/composables/useReminders'
import { reminderTypePresets } from '~/utils/reminders'

const CUSTOM_TYPE_VALUE = '__wlasny__'

const props = defineProps<{
  /** Known mileage of the vehicle the reminder is for — needed to compute the "15 000 km" option. */
  currentMileage?: number | null
  loading?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: ReminderInput]
}>()

const typeOptions = [
  ...reminderTypePresets.map(type => ({ label: type, value: type })),
  { label: 'Własny', value: CUSTOM_TYPE_VALUE }
]

const dueMode = ref<'12m' | '15000km' | 'custom'>('12m')

const state = reactive({
  reminder_type_choice: reminderTypePresets[0] as string,
  reminder_type_custom: '',
  due_date: '',
  due_mileage: null as number | null,
  note: ''
})

function validate(state: { reminder_type_choice: string, reminder_type_custom: string, due_date: string, due_mileage: number | null }): FormError[] {
  const errors: FormError[] = []
  if (state.reminder_type_choice === CUSTOM_TYPE_VALUE && !state.reminder_type_custom.trim()) {
    errors.push({ name: 'reminder_type_custom', message: 'Podaj własny tekst' })
  }
  if (dueMode.value === 'custom' && !state.due_date && state.due_mileage === null) {
    errors.push({ name: 'due_date', message: 'Podaj termin lub przebieg' })
  }
  return errors
}

function onSubmit(event: FormSubmitEvent<typeof state>) {
  const reminderType = event.data.reminder_type_choice === CUSTOM_TYPE_VALUE
    ? event.data.reminder_type_custom
    : event.data.reminder_type_choice

  let dueDate: string | null = null
  let dueMileage: number | null = null

  if (dueMode.value === '12m') {
    dueDate = addMonths(todayIso(), 12)
  } else if (dueMode.value === '15000km') {
    dueMileage = (props.currentMileage ?? 0) + 15000
  } else {
    dueDate = event.data.due_date || null
    dueMileage = event.data.due_mileage
  }

  emit('submit', {
    reminder_type: reminderType,
    due_date: dueDate,
    due_mileage: dueMileage,
    note: event.data.note
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
      label="Rodzaj"
      name="reminder_type_choice"
      required
    >
      <USelect
        v-model="state.reminder_type_choice"
        :items="typeOptions"
        class="w-full"
      />
    </UFormField>

    <UFormField
      v-if="state.reminder_type_choice === CUSTOM_TYPE_VALUE"
      label="Własny tekst"
      name="reminder_type_custom"
      required
    >
      <UInput
        v-model="state.reminder_type_custom"
        class="w-full"
        placeholder="np. filtr paliwa"
      />
    </UFormField>

    <UFormField label="Termin">
      <UButtonGroup class="w-full">
        <UButton
          :variant="dueMode === '12m' ? 'solid' : 'outline'"
          color="neutral"
          block
          @click="dueMode = '12m'"
        >
          12 miesięcy
        </UButton>
        <UButton
          :variant="dueMode === '15000km' ? 'solid' : 'outline'"
          color="neutral"
          block
          :disabled="currentMileage == null"
          @click="dueMode = '15000km'"
        >
          15 000 km
        </UButton>
        <UButton
          :variant="dueMode === 'custom' ? 'solid' : 'outline'"
          color="neutral"
          block
          @click="dueMode = 'custom'"
        >
          Konkretny termin
        </UButton>
      </UButtonGroup>
    </UFormField>

    <p
      v-if="dueMode === '12m'"
      class="text-sm text-muted"
    >
      Termin: {{ formatDate(addMonths(todayIso(), 12)) }}
    </p>
    <p
      v-else-if="dueMode === '15000km'"
      class="text-sm text-muted"
    >
      <template v-if="currentMileage != null">
        Termin: {{ formatMileage(currentMileage + 15000) }}
      </template>
      <template v-else>
        Brak znanego przebiegu auta — wybierz konkretny termin.
      </template>
    </p>

    <div
      v-else
      class="grid grid-cols-2 gap-4"
    >
      <UFormField
        label="Data"
        name="due_date"
        hint="Opcjonalnie"
      >
        <UInput
          v-model="state.due_date"
          type="date"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Przebieg"
        name="due_mileage"
        hint="Opcjonalnie"
      >
        <UInputNumber
          v-model="state.due_mileage"
          class="w-full"
          :increment="false"
          :decrement="false"
          :min="0"
        />
      </UFormField>
    </div>

    <UFormField
      label="Notatka"
      name="note"
    >
      <UTextarea
        v-model="state.note"
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
