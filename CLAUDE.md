# Project instructions — Nuxt + Cloudflare Workers + Supabase

Template for this stack. On a new project, fill in the block below and delete
anything that doesn't apply.

## Project-specific facts (fill in per project)

- **Name:** Warsztatownik
- **Domain / one-liner:** _what the app does, in one sentence_
- **User-facing language:** Polish
- **Code language:** English
- **Supabase project ref:** _from the dashboard URL_
- **Cloudflare Worker name:** _from `wrangler.jsonc` → `name`_

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Nuxt (Vue 3, TypeScript, SSR on by default) |
| UI | `@nuxt/ui` + Tailwind |
| DB + auth | Supabase (Postgres, Supabase Auth, RLS) |
| Integration | `@nuxtjs/supabase` |
| Hosting | Cloudflare Workers (`nitro.preset: 'cloudflare_module'`) — **not** Pages, which is legacy |
| State | Nuxt's own `useState` + `useAsyncData` cache — no Pinia unless the app genuinely outgrows this |
| PWA (if applicable) | `@vite-pwa/nuxt` |

There is no custom backend/API layer. Components talk to Supabase directly through
composables; **RLS is the security boundary**, not application code. Only add a
`server/` route when something must run with a secret Supabase `service_role`
never allowed at all).

## Naming convention

| Layer | Language | Example |
| --- | --- | --- |
| Page URLs | user-facing language | `/vehicles/123` |
| Page file names | follows the URL | `pages/vehicles/[id].vue` |
| Components, composables, variables, types | English | `VehicleCard.vue`, `useVehicles()` |
| DB tables and columns | English | `vehicles.current_mileage` |
| User-visible strings | user-facing language, no anglicisms | "Add repair", "Done" |

URLs and UI text are read by the end user; code is read by developers and
tooling — keep code in plain English regardless of the app's UI language.

## Project structure (Nuxt 4 layout, `app/` as source root)

```
app/
├─ assets/css/
├─ components/<domain>/     grouped by feature, not by type
├─ composables/             one per domain entity — all Supabase queries live here
├─ layouts/
├─ pages/
├─ types/
│  ├─ database.types.ts     GENERATED from Supabase — never hand-edit
│  └─ app.ts                derived/composed types
├─ utils/                   formatting, normalization, label lookups — pure functions, no I/O
supabase/
├─ migrations/              schema changes as SQL files, run deliberately — never click-edit the schema in the dashboard
public/                     PWA icons, manifest assets
nuxt.config.ts
wrangler.jsonc
```

Rules:

- **Zero business logic in components.** Formatting → `utils/`. Queries → `composables/`.
- **Nested `select`s over separate queries** — one round trip per screen (e.g. one
  `select` pulling the entity, its relations, and children in one call).
- **`useAsyncData`** for page-level loads (works on server and client), call
  `refresh()` after writes instead of manual state juggling.
- Multi-tenant / multi-context data (e.g. an `organization_id`/`workshop_id` column):
  filter explicitly in every list/write query even though RLS also enforces it — RLS
  proves you can't see other tenants' rows, it does not pick the *right* one for a
  user who belongs to several.

## Supabase

### Config

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase', '@nuxt/ui' /* , '@vite-pwa/nuxt' */],
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/confirm']
    },
    types: '~/types/database.types.ts'
  }
})
```

The module protects all routes by default and redirects unauthenticated users to
`login`. Don't write custom auth middleware for this — let the module do it.

### Types

Never hand-write DB types. Regenerate after every schema change:

```bash
pnpm types   # supabase gen types typescript --project-id <ref> > app/types/database.types.ts
```

Wire this into `package.json` as the `types` script. Path must match whatever
`supabase.types` in `nuxt.config.ts` points to — usually `app/types/` in a Nuxt 4
layout, not `types/` at the repo root.

### RLS is the only security boundary

- The `anon`/`publishable` key is public by design and ships in the browser bundle.
  It protects nothing by itself — **RLS on every table does.**
- Default (RLS enabled, no policy) = zero access. Policies must be added explicitly,
  never removed to "make it work."
- `using` governs which existing rows are visible (`SELECT`/`UPDATE`/`DELETE`);
  `with check` governs what a write is allowed to produce (`INSERT`/`UPDATE`). They
  answer different questions and both matter on `UPDATE`.
- Wrap `auth.uid()` calls as `(select auth.uid())` in policies — evaluated once per
  query instead of once per row.
- Scope policies `to authenticated` (or the specific role) explicitly, not via an
  `auth.role() = 'authenticated'` condition — the latter still gets evaluated for
  every role, including `anon`.
- `service_role` bypasses RLS entirely. It must never reach client code or the repo,
  and isn't needed at all until server-side code (e.g. a cron endpoint, transactional
  email) is introduced.
- **If public sign-up must stay disabled** (invite-only / manually provisioned
  accounts model): turn it off in the dashboard (Authentication → Providers → Email
  → "Allow new users to sign up" OFF) before anything else. An "any authenticated
  user sees everything in their tenant" policy model is only safe when strangers
  cannot self-register into `authenticated`.
- Testing RLS: the SQL Editor and Table Editor run as `postgres` and **bypass RLS** —
  a query returning rows there proves nothing. Test with `set local role authenticated`
  plus a forged `request.jwt.claims`, wrapped in `begin/rollback`, or test from outside
  with a plain `curl` against the REST endpoint using only the anon key.

### Env vars

Only these two are needed client + server side, and both are meant to be public:

```
SUPABASE_URL=...
SUPABASE_KEY=...   # anon / publishable key — never service_role
```

`.env` is git-ignored; commit a `.env.example` with placeholder values.

## Cloudflare Workers deployment

Workers, not Pages — Pages is in maintenance mode; Workers is where new features land.

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  nitro: { preset: 'cloudflare_module' }
})
```

`wrangler.jsonc`:

```jsonc
{
  "name": "<worker-name>",
  "main": ".output/server/index.mjs",
  "compatibility_date": "<today, must be >= 2024-09-23>",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".output/public",
    "binding": "ASSETS"
  },
  "observability": { "enabled": true }
}
```

- `nodejs_compat` is required or Node-dependent deps (including Supabase's client)
  break in production while working fine locally.
- Install `wrangler` and `supabase` as devDependencies, not globally, so versions are
  pinned in the repo and match what Cloudflare's own build uses.
- **Build-time vars vs runtime vars are different settings in the Cloudflare
  dashboard** and this is the most common deploy footgun: `SUPABASE_URL`/`SUPABASE_KEY`
  must be set under **Settings → Builds → Variables**, because they get baked into the
  client bundle at build time. Setting them only as runtime vars/secrets means the
  browser bundle never sees them and every request fails at the first Supabase call.
- Rollback: **Workers & Pages → Deployments → previous version → Rollback**, or
  `pnpm wrangler rollback` from the terminal. Prefer rolling back over hot-fixing
  under pressure.
- Live logs: `pnpm wrangler tail`. Run the production build locally in the actual
  Workers runtime with `pnpm wrangler dev` when something works in `pnpm dev` but not
  on deploy.
- Free plan's real limit is **10ms of CPU time per invocation** (waiting on Supabase
  doesn't count, only actual CPU work). If that's ever hit, `ssr: false` removes the
  limit entirely by turning the app into a static SPA bundle, at the cost of a blank
  first paint — a real fallback, not a hack, for an app that's entirely behind login
  anyway (no SEO/anonymous-visit value from SSR in that case).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | dev server |
| `pnpm build` | production build (same one Cloudflare runs) |
| `pnpm types` | regenerate DB types — run after every schema change |
| `pnpm deploy` | `wrangler deploy` (normally triggered by `git push` instead) |
| `pnpm wrangler dev` | run the production build locally in the Workers runtime |
| `pnpm wrangler tail` | tail production logs |
| `pnpm lint` / `pnpm typecheck` | before considering a change done |

## Lint/style

`@nuxt/eslint` with stylistic rules `commaDangle: 'never'`, `braceStyle: '1tbs'`.
Keep `app/types/database.types.ts` excluded from lint (it's generated).

## Engineering defaults for this stack

- No Pinia at small-to-medium scale — `useState` + `useAsyncData`'s built-in cache is
  enough; an extra store is a layer with no payoff until proven otherwise.
- No custom REST/GraphQL API layer in front of Supabase — that's what RLS is for.
  Adding a server proxy "for safety" duplicates the boundary that already exists.
- One Supabase project / one production deployment is fine at small scale; don't add
  a staging environment until the cost of experimenting on live data actually bites.
  Mitigate by keeping all schema changes as migrations in `supabase/migrations/`,
  applied deliberately — never click-authored directly in the dashboard.
- Prefer nested `select`s and query composition in composables over multiple
  round-trips or client-side joins.
