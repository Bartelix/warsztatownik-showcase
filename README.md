# Warsztatownik

Cyfrowy notatnik z terminarzem dla małego warsztatu samochodowego (dwóch mechaników).
Zastępuje zeszyt: klienci, auta, historia napraw, lista wizyt na dany dzień
i przypomnienia serwisowe dla mechanika.

## Stack

Nuxt 3 · Supabase (Postgres + Auth + RLS) · Cloudflare Workers · PWA · budżet 0 zł

W MVP **nie ma kodu serwerowego** — aplikacja rozmawia z Supabase bezpośrednio,
a bezpieczeństwa pilnuje Row Level Security w bazie.
