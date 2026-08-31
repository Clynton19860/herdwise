-- The last of the write access, now that there is a signed-in person to attribute
-- an action to.
--
-- Four flows accept input and then could not save it: registering an owner, an
-- animal or an incident, and logging a health record. They existed as interfaces
-- long before there was any way to know who was filling them in, which is why
-- they were left simulating a save rather than performing one.
--
-- Column-level where it matters. An incident's `ref`, `reported_at` and
-- `containment_event_id` are the evidence trail for an enforcement action, so
-- the application can move an incident through its workflow but cannot rewrite
-- how or when it was raised.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    raise notice 'role "herdwise_web" not present — nothing to grant';
    return;
  end if;

  grant insert on owners, animals, incidents, health_records to herdwise_web;

  -- Working an incident: acknowledge, escalate, assign, resolve, annotate.
  grant update (status, officer, notes, resolved_at, severity) on incidents to herdwise_web;

  -- Retiring a zone. Deleting one would orphan the containment events that cite
  -- it, so archiving is a flag rather than a delete.
  grant update (active) on geofences to herdwise_web;

  -- Correcting a registration, and moving an animal between allocations.
  grant update (name, breed, sex, birth_date, colour, status, home_parcel_id)
    on animals to herdwise_web;
  grant update (full_name, phone, address, ward_id) on owners to herdwise_web;
end $$;

/**
 * Incident references, allocated by the database.
 *
 * The report form used to invent one client-side with Math.random(), which can
 * collide and carries no ordering. A sequence gives each incident a reference
 * that is unique, sequential and readable over a phone: HRE-INC-000123.
 */
create sequence if not exists incident_ref_seq start 1;

create or replace function next_incident_ref() returns text
language sql as $$
  select 'HRE-INC-' || lpad(nextval('incident_ref_seq')::text, 6, '0')
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant usage, select on sequence incident_ref_seq to herdwise_web;
    grant execute on function next_incident_ref() to herdwise_web;
  end if;
end $$;
