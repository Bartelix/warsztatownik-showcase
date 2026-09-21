<script setup lang="ts">
import type { AuthFormField } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()

const loading = ref(false)
const errorMessage = ref('')

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'text',
    label: 'E-mail',
    placeholder: 'ty@przyklad.pl',
    required: true,
    autocomplete: 'email'
  },
  {
    name: 'password',
    type: 'password',
    label: 'Hasło',
    placeholder: 'Hasło',
    required: true,
    autocomplete: 'current-password'
  }
]

function validate(state: Record<string, unknown>) {
  const errors = []
  if (!state.email) errors.push({ name: 'email', message: 'Podaj adres e-mail' })
  if (!state.password) errors.push({ name: 'password', message: 'Podaj hasło' })
  return errors
}

async function onSubmit(event: { data: { email: string, password: string } }) {
  errorMessage.value = ''
  loading.value = true

  const { error } = await supabase.auth.signInWithPassword({
    email: event.data.email,
    password: event.data.password
  })

  loading.value = false

  if (error) {
    errorMessage.value = 'Nieprawidłowy e-mail lub hasło.'
    return
  }

  await navigateTo('/')
}
</script>

<template>
  <UCard class="w-full max-w-sm">
    <UAuthForm
      :fields="fields"
      :validate="validate"
      :loading="loading"
      icon="i-lucide-wrench"
      title="Warsztatownik"
      description="Zaloguj się, żeby zobaczyć pulpit."
      :submit="{ label: 'Zaloguj się' }"
      @submit="onSubmit"
    />

    <UAlert
      v-if="errorMessage"
      class="mt-4"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="errorMessage"
    />
  </UCard>
</template>
