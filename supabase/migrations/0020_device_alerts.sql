/**
 * Alerts are not positions.
 *
 * Until now an ALERT bitfield was only ever stored as a column on the `fixes`
 * row it arrived with — and the gateway discards any frame whose GPS is void.
 * So an alarm raised by a tag that could not see satellites was parsed,
 * logged, and then dropped on the floor.
 *
 * That is exactly backwards. A tag reports `GDATA:V` when it is under cover:
 * in a shed, in a vehicle, under a tarpaulin. Those are the circumstances a
 * livestock theft alarm exists for. The alarm has to survive the absence of a
 * fix, so it gets its own table and its own path to an incident.
 *
 * Observed on the pilot tag, 2 September 2026: pressing the tag's button sent
 * `ALERT:0082` — bit 1, SOS — on a `LOCA:W;GDATA:V` frame. Our gateway decoded
 * it correctly and nothing whatsoever reached the database.
 */

create table if not exists device_alerts (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid references devices(id) on delete cascade,
  imei        text not null,
  animal_id   uuid references animals(id) on delete set null,

  -- The raw bitfield and our reading of it, side by side, so a later
  -- correction to the bit map can be replayed over history.
  bits        int  not null,
  flags       text[] not null default '{}',
  raw         text,

  -- Where the tag was, if it knew. `position_is_last_known` is true when the
  -- alerting frame carried no fix and this point was carried over from the
  -- device's most recent one. An officer must never read a stale point as a
  -- live sighting, so the flag and the age travel with the coordinates.
  fix_type    text,
  geom        geography(Point, 4326),
  position_is_last_known boolean not null default false,
  position_age_s int,

  battery_pct int,
  signal_pct  int,
  source_ip   text,

  recorded_at timestamptz not null default now(),
  incident_id uuid references incidents(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists device_alerts_device_idx
  on device_alerts (device_id, recorded_at desc);
create index if not exists device_alerts_sos_idx
  on device_alerts (recorded_at desc) where 'sos' = any(flags);
create index if not exists device_alerts_geom_idx
  on device_alerts using gist (geom);

-- -------------------------------------------------------------- incidents

-- A panic alarm can arrive from a tag that is not on an animal — during
-- commissioning, or after an ear tag has been cut off, which is itself worth
-- knowing. The incident therefore hangs off the device, not only the animal.
alter table incidents add column if not exists device_id uuid
  references devices(id) on delete set null;

-- One open panic case per device. A tag in alarm re-sends every fifteen
-- seconds; without this an officer would face a hundred identical cases and
-- the real one would be invisible among them.
create unique index if not exists incidents_one_open_panic_per_device
  on incidents (device_id)
  where type = 'panic'
    and status in ('open', 'in_progress', 'escalated')
    and device_id is not null;

-- ---------------------------------------------------------------- record

/**
 * Record an alert, and raise a case if it is a panic.
 *
 * Called by the gateway for any frame carrying a non-zero ALERT field, whether
 * or not that frame also carried a usable position. Returns the alert id, and
 * the incident id when one was raised or already stood.
 */
create or replace function record_alert(
  p_imei      text,
  p_bits      int,
  p_flags     text[],
  p_raw       text,
  p_fix_type  text,
  p_lat       double precision,
  p_lng       double precision,
  p_battery   int,
  p_signal    int,
  p_recorded_at timestamptz default now(),
  p_source_ip text default null
) returns jsonb language plpgsql as $fn$
declare
  v_device   devices%rowtype;
  v_animal   animals%rowtype;
  v_geom     geography(Point, 4326);
  v_last_known boolean := false;
  v_age_s    int;
  v_alert_id uuid;
  v_incident_id uuid;
  v_ward     bigint;
  v_is_sos   boolean := 'sos' = any(coalesce(p_flags, '{}'::text[]));
begin
  select * into v_device from devices where imei = p_imei;
  if v_device.animal_id is not null then
    select * into v_animal from animals where id = v_device.animal_id;
  end if;

  if p_lat is not null and p_lng is not null then
    v_geom := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  elsif v_device.id is not null then
    -- No fix on the alerting frame. Carry the last position we did observe,
    -- clearly marked and dated, because "where was it last seen" is the first
    -- question anyone asks about an alarm — and refusing to answer it because
    -- the alarm itself had no GPS would be the original bug all over again.
    select f.geom, extract(epoch from (p_recorded_at - f.recorded_at))::int
      into v_geom, v_age_s
      from fixes f
     where f.device_id = v_device.id
     order by f.recorded_at desc
     limit 1;
    v_last_known := v_geom is not null;
  end if;

  insert into device_alerts (
    device_id, imei, animal_id, bits, flags, raw, fix_type,
    geom, position_is_last_known, position_age_s,
    battery_pct, signal_pct, source_ip, recorded_at)
  values (
    v_device.id, p_imei, v_device.animal_id, p_bits,
    coalesce(p_flags, '{}'::text[]), p_raw, p_fix_type,
    v_geom, v_last_known, v_age_s,
    p_battery, p_signal, p_source_ip, p_recorded_at)
  returning id into v_alert_id;

  -- Only a panic becomes a case. Low battery and vibration are recorded and
  -- charted; waking an officer for either would teach them to ignore the ones
  -- that matter.
  if not v_is_sos or v_device.id is null then
    return jsonb_build_object('alert_id', v_alert_id, 'sos', v_is_sos, 'incident_id', null);
  end if;

  select id into v_incident_id from incidents
   where device_id = v_device.id and type = 'panic'
     and status in ('open', 'in_progress', 'escalated')
   limit 1;

  if v_incident_id is null then
    if v_animal.owner_id is not null then
      select ward_id into v_ward from owners where id = v_animal.owner_id;
    end if;

    begin
      insert into incidents (
        ref, type, severity, status, animal_id, owner_id, ward_id, device_id,
        geom, location_label, notes, reported_at)
      values (
        next_incident_ref(), 'panic', 'critical', 'open',
        v_device.animal_id, v_animal.owner_id, v_ward, v_device.id,
        v_geom,
        case when v_last_known then 'Last known position' end,
        format('Panic alarm from tag %s%s. %s',
               coalesce(v_animal.tag, p_imei),
               case when v_device.animal_id is null
                    then ' (not assigned to an animal)' else '' end,
               case
                 when v_geom is null then 'The tag reported no position.'
                 when v_last_known then format(
                   'No fix on the alarm itself; the position shown is %s minutes old.',
                   round(coalesce(v_age_s, 0) / 60.0))
                 else 'Position taken from the alarm frame.'
               end),
        p_recorded_at)
      returning id into v_incident_id;
    exception when unique_violation then
      -- Two alarm frames landing together. The first one's case is the case.
      select id into v_incident_id from incidents
       where device_id = v_device.id and type = 'panic'
         and status in ('open', 'in_progress', 'escalated')
       limit 1;
    end;
  end if;

  update device_alerts set incident_id = v_incident_id where id = v_alert_id;

  return jsonb_build_object('alert_id', v_alert_id, 'sos', true, 'incident_id', v_incident_id);
end $fn$;

-- ---------------------------------------------------------------- grants

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on device_alerts to herdwise_web;
  else
    raise notice 'role "herdwise_web" not present — nothing to grant';
  end if;
end $grants$;
