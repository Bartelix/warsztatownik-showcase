-- =====================================================================
--  Warsztatownik — initial schema (Phase 1 / MVP)
--  Paste the whole file into: Supabase → SQL Editor → New query → Run
--  The script is as idempotent as it reasonably can be (IF NOT EXISTS),
--  but it assumes a clean database.
-- =====================================================================

-- ── Extensions ────────────────────────────────────────────────────────
-- pg_trgm: fast substring search (ILIKE '%golf%')
create extension if not exists pg_trgm with schema extensions;

-- ── Helper function: automatic updated_at ─────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
--  WORKSHOP CONTEXTS
--  A workshop is an isolated set of data: clients, vehicles, repairs,
--  appointments, reminders. A profile can belong to more than one
--  workshop — e.g. one mechanic working both at "Firma" and at his own
--  "Garaż" — and switches the active context in the app. Every data row
--  carries a workshop_id and RLS only ever shows rows of workshops the
--  signed-in profile is a member of.
-- =====================================================================
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

-- =====================================================================
--  USER PROFILES
--  Extends auth.users with the data the app needs
--  (display name, last active workshop context).
-- =====================================================================
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null default '',
  email              text,
  active_workshop_id uuid references public.workshops (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Application users (mechanic, helper).';
comment on column public.profiles.active_workshop_id is 'Context switcher: which workshop the app shows right now. Nullable — a brand-new profile has none until it creates or is added to one. The UI writes here when the mechanic switches context.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- The profile is created automatically when an account is added in Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  WORKSHOP MEMBERSHIP
--  Who can see and edit a given workshop's data. Many-to-many: a mechanic
--  can be a member of more than one workshop.
-- =====================================================================
create table public.workshop_members (
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (workshop_id, profile_id)
);

comment on table public.workshop_members is 'Which profiles belong to which workshop. RLS on every data table is driven by this table.';

-- A newly created workshop automatically gets its creator as the first
-- member — otherwise the row would be invisible to its own creator the
-- instant it is inserted (RLS would hide it from everyone).
-- Guarded on auth.uid() being non-null: inserts made without a user
-- session (e.g. the SQL Editor, which runs as postgres) skip this — the
-- first workshop there is founded by a manual second insert instead, see
-- docs/06, section 4a.
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

-- =====================================================================
--  MODULE 1 — CLIENTS
-- =====================================================================
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null references public.workshops (id) on delete restrict,
  full_name    text not null check (length(btrim(full_name)) > 0),
  phone        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null
);

comment on table public.clients is 'Workshop clients.';
comment on column public.clients.workshop_id is 'Which context this client belongs to. Set by the app from the currently active workshop — this is the one place workshop_id is not derived automatically, because a client has no parent row to derive it from.';

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_workshop_id_idx     on public.clients (workshop_id);
-- Search by name and phone number (substrings, case-insensitive)
create index clients_full_name_trgm_idx on public.clients using gin (full_name extensions.gin_trgm_ops);
create index clients_phone_trgm_idx     on public.clients using gin (phone     extensions.gin_trgm_ops);

-- =====================================================================
--  MODULE 1 — VEHICLES
-- =====================================================================
create table public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  workshop_id     uuid not null references public.workshops (id) on delete restrict,
  client_id       uuid not null references public.clients (id) on delete restrict,
  make            text not null check (length(btrim(make)) > 0),
  model           text,
  year            smallint check (year between 1900 and 2100),
  engine          text,
  vin             text,
  plate           text,
  current_mileage integer check (current_mileage >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null
);

comment on table public.vehicles is 'Client vehicles. A vehicle always belongs to exactly one client.';
comment on column public.vehicles.current_mileage is 'Last known mileage in km. Updated manually during a repair.';
comment on column public.vehicles.engine is 'Engine description as free text: "1.9 TDI 105 KM", "2.0 benzyna". Deliberately without a dictionary — entries like "TDI PD" and "1.9 TDI" must both fit.';
comment on column public.vehicles.client_id is 'Changing this value = the vehicle was sold to another client. The repair history stays with the vehicle.';
comment on column public.vehicles.workshop_id is 'Derived automatically from client_id (see vehicles_set_workshop_id trigger) — never set directly by the app.';

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- workshop_id always follows the chosen client, so the app can never
-- accidentally attach a vehicle to the wrong context.
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
create index vehicles_client_id_idx  on public.vehicles (client_id);
create index vehicles_plate_trgm_idx on public.vehicles using gin (plate extensions.gin_trgm_ops);
create index vehicles_vin_trgm_idx   on public.vehicles using gin (vin   extensions.gin_trgm_ops);
create index vehicles_make_trgm_idx  on public.vehicles using gin (make  extensions.gin_trgm_ops);

-- Deliberately NO uniqueness on the VIN — a typo must not block saving a vehicle.
-- Duplicates are detected by the app, which only warns. To enforce it in the database:
--   create unique index vehicles_vin_key on public.vehicles (upper(vin)) where vin is not null;

-- =====================================================================
--  MODULE 2 — REPAIRS
-- =====================================================================
create table public.repairs (
  id          uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete restrict,
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  repair_date date not null default current_date,
  description text not null check (length(btrim(description)) > 0),
  mileage     integer check (mileage >= 0),
  status      text not null default 'w_trakcie'
                check (status in ('w_trakcie', 'czeka_na_czesci', 'zrobione')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

comment on table public.repairs is 'Service history — one row = one visit of a vehicle to the workshop.';
comment on column public.repairs.status is 'w_trakcie | czeka_na_czesci | zrobione. Deliberately text + CHECK instead of an enum type — easier to add a status later.';
comment on column public.repairs.workshop_id is 'Derived automatically from vehicle_id (see repairs_set_workshop_id trigger).';

create trigger repairs_set_updated_at
  before update on public.repairs
  for each row execute function public.set_updated_at();

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

-- Vehicle history: "the latest repairs of this vehicle" is the most frequent query in the app.
create index repairs_workshop_id_idx  on public.repairs (workshop_id);
create index repairs_vehicle_date_idx on public.repairs (vehicle_id, repair_date desc);
-- The "what is still open" list — both unfinished statuses
create index repairs_status_idx       on public.repairs (status) where status in ('w_trakcie', 'czeka_na_czesci');
-- Full-text-ish search in the description ("rozrząd", "stuka")
create index repairs_description_trgm_idx on public.repairs using gin (description extensions.gin_trgm_ops);

-- Mileage entered on a repair updates the vehicle mileage — but only UPWARDS.
-- That way adding an old repair from years ago does not roll back the current odometer state.
-- The `mileage` field on a repair stays optional: the mechanic fills it in when they want to.
create or replace function public.bump_vehicle_mileage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.mileage is not null then
    update public.vehicles
       set current_mileage = new.mileage
     where id = new.vehicle_id
       and (current_mileage is null or current_mileage < new.mileage);
  end if;
  return new;
end;
$$;

create trigger repairs_bump_vehicle_mileage
  after insert or update of mileage on public.repairs
  for each row execute function public.bump_vehicle_mileage();

-- =====================================================================
--  MODULE 2 — PARTS USED IN A REPAIR
-- =====================================================================
create table public.repair_parts (
  id             uuid primary key default gen_random_uuid(),
  workshop_id    uuid not null references public.workshops (id) on delete restrict,
  repair_id      uuid not null references public.repairs (id) on delete cascade,
  name           text not null check (length(btrim(name)) > 0),
  catalog_number text,
  supplier       text,
  created_at     timestamptz not null default now()
);

comment on table public.repair_parts is 'Parts used in a repair. No prices and no quantities — a deliberate MVP decision (prices = Phase 2).';
comment on column public.repair_parts.supplier is 'Wholesaler the part came from — free text, suggested from earlier entries.';
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

create index repair_parts_workshop_id_idx    on public.repair_parts (workshop_id);
create index repair_parts_repair_id_idx      on public.repair_parts (repair_id);
create index repair_parts_catalog_trgm_idx   on public.repair_parts using gin (catalog_number extensions.gin_trgm_ops);
create index repair_parts_name_trgm_idx      on public.repair_parts using gin (name extensions.gin_trgm_ops);

-- =====================================================================
--  MODULE 3 — APPOINTMENTS (SCHEDULE)
-- =====================================================================
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  workshop_id      uuid not null references public.workshops (id) on delete restrict,
  appointment_date date not null,
  appointment_time time,
  client_id        uuid references public.clients (id) on delete restrict,
  vehicle_id       uuid references public.vehicles (id) on delete set null,
  title            text,
  note             text,
  status           text not null default 'umowiona'
                     check (status in ('umowiona', 'potwierdzona', 'odwolana')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,

  -- A schedule entry is either a client, or a custom title ("urlop", "odbiór części o 12").
  -- An empty row with neither would make no sense.
  constraint appointments_needs_client_or_title
    check (client_id is not null or length(btrim(coalesce(title, ''))) > 0)
);

-- Design note: the database does NOT enforce that vehicle_id belongs to client_id.
-- It could be done with a composite foreign key (unique (id, client_id) on vehicles
-- + foreign key (vehicle_id, client_id)), but then reassigning a vehicle to a new
-- owner would either fail on old appointments or rewrite history.
-- Consistency is kept by the UI: the vehicle list in the appointment form shows
-- only the vehicles of the selected client.

comment on table public.appointments is 'A simple "what is on for a given day" list: client appointments and custom entries (time off, parts pickup). Not a slot-based calendar.';
comment on column public.appointments.appointment_time is 'Optional — the workshop works in a "clients for the day" mode.';
comment on column public.appointments.client_id is 'Empty for a custom entry — then title is required.';
comment on column public.appointments.title is 'Title of an entry without a client: "urlop", "zamknięte", "odbiór części". Usually empty for a client appointment.';
comment on column public.appointments.workshop_id is 'Set by the app from the active workshop (same as clients.workshop_id) — and re-derived from client_id whenever one is chosen, so it cannot drift from the client''s own context. See appointments_set_workshop_id trigger.';

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- If the entry has a client, workshop_id follows that client — a custom
-- entry (no client) keeps whatever workshop_id the app supplied.
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

-- The main query: "what do I have today"
create index appointments_workshop_id_idx on public.appointments (workshop_id);
create index appointments_date_time_idx on public.appointments (appointment_date, appointment_time nulls last);
create index appointments_client_id_idx on public.appointments (client_id);
create index appointments_vehicle_id_idx on public.appointments (vehicle_id);

-- =====================================================================
--  MODULE 4 — SERVICE REMINDERS
-- =====================================================================
create table public.service_reminders (
  id            uuid primary key default gen_random_uuid(),
  workshop_id   uuid not null references public.workshops (id) on delete restrict,
  vehicle_id    uuid not null references public.vehicles (id) on delete cascade,
  reminder_type text not null check (length(btrim(reminder_type)) > 0),
  due_date      date,
  due_mileage   integer check (due_mileage >= 0),
  note          text,
  status        text not null default 'aktywne'
                  check (status in ('aktywne', 'zrealizowane', 'anulowane')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,

  -- A reminder without any due condition would make no sense.
  constraint service_reminders_needs_due
    check (due_date is not null or due_mileage is not null)
);

comment on table public.service_reminders is 'Reminders for the MECHANIC (never for the client): oil, inspection, timing belt. In the MVP visible only in the app — no e-mail.';
comment on column public.service_reminders.due_mileage is 'Only fires once vehicles.current_mileage is updated — that is, on the next repair with mileage filled in.';
comment on column public.service_reminders.workshop_id is 'Derived automatically from vehicle_id (see service_reminders_set_workshop_id trigger).';

create trigger service_reminders_set_updated_at
  before update on public.service_reminders
  for each row execute function public.set_updated_at();

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
create index service_reminders_vehicle_id_idx on public.service_reminders (vehicle_id);
create index service_reminders_due_idx
  on public.service_reminders (due_date nulls last)
  where status = 'aktywne';

-- =====================================================================
--  ROW LEVEL SECURITY
--
--  Model: one profile can belong to several workshops (contexts) at
--  once — e.g. "Firma" and "Garaż" — and switches between them in the
--  app. Within one workshop every member has full, equal access; there
--  is no concept of "my own" rows. Every data table carries workshop_id
--  and is only ever visible to workshop_members of that workshop.
--  The `anon` role (not signed in) has no access to anything.
--
--  !!! SECURITY PRECONDITION !!!
--  These policies grant full access to every signed-in member of a
--  workshop. That is why self sign-up ("Allow new users to sign up")
--  MUST be disabled in Supabase → Authentication → Sign In / Providers.
--  Without that, anyone who knows the app URL could create an account —
--  though with no workshop membership of their own, workshops policy
--  still requires being added to a workshop before seeing any data.
-- =====================================================================

alter table public.workshops         enable row level security;
alter table public.workshop_members  enable row level security;
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.vehicles          enable row level security;
alter table public.repairs           enable row level security;
alter table public.repair_parts      enable row level security;
alter table public.appointments      enable row level security;
alter table public.service_reminders enable row level security;

-- Workshops: visible, editable and removable only by their members.
-- Creating one is open to any signed-in user — the creator trigger above
-- adds them as the first member in the same statement.
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

-- Membership: a member of a workshop sees who else is in it, and can add
-- (invite) or remove members of workshops they already belong to.
create policy "workshop_members_odczyt_czlonkow" on public.workshop_members
  for select to authenticated
  using (workshop_id in (select public.current_workshop_ids()));

create policy "workshop_members_dodawanie" on public.workshop_members
  for insert to authenticated
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "workshop_members_usuwanie" on public.workshop_members
  for delete to authenticated
  using (workshop_id in (select public.current_workshop_ids()));

-- Profiles: every signed-in user sees both profiles, but edits only their own.
create policy "profile_odczyt_zalogowani" on public.profiles
  for select to authenticated using (true);

create policy "profile_edycja_wlasnego" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Workshop data: full access for members of the row's workshop.
create policy "klienci_czlonkowie" on public.clients
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "auta_czlonkowie" on public.vehicles
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "naprawy_czlonkowie" on public.repairs
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "czesci_czlonkowie" on public.repair_parts
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "wizyty_czlonkowie" on public.appointments
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));

create policy "przypomnienia_czlonkowie" on public.service_reminders
  for all to authenticated
  using (workshop_id in (select public.current_workshop_ids()))
  with check (workshop_id in (select public.current_workshop_ids()));
