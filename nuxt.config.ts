// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@vite-pwa/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // Podąża za ustawieniem telefonu, z ręcznym przełącznikiem w headerze
  // (`UColorModeSwitch`) dla kogoś, kto chce nadpisać system. Wybór
  // zapamiętuje się w localStorage.
  colorMode: {
    preference: 'system',
    fallback: 'light'
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    // Cloudflare Workers, not Pages — see docs/09-cloudflare.md
    preset: 'cloudflare_module'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'images/warsztatownik-icon.svg'],
    manifest: {
      name: 'Warsztatownik',
      short_name: 'Warsztatownik',
      description: 'Notatnik warsztatu samochodowego — klienci, auta, historia napraw.',
      lang: 'pl',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#FFFFFF',
      background_color: '#FFFFFF',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
  },

  supabase: {
    redirectOptions: {
      login: '/logowanie',
      callback: '/confirm'
    }
  }
})
