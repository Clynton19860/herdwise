-- Herdwise core schema — land, animals, devices, telemetry.
--
-- Design notes that matter:
--   * Positions are stored as real lat/lng geography, never as canvas units.
--     The prototype's 0-100 x/y space is a presentation detail and is derived
--     from this, not the other way round.
--   * `fixes` is partitioned by month from the outset. At 2,000 devices on a
--     5-minute interval this table takes ~210M rows/year; retrofitting
--     partitioning onto that is a very bad weekend.
--   * Every containment threshold is per-parcel configuration, not a constant.
--     The City will change its mind about what counts as a breach, and that
--     must not be a deployment.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- wards

create table wards (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  geom        geography(MultiPolygon, 4326),
  created_at  timestamptz not null default now()
);
create index wards_geom_idx on wards using gist (geom);

-- ---------------------------------------------------------------- owners

create table owners (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable: an owner may be registered by an officer before they ever have
  -- a login. Populated when they claim the account.
  auth_user_id  uuid unique,
  full_name     text not null,
  national_id   text not null unique,
  phone         text not null,
  ward_id       bigint references wards(id),
  address       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index owners_ward_idx on owners (ward_id);

-- ---------------------------------------------------------------- land

-- A land_parcel is a legal fact: who has been allocated what.
create type tenure_type as enum ('communal', 'leasehold', 'freehold', 'municipal', 'unallocated');

create table land_parcels (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique,
  name         text not null,
  tenure       tenure_type not null default 'communal',
  ward_id      bigint references wards(id),
  owner_id     uuid references owners(id) on delete set null,
  geom         geography(Polygon, 4326) not null,
  -- Derived once on write rather than recomputed per query.
  area_ha      numeric(12,2) generated always as (
                 round((st_area(geom) / 10000.0)::numeric, 2)
               ) stored,

  -- Containment policy. Per-parcel because a road-reserve boundary and a
  -- communal grazing edge do not deserve the same sensitivity.
  tolerance_m       integer not null default 25   check (tolerance_m between 0 and 500),
  breach_fixes      integer not null default 2    check (breach_fixes between 1 and 20),
  breach_dwell_s    integer not null default 180  check (breach_dwell_s between 0 and 86400),
  clear_fixes       integer not null default 2    check (clear_fixes between 1 and 20),

  created_at   timestamptz not null default now()
);
create index land_parcels_geom_idx on land_parcels using gist (geom);
create index land_parcels_owner_idx on land_parcels (owner_id);
create index land_parcels_ward_idx on land_parcels (ward_id);

-- A geofence is policy drawn on top of the land: grazing, restricted, etc.
create type zone_type as enum ('grazing', 'restricted', 'watering', 'buffer', 'quarantine');

create table geofences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        zone_type not null,
  ward_id     bigint references wards(id),
  geom        geography(Polygon, 4326) not null,
  area_ha     numeric(12,2) generated always as (
                round((st_area(geom) / 10000.0)::numeric, 2)
              ) stored,
  capacity    integer,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index geofences_geom_idx on geofences using gist (geom);

-- ---------------------------------------------------------------- animals

create type species_type      as enum ('cattle', 'goat', 'sheep', 'donkey', 'pig');
create type animal_sex        as enum ('male', 'female');
create type animal_status     as enum ('healthy', 'monitoring', 'alert', 'quarantined', 'deceased');

create table animals (
  id              uuid primary key default gen_random_uuid(),
  tag             text not null unique,
  name            text,
  species         species_type not null,
  breed           text,
  sex             animal_sex,
  birth_date      date,
  colour          text,
  status          animal_status not null default 'healthy',
  owner_id        uuid not null references owners(id) on delete restrict,
  -- The allocation this animal is expected to stay within. Containment is
  -- evaluated against this and nothing else.
  home_parcel_id  uuid references land_parcels(id) on delete set null,
  registered_on   date not null default current_date,
  created_at      timestamptz not null default now()
);
create index animals_owner_idx on animals (owner_id);
create index animals_home_parcel_idx on animals (home_parcel_id);
create index animals_status_idx on animals (status) where status <> 'healthy';

-- ---------------------------------------------------------------- devices

create type device_type as enum ('hcs048', 'smart_collar', 'airtag', 'other');

create table devices (
  id             uuid primary key default gen_random_uuid(),
  -- The IMEI is the only identity the wire protocol carries, so it is the
  -- join key from the gateway and must be unique.
  imei           text not null unique check (imei ~ '^[0-9]{14,17}$'),
  type           device_type not null default 'hcs048',
  animal_id      uuid unique references animals(id) on delete set null,
  iccid          text,
  imsi           text,
  firmware       text,
  model          text,

  -- Rolling health, updated on every packet. Denormalised deliberately: this
  -- is read on every dashboard load and must not require scanning `fixes`.
  battery_pct    smallint check (battery_pct between 0 and 100),
  signal_pct     smallint check (signal_pct between 0 and 100),
  last_seen_at   timestamptz,
  last_fix_at    timestamptz,
  last_fix_type  text,
  last_position  geography(Point, 4326),

  -- Anti-spoof: the protocol has no authentication whatsoever, so we pin the
  -- source we first saw and alert on change. See H5 in the build plan.
  first_seen_ip  inet,
  reporting_interval_s integer,
  created_at     timestamptz not null default now()
);
create index devices_animal_idx on devices (animal_id);
create index devices_last_seen_idx on devices (last_seen_at desc nulls last);

-- ---------------------------------------------------------------- fixes

-- Fix quality gates enforcement. A cell-tower fix can be kilometres out; acting
-- on one produces false breaches and destroys officer trust in the system.
create type fix_type as enum ('gps', 'wifi', 'lbs', 'none');

create table fixes (
  id            bigint generated always as identity,
  device_id     uuid not null references devices(id) on delete cascade,
  animal_id     uuid references animals(id) on delete set null,
  -- Device-reported time. See Q4: the vendor doc says this may not be UTC.
  recorded_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  -- Raw device timestamp preserved verbatim so a wrong UTC assumption is
  -- recoverable without re-reading the tags.
  device_time_raw text,
  fix            fix_type not null,
  geom          geography(Point, 4326) not null,
  speed_kph     real,
  heading_deg   smallint,
  altitude_m    real,
  satellites    smallint,
  battery_pct   smallint,
  signal_pct    smallint,
  alert_bits    integer not null default 0,
  primary key (id, recorded_at)
) partition by range (recorded_at);

create index fixes_device_time_idx on fixes (device_id, recorded_at desc);
create index fixes_animal_time_idx on fixes (animal_id, recorded_at desc);
create index fixes_geom_idx on fixes using gist (geom);

-- Partition helper. Call from a scheduled job a month ahead; never rely on it
-- being called just in time.
create or replace function ensure_fixes_partition(target date)
returns text language plpgsql as $$
declare
  start_at date := date_trunc('month', target)::date;
  end_at   date := (date_trunc('month', target) + interval '1 month')::date;
  name     text := format('fixes_%s', to_char(start_at, 'YYYY_MM'));
begin
  if to_regclass('public.' || name) is null then
    execute format(
      'create table %I partition of fixes for values from (%L) to (%L)',
      name, start_at, end_at);
  end if;
  return name;
end $$;

select ensure_fixes_partition(current_date);
select ensure_fixes_partition((current_date + interval '1 month')::date);

-- ---------------------------------------------------------------- containment

create type containment_state as enum ('inside', 'boundary', 'outside');

-- One row per animal: the live state machine the engine advances.
create table containment_status (
  animal_id          uuid primary key references animals(id) on delete cascade,
  parcel_id          uuid references land_parcels(id) on delete set null,
  state              containment_state not null default 'inside',
  distance_m         real not null default 0,
  outside_streak     integer not null default 0,
  inside_streak      integer not null default 0,
  outside_since      timestamptz,
  open_event_id      uuid,
  last_evaluated_at  timestamptz
);

create type containment_status_kind as enum ('open', 'resolved');

-- Breach lifecycle. One row per episode, not per crossing fix.
create table containment_events (
  id             uuid primary key default gen_random_uuid(),
  animal_id      uuid not null references animals(id) on delete cascade,
  parcel_id      uuid references land_parcels(id) on delete set null,
  status         containment_status_kind not null default 'open',
  opened_at      timestamptz not null,
  closed_at      timestamptz,
  -- Where it was when we decided it had left, and how far out it got.
  opened_geom    geography(Point, 4326),
  max_distance_m real,
  -- Which zone it wandered into, if any — the useful half of the alert.
  entered_zone_id uuid references geofences(id) on delete set null,
  fix_count      integer not null default 0,
  notified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index containment_events_animal_idx on containment_events (animal_id, opened_at desc);
create index containment_events_open_idx on containment_events (status) where status = 'open';

alter table containment_status
  add constraint containment_status_event_fk
  foreign key (open_event_id) references containment_events(id) on delete set null;

-- ---------------------------------------------------------------- commands

create type command_state as enum ('queued', 'sent', 'acked', 'failed', 'expired');

-- The app writes here; the gateway claims rows and pushes them down the socket
-- it already holds. The web tier never talks to a device.
create table command_queue (
  id            uuid primary key default gen_random_uuid(),
  device_id     uuid not null references devices(id) on delete cascade,
  command       text not null,
  payload       text not null,
  state         command_state not null default 'queued',
  requested_by  uuid,
  queued_at     timestamptz not null default now(),
  sent_at       timestamptz,
  settled_at    timestamptz,
  result        text,
  error         text,
  expires_at    timestamptz not null default now() + interval '1 hour'
);
create index command_queue_pending_idx
  on command_queue (device_id, queued_at)
  where state = 'queued';

-- ---------------------------------------------------------------- anomalies

-- Protocol and plausibility problems. On a plaintext, IMEI-only protocol this
-- is the audit trail that catches spoofing and firmware drift.
create table device_anomalies (
  id          bigint generated always as identity primary key,
  imei        text,
  device_id   uuid references devices(id) on delete set null,
  kind        text not null,
  detail      jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);
create index device_anomalies_time_idx on device_anomalies (observed_at desc);
create index device_anomalies_kind_idx on device_anomalies (kind, observed_at desc);
