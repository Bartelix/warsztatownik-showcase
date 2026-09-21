<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { list, activeWorkshopId } = useClients()

const { data: clients, status, error } = await useAsyncData(
  'clients-list',
  () => list(),
  { watch: [activeWorkshopId] }
)
</script>

<template>
  <UContainer class="py-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Klienci
      </h1>
      <UButton
        to="/klienci/nowy"
        icon="i-lucide-plus"
      >
        Dodaj klienta
      </UButton>
    </div>

    <div
      v-if="status === 'pending'"
      class="py-12 text-center text-muted"
    >
      Wczytywanie…
    </div>

    <LoadErrorAlert
      v-else-if="error"
      action="wczytać klientów"
    />

    <UAlert
      v-else-if="!clients?.length"
      icon="i-lucide-users"
      title="Brak klientów."
      description="Dodaj pierwszego."
    />

    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="client in clients"
        :key="client.id"
      >
        <NuxtLink
          :to="`/klienci/${client.id}`"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ client.full_name }}
            </p>
            <p
              v-if="client.phone"
              class="text-sm text-muted"
            >
              {{ formatPhone(client.phone) }}
            </p>
          </div>
          <UBadge
            color="neutral"
            variant="subtle"
            class="shrink-0"
          >
            {{ formatVehicleCount(client.vehicleCount) }}
          </UBadge>
        </NuxtLink>
      </li>
    </ul>
  </UContainer>
</template>
