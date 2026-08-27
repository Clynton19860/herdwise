-- Records the dashboard needs that the core schema did not yet model:
-- enforcement incidents, health and vaccination history, and the few animal
-- attributes the registry captures but telemetry never supplies.

-- ---------------------------------------------------------------- animals

alter table animals
  add column weight_kg numeric(6,1) check (weight_kg > 0),
  add column height_cm integer check (height_cm > 0),
  add column marks text;

-- ---------------------------------------------------------------- incidents

create type incident_type as enum
  ('stray', 'theft', 'boundary_breach', 'disease_alert', 'injured', 'death');
create type incident_severity as enum ('low', 'medium', 'high', 'critical');
create type incident_status as enum ('open', 'in_progress', 'resolved', 'escalated');

create table incidents (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,
  type          incident_type not null,
  severity      incident_severity not null,
  status        incident_status not null default 'open',
  animal_id     uuid references animals(id) on delete set null,
  owner_id      uuid references owners(id) on delete set null,
  ward_id       bigint references wards(id),
  -- Where it happened, and what to call that place in a report.
  geom          geography(Point, 4326),
  location_label text,
  officer       text,
  notes         text,
  reported_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  -- Set when the incident was raised automatically by the containment engine
  -- rather than by a person. The evidence trail for an enforcement action.
  containment_event_id uuid references containment_events(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index incidents_status_idx on incidents (status, reported_at desc);
create index incidents_animal_idx on incidents (animal_id, reported_at desc);
create index incidents_geom_idx on incidents using gist (geom);
create unique index incidents_one_open_per_event
  on incidents (containment_event_id)
  where containment_event_id is not null;

create sequence if not exists incident_ref_seq start 1000;

/**
 * Raise an incident from a containment breach. Called by the gateway after
 * `record_fix()` reports one, so an officer sees a case rather than a log line.
 * Idempotent: one incident per event, enforced by the index above.
 */
create or replace function incident_from_containment(p_event_id uuid)
returns uuid language plpgsql as $$
declare
  v_event containment_events%rowtype;
  v_animal animals%rowtype;
  v_ref text;
  v_id uuid;
begin
  select * into v_event from containment_events where id = p_event_id;
  if not found then return null; end if;

  select * into v_animal from animals where id = v_event.animal_id;

  v_ref := 'INC-' || to_char(v_event.opened_at, 'YYYY') || '-' ||
           lpad((nextval('incident_ref_seq'))::text, 4, '0');

  insert into incidents (
    ref, type, severity, status, animal_id, owner_id, ward_id,
    geom, location_label, notes, reported_at, containment_event_id)
  values (
    v_ref, 'boundary_breach',
    (case when v_event.max_distance_m > 500 then 'high' else 'medium' end)::incident_severity,
    'open', v_event.animal_id, v_animal.owner_id,
    (select ward_id from land_parcels where id = v_event.parcel_id),
    v_event.opened_geom,
    (select name from land_parcels where id = v_event.parcel_id),
    format('%s left its allocation; %s m outside at detection.',
           coalesce(v_animal.tag, 'Animal'), round(coalesce(v_event.max_distance_m, 0)::numeric, 0)),
    v_event.opened_at, p_event_id)
  on conflict (containment_event_id) where containment_event_id is not null
    do nothing
  returning id into v_id;

  -- Already raised for this breach: hand back the existing case, so callers can
  -- treat this as "the incident for that event" rather than a failure.
  if v_id is null then
    select id into v_id from incidents where containment_event_id = p_event_id;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------- health

create type health_record_type as enum
  ('vaccination', 'treatment', 'diagnosis', 'inspection', 'quarantine');

create table health_records (
  id           uuid primary key default gen_random_uuid(),
  animal_id    uuid not null references animals(id) on delete cascade,
  type         health_record_type not null,
  occurred_on  date not null,
  -- Vaccinations are the only kind with a scheduled follow-up; the health
  -- dashboard is built almost entirely on this column.
  next_due_on  date,
  description  text not null,
  medicine     text,
  veterinarian text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index health_records_animal_idx on health_records (animal_id, occurred_on desc);
create index health_records_due_idx on health_records (next_due_on)
  where next_due_on is not null;

/** Vaccination status per animal — what the health screen actually asks for. */
create or replace view animal_health_summary as
select
  a.id as animal_id,
  (select max(occurred_on) from health_records h
    where h.animal_id = a.id and h.type = 'vaccination') as last_vaccination,
  (select min(next_due_on) from health_records h
    where h.animal_id = a.id and h.next_due_on >= current_date) as next_vaccination,
  (select min(next_due_on) from health_records h
    where h.animal_id = a.id and h.next_due_on < current_date) as overdue_since
from animals a;

-- ---------------------------------------------------------------- rls

alter table incidents      enable row level security;
alter table health_records enable row level security;

create policy incidents_read on incidents for select
  using (
    animal_id is null and coalesce(current_role_of() in ('admin','officer'), false)
    or exists (select 1 from animals a where a.id = incidents.animal_id and can_see_owner(a.owner_id))
  );
create policy incidents_staff_write on incidents for all
  using (coalesce(current_role_of() in ('admin','officer'), false))
  with check (coalesce(current_role_of() in ('admin','officer'), false));

create policy health_read on health_records for select
  using (exists (select 1 from animals a where a.id = health_records.animal_id and can_see_owner(a.owner_id)));
-- Vets write health records; officers do not.
create policy health_vet_write on health_records for all
  using (coalesce(current_role_of() in ('admin','vet'), false))
  with check (coalesce(current_role_of() in ('admin','vet'), false));

alter function incident_from_containment(uuid) security definer set search_path = public;
