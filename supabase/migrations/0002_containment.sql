-- Containment engine.
--
-- A naive ST_Contains() per fix flaps constantly: ten metres of GPS jitter at a
-- boundary produces in-out-in-out, every flap becomes an alert, and officers
-- mute the system inside a fortnight. Four things prevent that:
--
--   1. tolerance band  — a buffer roughly the size of GPS error is "boundary",
--                        not "out"
--   2. dwell           — N consecutive fixes AND T seconds outside before a
--                        breach opens
--   3. hysteresis      — M consecutive fixes back inside before it closes
--   4. fix-type gating — cell-tower fixes never open or close an event; they
--                        can be kilometres out and only update "last seen"
--
-- All four thresholds are per-parcel columns, not constants.

-- ---------------------------------------------------------------- helpers

create or replace function zone_containing(p geography)
returns uuid language sql stable as $$
  select id from geofences
   where active and st_intersects(geom, p)
   order by area_ha asc   -- the most specific zone wins
   limit 1
$$;

-- ---------------------------------------------------------------- engine

/**
 * Advance one animal's containment state machine by a single fix.
 * Returns a jsonb describing what changed, or null when nothing did.
 */
create or replace function evaluate_containment(
  p_animal_id  uuid,
  p_geom       geography,
  p_at         timestamptz
) returns jsonb language plpgsql as $$
declare
  v_parcel      land_parcels%rowtype;
  v_status      containment_status%rowtype;
  v_distance    real;
  v_state       containment_state;
  v_event_id    uuid;
  v_result      jsonb := null;
  v_zone        uuid;
begin
  select p.* into v_parcel
    from animals a join land_parcels p on p.id = a.home_parcel_id
   where a.id = p_animal_id;

  -- No allocation assigned means nothing to be outside of. Not an error:
  -- newly registered animals legitimately sit in this state.
  if not found then
    return null;
  end if;

  insert into containment_status (animal_id, parcel_id)
       values (p_animal_id, v_parcel.id)
  on conflict (animal_id) do nothing;

  select * into v_status from containment_status
   where animal_id = p_animal_id for update;

  -- ST_Distance on geography returns metres, and 0 when the point is inside.
  v_distance := st_distance(v_parcel.geom, p_geom);

  v_state := case
    when v_distance <= 0                     then 'inside'
    when v_distance <= v_parcel.tolerance_m  then 'boundary'
    else 'outside'
  end;

  if v_state = 'outside' then
    v_status.outside_streak := v_status.outside_streak + 1;
    v_status.inside_streak  := 0;
    v_status.outside_since  := coalesce(v_status.outside_since, p_at);

    if v_status.open_event_id is null
       and v_status.outside_streak >= v_parcel.breach_fixes
       and extract(epoch from (p_at - v_status.outside_since)) >= v_parcel.breach_dwell_s
    then
      v_zone := zone_containing(p_geom);

      insert into containment_events (
        animal_id, parcel_id, opened_at, opened_geom,
        max_distance_m, entered_zone_id, fix_count)
      values (
        p_animal_id, v_parcel.id, v_status.outside_since, p_geom,
        v_distance, v_zone, v_status.outside_streak)
      returning id into v_event_id;

      v_status.open_event_id := v_event_id;

      v_result := jsonb_build_object(
        'event', 'breach_opened',
        'event_id', v_event_id,
        'animal_id', p_animal_id,
        'parcel_id', v_parcel.id,
        'parcel_name', v_parcel.name,
        'distance_m', round(v_distance::numeric, 1),
        'entered_zone_id', v_zone,
        'outside_since', v_status.outside_since);

    elsif v_status.open_event_id is not null then
      update containment_events
         set max_distance_m = greatest(coalesce(max_distance_m, 0), v_distance),
             fix_count      = fix_count + 1,
             entered_zone_id = coalesce(entered_zone_id, zone_containing(p_geom))
       where id = v_status.open_event_id;
    end if;

  else
    -- Inside, or within the tolerance band: both count as contained.
    v_status.inside_streak  := v_status.inside_streak + 1;
    v_status.outside_streak := 0;

    if v_status.open_event_id is not null then
      if v_status.inside_streak >= v_parcel.clear_fixes then
        update containment_events
           set status = 'resolved', closed_at = p_at
         where id = v_status.open_event_id;

        v_result := jsonb_build_object(
          'event', 'breach_resolved',
          'event_id', v_status.open_event_id,
          'animal_id', p_animal_id,
          'parcel_id', v_parcel.id,
          'parcel_name', v_parcel.name);

        v_status.open_event_id := null;
        v_status.outside_since := null;
      end if;
    else
      v_status.outside_since := null;
    end if;
  end if;

  update containment_status
     set parcel_id         = v_parcel.id,
         state             = v_state,
         distance_m        = v_distance,
         outside_streak    = v_status.outside_streak,
         inside_streak     = v_status.inside_streak,
         outside_since     = v_status.outside_since,
         open_event_id     = v_status.open_event_id,
         last_evaluated_at = p_at
   where animal_id = p_animal_id;

  return v_result;
end $$;

-- ---------------------------------------------------------------- ingest

/**
 * The gateway's single entry point. Everything a position packet implies —
 * device health, the fix row, and the containment decision — happens here in
 * one transaction, so a breach can never be observed without its fix.
 */
create or replace function record_fix(
  p_imei          text,
  p_fix           fix_type,
  p_lat           double precision,
  p_lng           double precision,
  p_recorded_at   timestamptz,
  p_device_time   text     default null,
  p_speed_kph     real     default null,
  p_heading_deg   smallint default null,
  p_altitude_m    real     default null,
  p_satellites    smallint default null,
  p_battery_pct   smallint default null,
  p_signal_pct    smallint default null,
  p_alert_bits    integer  default 0,
  p_source_ip     inet     default null
) returns jsonb language plpgsql as $$
declare
  v_device    devices%rowtype;
  v_geom      geography(Point, 4326);
  v_result    jsonb := null;
  v_prev      record;
  v_speed     double precision;
begin
  v_geom := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  select * into v_device from devices where imei = p_imei;

  if not found then
    -- The protocol carries no authentication, so an unknown IMEI is a security
    -- event as much as an operational one. Provision it unassigned so an
    -- officer can claim it, and record the anomaly either way.
    insert into devices (imei, first_seen_ip)
         values (p_imei, p_source_ip)
      returning * into v_device;
    insert into device_anomalies (imei, device_id, kind, detail)
         values (p_imei, v_device.id, 'unknown_device',
                 jsonb_build_object('source_ip', p_source_ip));
  elsif v_device.first_seen_ip is null and p_source_ip is not null then
    update devices set first_seen_ip = p_source_ip where id = v_device.id;
  elsif p_source_ip is not null and v_device.first_seen_ip is distinct from p_source_ip then
    -- Same IMEI from a new source. Either a carrier IP change or a clone.
    insert into device_anomalies (imei, device_id, kind, detail)
         values (p_imei, v_device.id, 'source_ip_changed',
                 jsonb_build_object('was', v_device.first_seen_ip, 'now', p_source_ip));
  end if;

  -- Plausibility: a cow that appears to have moved at 300 km/h did not.
  -- Only meaningful between two GPS fixes.
  if p_fix = 'gps' and v_device.last_position is not null and v_device.last_fix_at is not null
     and v_device.last_fix_type = 'gps' and p_recorded_at > v_device.last_fix_at then
    v_speed := st_distance(v_device.last_position, v_geom)
               / greatest(extract(epoch from (p_recorded_at - v_device.last_fix_at)), 1) * 3.6;
    if v_speed > 120 then
      insert into device_anomalies (imei, device_id, kind, detail)
           values (p_imei, v_device.id, 'implausible_speed',
                   jsonb_build_object('kph', round(v_speed::numeric, 1)));
    end if;
  end if;

  begin
    insert into fixes (
      device_id, animal_id, recorded_at, device_time_raw, fix, geom,
      speed_kph, heading_deg, altitude_m, satellites,
      battery_pct, signal_pct, alert_bits)
    values (
      v_device.id, v_device.animal_id, p_recorded_at, p_device_time, p_fix, v_geom,
      p_speed_kph, p_heading_deg, p_altitude_m, p_satellites,
      p_battery_pct, p_signal_pct, p_alert_bits);
  exception when check_violation then
    -- No partition for this month yet. Create it and retry once rather than
    -- dropping a position we already have in hand.
    perform ensure_fixes_partition(p_recorded_at::date);
    insert into fixes (
      device_id, animal_id, recorded_at, device_time_raw, fix, geom,
      speed_kph, heading_deg, altitude_m, satellites,
      battery_pct, signal_pct, alert_bits)
    values (
      v_device.id, v_device.animal_id, p_recorded_at, p_device_time, p_fix, v_geom,
      p_speed_kph, p_heading_deg, p_altitude_m, p_satellites,
      p_battery_pct, p_signal_pct, p_alert_bits);
  end;

  update devices
     set last_seen_at  = now(),
         last_fix_at   = p_recorded_at,
         last_fix_type = p_fix::text,
         last_position = v_geom,
         battery_pct   = coalesce(p_battery_pct, battery_pct),
         signal_pct    = coalesce(p_signal_pct, signal_pct)
   where id = v_device.id;

  -- Fix-type gate: only GPS advances the containment state machine.
  if p_fix = 'gps' and v_device.animal_id is not null then
    v_result := evaluate_containment(v_device.animal_id, v_geom, p_recorded_at);
  end if;

  return v_result;
end $$;

/** Heartbeats carry no position but do carry device health. */
create or replace function record_heartbeat(
  p_imei text, p_battery_pct smallint, p_signal_pct smallint
) returns void language plpgsql as $$
begin
  insert into devices (imei, battery_pct, signal_pct, last_seen_at)
       values (p_imei, p_battery_pct, p_signal_pct, now())
  on conflict (imei) do update
     set battery_pct  = coalesce(excluded.battery_pct, devices.battery_pct),
         signal_pct   = coalesce(excluded.signal_pct, devices.signal_pct),
         last_seen_at = now();
end $$;
