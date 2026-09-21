<script setup lang="ts">
import type { RepairPart } from '~/composables/useRepairs'

const props = defineProps<{
  repairId: string
  parts: RepairPart[]
}>()

const emit = defineEmits<{
  change: []
}>()

const { addPart, updatePart, removePart, listSuppliers } = useRepairs()
const { activeWorkshopId } = useWorkshops()
const { scheduleDelete } = useUndoableDelete()

const { data: supplierSuggestions } = await useAsyncData(`repair-part-suppliers-${activeWorkshopId.value}`, listSuppliers)

/** Hides a part the moment its delete is confirmed, without waiting for the undo window to pass. */
const pendingRemoveIds = ref(new Set<string>())
const visibleParts = computed(() => props.parts.filter(part => !pendingRemoveIds.value.has(part.id)))

const addForm = reactive({ name: '', catalog_number: '', supplier: '' })
const addLoading = ref(false)
const addError = ref('')

async function onAdd() {
  if (!addForm.name.trim()) return

  addError.value = ''
  addLoading.value = true

  try {
    await addPart(props.repairId, {
      name: addForm.name,
      catalog_number: addForm.catalog_number || null,
      supplier: addForm.supplier || null
    })
    addForm.name = ''
    addForm.catalog_number = ''
    addForm.supplier = ''
    emit('change')
  } catch {
    addError.value = 'Nie udało się dodać części. Spróbuj ponownie.'
  } finally {
    addLoading.value = false
  }
}

const editingId = ref<string | null>(null)
const editForm = reactive({ name: '', catalog_number: '', supplier: '' })
const editLoading = ref(false)
const editError = ref('')

function startEdit(part: RepairPart) {
  editingId.value = part.id
  editForm.name = part.name
  editForm.catalog_number = part.catalog_number ?? ''
  editForm.supplier = part.supplier ?? ''
  editError.value = ''
}

function cancelEdit() {
  editingId.value = null
}

async function onSaveEdit(id: string) {
  if (!editForm.name.trim()) return

  editError.value = ''
  editLoading.value = true

  try {
    await updatePart(id, {
      name: editForm.name,
      catalog_number: editForm.catalog_number || null,
      supplier: editForm.supplier || null
    })
    editingId.value = null
    emit('change')
  } catch {
    editError.value = 'Nie udało się zapisać zmian. Spróbuj ponownie.'
  } finally {
    editLoading.value = false
  }
}

const removeOpen = ref(false)
const removingId = ref<string | null>(null)

function confirmRemove(id: string) {
  removingId.value = id
  removeOpen.value = true
}

function onRemove() {
  if (!removingId.value) return
  const id = removingId.value

  removeOpen.value = false
  pendingRemoveIds.value.add(id)

  scheduleDelete({
    message: 'Część zostanie usunięta.',
    onCommit: async () => {
      await removePart(id)
      pendingRemoveIds.value.delete(id)
      emit('change')
    },
    onCancel: () => pendingRemoveIds.value.delete(id)
  })
}
</script>

<template>
  <div>
    <p
      v-if="!visibleParts.length"
      class="text-muted"
    >
      Brak wypisanych części.
    </p>

    <ul
      v-else
      class="mb-4 divide-y divide-default"
    >
      <li
        v-for="part in visibleParts"
        :key="part.id"
        class="py-2"
      >
        <div
          v-if="editingId === part.id"
          class="space-y-2"
        >
          <UInput
            v-model="editForm.name"
            placeholder="Nazwa"
            class="w-full"
          />
          <UInput
            v-model="editForm.catalog_number"
            placeholder="Numer katalogowy"
            class="w-full"
          />
          <UInputMenu
            v-model="editForm.supplier"
            mode="autocomplete"
            :items="supplierSuggestions ?? []"
            placeholder="Hurtownia"
            class="w-full"
          />

          <UAlert
            v-if="editError"
            color="error"
            icon="i-lucide-triangle-alert"
            :title="editError"
          />

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="cancelEdit"
            >
              Anuluj
            </UButton>
            <UButton
              size="sm"
              :loading="editLoading"
              @click="onSaveEdit(part.id)"
            >
              Zapisz
            </UButton>
          </div>
        </div>

        <div
          v-else
          class="flex items-start justify-between gap-2"
        >
          <div class="min-w-0">
            <p class="font-medium">
              {{ part.name }}
            </p>
            <p
              v-if="part.catalog_number || part.supplier"
              class="text-sm text-muted"
            >
              <span v-if="part.catalog_number">{{ part.catalog_number }}</span>
              <span v-if="part.catalog_number && part.supplier"> · </span>
              <span v-if="part.supplier">{{ part.supplier }}</span>
            </p>
          </div>

          <div class="flex shrink-0 gap-1">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Edytuj część"
              @click="startEdit(part)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Usuń część"
              @click="confirmRemove(part.id)"
            />
          </div>
        </div>
      </li>
    </ul>

    <div class="space-y-2 rounded-lg border border-default p-3">
      <UInput
        v-model="addForm.name"
        placeholder="Nazwa części"
        class="w-full"
      />
      <UInput
        v-model="addForm.catalog_number"
        placeholder="Numer katalogowy (opcjonalnie)"
        class="w-full"
      />
      <UInputMenu
        v-model="addForm.supplier"
        mode="autocomplete"
        :items="supplierSuggestions ?? []"
        placeholder="Hurtownia (opcjonalnie)"
        class="w-full"
      />

      <UAlert
        v-if="addError"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="addError"
      />

      <UButton
        icon="i-lucide-plus"
        :loading="addLoading"
        :disabled="!addForm.name.trim()"
        block
        @click="onAdd"
      >
        Dodaj część
      </UButton>
    </div>

    <ConfirmDeleteModal
      v-model:open="removeOpen"
      title="Usunąć część?"
      @confirm="onRemove"
    />
  </div>
</template>
