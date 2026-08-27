-- Row-level security.
--
-- The prototype enforced visibility in the UI, which is not enforcement at all.
-- These policies mean an owner querying the API directly still cannot see
-- another farmer's herd.
--
-- Roles:
--   owner    — sees only their own animals, devices, parcels and events
--   officer  — sees everything in their ward
--   vet      — sees animals and health across all wards, no enforcement actions
--   admin    — sees everything

-- Supabase provides `auth.uid()`. Create a local stand-in only when absent, so
-- the same migration runs against a plain Postgres for testing.
create schema if not exists auth;

do $$
begin
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid language sql stable as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $body$;
    $fn$;
  end if;
end $$;

create type app_role as enum ('owner', 'officer', 'vet', 'admin');

create table staff (
  auth_user_id uuid primary key,
  full_name    text not null,
  role         app_role not null,
  ward_id      bigint references wards(id),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Helpers. SECURITY DEFINER so policies can consult `staff` without the caller
-- needing read access to it — otherwise every policy recurses.
create or replace function current_role_of()
returns app_role language sql stable security definer set search_path = public as $$
  select role from staff where auth_user_id = auth.uid() and active
$$;

create or replace function current_ward()
returns bigint language sql stable security definer set search_path = public as $$
  select ward_id from staff where auth_user_id = auth.uid() and active
$$;

create or replace function current_owner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from owners where auth_user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce(current_role_of() = 'admin', false)
$$;

/** True when the caller may see this owner's data. */
create or replace function can_see_owner(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case current_role_of()
    when 'admin'   then true
    when 'vet'     then true
    when 'officer' then exists (
      select 1 from owners o where o.id = p_owner and o.ward_id = current_ward())
    else p_owner = current_owner_id()
  end
$$;

alter table owners             enable row level security;
alter table animals            enable row level security;
alter table devices            enable row level security;
alter table land_parcels       enable row level security;
alter table geofences          enable row level security;
alter table fixes              enable row level security;
alter table containment_events enable row level security;
alter table containment_status enable row level security;
alter table command_queue      enable row level security;
alter table device_anomalies   enable row level security;
alter table staff              enable row level security;

-- owners ------------------------------------------------------------------
create policy owners_read on owners for select
  using (can_see_owner(id));
create policy owners_admin_write on owners for all
  using (is_admin()) with check (is_admin());

-- animals -----------------------------------------------------------------
create policy animals_read on animals for select
  using (can_see_owner(owner_id));
create policy animals_staff_write on animals for all
  using (coalesce(current_role_of() in ('admin', 'officer'), false))
  with check (coalesce(current_role_of() in ('admin', 'officer'), false));

-- devices -----------------------------------------------------------------
create policy devices_read on devices for select
  using (
    animal_id is null and coalesce(current_role_of() in ('admin', 'officer'), false)
    or exists (select 1 from animals a where a.id = devices.animal_id and can_see_owner(a.owner_id))
  );
create policy devices_staff_write on devices for all
  using (coalesce(current_role_of() in ('admin', 'officer'), false))
  with check (coalesce(current_role_of() in ('admin', 'officer'), false));

-- land --------------------------------------------------------------------
create policy parcels_read on land_parcels for select
  using (
    owner_id is null
    or can_see_owner(owner_id)
    or coalesce(current_role_of() in ('admin', 'officer', 'vet'), false)
  );
create policy parcels_staff_write on land_parcels for all
  using (coalesce(current_role_of() in ('admin', 'officer'), false))
  with check (coalesce(current_role_of() in ('admin', 'officer'), false));

-- Zones are public reference data to any signed-in user; boundaries are not secret.
create policy geofences_read on geofences for select using (auth.uid() is not null);
create policy geofences_staff_write on geofences for all
  using (coalesce(current_role_of() in ('admin', 'officer'), false))
  with check (coalesce(current_role_of() in ('admin', 'officer'), false));

-- telemetry ---------------------------------------------------------------
create policy fixes_read on fixes for select
  using (exists (select 1 from animals a where a.id = fixes.animal_id and can_see_owner(a.owner_id)));

create policy containment_events_read on containment_events for select
  using (exists (select 1 from animals a where a.id = containment_events.animal_id and can_see_owner(a.owner_id)));
create policy containment_events_staff_write on containment_events for update
  using (coalesce(current_role_of() in ('admin', 'officer'), false));

create policy containment_status_read on containment_status for select
  using (exists (select 1 from animals a where a.id = containment_status.animal_id and can_see_owner(a.owner_id)));

-- commands ----------------------------------------------------------------
-- Owners may not reboot or reconfigure hardware; only staff.
create policy commands_read on command_queue for select
  using (coalesce(current_role_of() in ('admin', 'officer'), false));
create policy commands_write on command_queue for insert
  with check (coalesce(current_role_of() in ('admin', 'officer'), false));

-- anomalies ---------------------------------------------------------------
create policy anomalies_admin on device_anomalies for select using (is_admin());

-- staff -------------------------------------------------------------------
create policy staff_self on staff for select using (auth_user_id = auth.uid() or is_admin());
create policy staff_admin_write on staff for all using (is_admin()) with check (is_admin());

-- The gateway connects as a dedicated role, not as a user. It must bypass RLS
-- to write telemetry for every device, so it owns these functions rather than
-- touching tables directly. In Supabase this is the service role.
alter function record_fix(text, fix_type, double precision, double precision, timestamptz,
                          text, real, smallint, real, smallint, smallint, smallint, integer, inet)
  security definer set search_path = public;
alter function record_heartbeat(text, smallint, smallint)
  security definer set search_path = public;
alter function evaluate_containment(uuid, geography, timestamptz)
  security definer set search_path = public;
