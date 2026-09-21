-- =====================================================================
--  Warsztatownik — 0002: workshop contexts
--  Upgrades a database that already ran the PRE-context version of
--  0001_schemat_poczatkowy.sql (single shared workshop, `using (true)`
--  policies) to the current schema (workshops, workshop_members,
--  workshop_id everywhere, membership-based RLS).
--
--  Paste the whole file into: Supabase → SQL Editor → New query → Run.
--
--  This script only changes the SCHEMA — it does not create a workshop
--  and does not touch profiles. It assumes clients/vehicles/repairs/...
--  are empty, which is why workshop_id can be added as NOT NULL directly
--  with no backfill UPDATE. If any of those tables already hold rows,
--  running this as-is will fail on the `alter ... set not null` step —
--  stop and ask for a version with a backfill first.
--
--  Founding the first workshop and adding yourself as its member is a
--  separate, later step — see docs/06, section 4a. Do it once you
--  actually have a profile (i.e. after creating your account in
--  Etap 1), not as part of this migration.
-- =====================================================================

-- ── 1. New tables ─────────────────────────────────────────────────────
create table public.workshops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workshops is 'A data context, e.g. "Firma" or "Garaż". Everything else (clients, vehicles, repairs, ...) belongs to exactly one workshop.';

create trigger workshops_set_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

alter table public.profiles
  add column active_workshop_id uuid references public.workshops (id) on delete set null;

comment on column public.profiles.active_workshop_id is 'Context switcher: which workshop the app shows right now. Nullable — a brand-new profile has none until it creates or is added to one. The UI writes here when the mechanic switches context.';

create table public.workshop_members (
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (workshop_id, profile_id)
);

comment on table public.workshop_members is 'Which profiles belong to which workshop. RLS on every data table is driven by this table.';

-- A newly created workshop automatically gets its creator as the first
-- member — otherwise the row would be invisible to its own creator the
-- instant it is inserted (RLS would hide it from everyone). Guarded on
-- auth.uid() being non-null: inserts made without a user session (e.g. the
-- SQL Editor, which runs as postgres) skip this — the first workshop there
-- is founded by a manual second insert instead, see docs/06, section 4a.
create or replace function public.add_creator_as_workshop_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    insert into public.workshop_members (workshop_id, profile_id)
    values (new.id, (select auth.uid()))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger workshops_add_creator_as_member
  after insert on public.workshops
  for each row execute function public.add_creator_as_workshop_member();

-- Workshop ids the signed-in profile belongs to. Used by every RLS policy
-- below instead of repeating the subquery. security definer + reading
-- workshop_members without going through its own policy is what avoids
-- "infinite recursion detected in policy" on workshop_members itself.
create or replace function public.current_workshop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workshop_id from public.workshop_members where profile_id = (select auth.uid());
$$;

-- ── 2. clients — workshop_id set directly (no parent row to derive from) ──
alter table public.clients
  add column workshop_id uuid not null references public.workshops (id) on delete restrict;

comment on column public.clients.workshop_id is 'Which context this client belongs to. Set by the app from the currently active workshop — this is the one place workshop_id is not derived automatically, because a client has no parent row to derive it from.';

create index clients_workshop_id_idx on public.clients (workshop_id);

drop policy "klienci_zalogowani" on public.clients;

create policy "klienci_czlonkowie" on public.clients
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

-- ── 3. vehicles — workshop_id derived from client_id ───────────────────
alter table public.vehicles
  add column workshop_id uuid not null references public.workshops (id) on delete restrict;

comment on column public.vehicles.workshop_id is 'Derived automatically from client_id (see vehicles_set_workshop_id trigger) — never set directly by the app.';

create or replace function public.set_vehicle_workshop_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.workshop_id = (select workshop_id from public.clients where id = new.client_id);
  return new;
end;
$$;

create trigger vehicles_set_workshop_id
  before insert or update of client_id on public.vehicles
  for each row execute function public.set_vehicle_workshop_id();

create index vehicles_workshop_id_idx on public.vehicles (workshop_id);

drop policy "auta_zalogowani" on public.vehicles;

create policy "auta_czlonkowie" on public.vehicles
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

-- ── 4. repairs — workshop_id derived from vehicle_id ───────────────────
alter table public.repairs
  add column workshop_id uuid not null references public.workshops (id) on delete restrict;

comment on column public.repairs.workshop_id is 'Derived automatically from vehicle_id (see repairs_set_workshop_id trigger).';

create or replace function public.set_repair_workshop_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.workshop_id = (select workshop_id from public.vehicles where id = new.vehicle_id);
  return new;
end;
$$;

create trigger repairs_set_workshop_id
  before insert or update of vehicle_id on public.repairs
  for each row execute function public.set_repair_workshop_id();

create index repairs_workshop_id_idx on public.repairs (workshop_id);

drop policy "naprawy_zalogowani" on public.repairs;

create policy "naprawy_czlonkowie" on public.repairs
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

-- ── 5. repair_parts — workshop_id derived from repair_id ───────────────
alter table public.repair_parts
  add column workshop_id uuid not null references public.workshops (id) on delete restrict;

comment on column public.repair_parts.workshop_id is 'Derived automatically from repair_id (see repair_parts_set_workshop_id trigger).';

create or replace function public.set_repair_part_workshop_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.workshop_id = (select workshop_id from public.repairs where id = new.repair_id);
  return new;
end;
$$;

create trigger repair_parts_set_workshop_id
  before insert or update of repair_id on public.repair_parts
  for each row execute function public.set_repair_part_workshop_id();

create index repair_parts_workshop_id_idx on public.repair_parts (workshop_id);

drop policy "czesci_zalogowani" on public.repair_parts;

create policy "czesci_czlonkowie" on public.repair_parts
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

-- ── 6. appointments — workshop_id set directly, re-derived if client_id set ──
alter table public.appointments
  add column workshop_id uuid not null references public.workshops (id) on delete restrict;

comment on column public.appointments.workshop_id is 'Set by the app from the active workshop (same as clients.workshop_id) — and re-derived from client_id whenever one is chosen, so it cannot drift from the client''s own context. See appointments_set_workshop_id trigger.';

create or replace function public.set_appointment_workshop_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.client_id is not null then
    new.workshop_id = (select workshop_id from public.clients where id = new.client_id);
  end if;
  return new;
end;
$$;

create trigger appointments_set_workshop_id
  before insert or update of client_id on public.appointments
  for each row execute function public.set_appointment_workshop_id();

create index appointments_workshop_id_idx on public.appointments (workshop_id);

drop policy "wizyty_zalogowani" on public.appointments;

create policy "wizyty_czlonkowie" on public.appointments
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

-- ── 7. service_reminders — workshop_id derived from vehicle_id ─────────
alter table public.service_reminders
  add column workshop_id uuid not null references public.workshops (id) on delete restrict;

comment on column public.service_reminders.workshop_id is 'Derived automatically from vehicle_id (see service_reminders_set_workshop_id trigger).';

create or replace function public.set_service_reminder_workshop_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.workshop_id = (select workshop_id from public.vehicles where id = new.vehicle_id);
  return new;
end;
$$;

create trigger service_reminders_set_workshop_id
  before insert or update of vehicle_id on public.service_reminders
  for each row execute function public.set_service_reminder_workshop_id();

create index service_reminders_workshop_id_idx on public.service_reminders (workshop_id);

drop policy "przypomnienia_zalogowani" on public.service_reminders;

create policy "przypomnienia_czlonkowie" on public.service_reminders
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

-- ── 8. RLS on the two new tables ────────────────────────────────────────
alter table public.workshops        enable row level security;
alter table public.workshop_members enable row level security;

create policy "workshops_odczyt_czlonkow" on public.workshops
  for select to authenticated
  using (id in (select public.current_workshop_ids()));

create policy "workshops_tworzenie" on public.workshops
  for insert to authenticated
  with check (true);

create policy "workshops_edycja_czlonkow" on public.workshops
  for update to authenticated
  using (id in (select public.current_workshop_ids()))
  with check (id in (select public.current_workshop_ids()));

create policy "workshops_usuwanie_czlonkow" on public.workshops
  for delete to authenticated
  using (id in (select public.current_workshop_ids()));

create policy "workshop_members_odczyt_czlonkow" on public.workshop_members
  for select to authenticated
  using (workshop_id in (select public.current_workshop_ids()));

create policy "workshop_members_dodawanie" on public.workshop_members
  for insert to authenticated
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "workshop_members_usuwanie" on public.workshop_members
  for delete to authenticated
  using (workshop_id in (select public.current_workshop_ids()));
