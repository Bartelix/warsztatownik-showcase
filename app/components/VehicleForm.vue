<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { Vehicle, VehicleInput } from '~/composables/useVehicles'

const props = defineProps<{
  initial?: VehicleInput
  loading?: boolean
  submitLabel?: string
  excludeId?: string
}>()

const emit = defineEmits<{
  submit: [payload: VehicleInput]
}>()

const state = reactive({
  make: props.initial?.make ?? '',
  model: props.initial?.model ?? '',
  year: props.initial?.year ?? null,
  engine: props.initial?.engine ?? '',
  vin: props.initial?.vin ?? '',
  plate: props.initial?.plate ?? '',
  current_mileage: props.initial?.current_mileage ?? null,
  notes: props.initial?.notes ?? ''
})

const { findByVin } = useVehicles()
const vinDuplicates = ref<Vehicle[]>([])
const checkingVin = ref(false)

async function onVinBlur() {
  const normalized = normalizePlate(state.vin)
  if (!normalized) {
    vinDuplicates.value = []
    return
  }

  checkingVin.value = true
  try {
    const matches = await findByVin(normalized)
    vinDuplicates.value = matches.filter(match => match.id !== props.excludeId)
  } catch {
    vinDuplicates.value = []
  } finally {
    checkingVin.value = false
  }
}

watch(() => state.vin, () => {
  vinDuplicates.value = []
})

function validate(state: { make: string }): FormError[] {
  const errors: FormError[] = []
  if (!state.make.trim()) errors.push({ name: 'make', message: 'Podaj markę' })
  return errors
}

function onSubmit(event: FormSubmitEvent<typeof state>) {
  emit('submit', {
    make: event.data.make,
    model: event.data.model,
    year: event.data.year,
    engine: event.data.engine,
    vin: event.data.vin,
    plate: event.data.plate,
    current_mileage: event.data.current_mileage,
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
      label="Marka"
      name="make"
      required
    >
      <UInput
        v-model="state.make"
        class="w-full"
        placeholder="Volkswagen"
      />
    </UFormField>

    <UFormField
      label="Model"
      name="model"
    >
      <UInput
        v-model="state.model"
        class="w-full"
        placeholder="Golf"
      />
    </UFormField>

    <div class="grid grid-cols-2 gap-4">
      <UFormField
        label="Rok"
        name="year"
      >
        <UInputNumber
          v-model="state.year"
          class="w-full"
          :increment="false"
          :decrement="false"
          :min="1900"
          :max="2100"
        />
      </UFormField>

      <UFormField
        label="Przebieg"
        name="current_mileage"
      >
        <UInputNumber
          v-model="state.current_mileage"
          class="w-full"
          :increment="false"
          :decrement="false"
          :min="0"
        />
      </UFormField>
    </div>

    <UFormField
      label="Silnik"
      name="engine"
    >
      <UInput
        v-model="state.engine"
        class="w-full"
        placeholder="1.9 TDI 105 KM"
      />
    </UFormField>

    <UFormField
      label="Rejestracja"
      name="plate"
    >
      <UInput
        v-model="state.plate"
        class="w-full"
        placeholder="WX 12345"
      />
    </UFormField>

    <UFormField
      label="VIN"
      name="vin"
    >
      <UInput
        v-model="state.vin"
        class="w-full"
        @blur="onVinBlur"
      />
    </UFormField>

    <UAlert
      v-if="vinDuplicates.length"
      color="warning"
      icon="i-lucide-triangle-alert"
      title="Auto z takim numerem VIN już istnieje"
    >
      <template #description>
        <ul class="space-y-1">
          <li
            v-for="duplicate in vinDuplicates"
            :key="duplicate.id"
          >
            <NuxtLink
              :to="`/auta/${duplicate.id}`"
              target="_blank"
              class="text-primary underline"
            >
              {{ duplicate.make }} {{ duplicate.model }} — zobacz
            </NuxtLink>
          </li>
        </ul>
      </template>
    </UAlert>

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
