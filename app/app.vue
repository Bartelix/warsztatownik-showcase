<script setup lang="ts">
const colorMode = useColorMode()
// `colorMode.value` is briefly the literal string "system" during SSR/before
// hydration resolves the real OS preference — neither meta tag accepts that
// as a value, so anything other than a resolved "dark" defaults to light.
const isDark = computed(() => colorMode.value === 'dark')

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'color-scheme', content: () => (isDark.value ? 'dark' : 'light') },
    { name: 'theme-color', content: () => (isDark.value ? '#0F172A' : '#FFFFFF') }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
    { rel: 'icon', href: '/images/warsztatownik-icon.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' }
  ],
  htmlAttrs: {
    lang: 'pl'
  }
})

useSeoMeta({
  title: 'Warsztatownik',
  description: 'Notatnik warsztatu samochodowego — klienci, auta, historia napraw.'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#00C16A" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <InstallPrompt />
  </UApp>
</template>
