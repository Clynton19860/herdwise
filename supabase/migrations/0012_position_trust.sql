-- Stop GPS scatter from opening breaches.
--
-- The first containment event this platform ever recorded was a false positive.
-- The tag sat charging indoors while its reported position wandered 279 m,
-- ending 256 m outside a paddock it never left, and the engine correctly applied
-- the rules it was given: two consecutive fixes beyond an 8 m tolerance, more
-- than 60 seconds apart.
--
-- Tuning those numbers would not fix it. The plot is 44.8 m across and the
-- scatter averaged 46 m between consecutive fixes — the measurement error is
-- larger than the thing being measured, so no tolerance both catches a real
-- departure and ignores this.
--
-- What does distinguish them is already in the packet. The tag reports its own
-- speed, and on every one of those scattered fixes it said 1 km/h or less. A
-- device that reports it is stationary while its position moves faster than a
-- person walks is contradicting itself, and the position is the part to doubt.

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
  v_trusted     boolean := true;
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
      v_trusted := false;
    end if;

    -- The tag carries its own speedometer, and it disagrees with its own
    -- positions. Measured on the pilot device: 21 of 26 consecutive fixes
    -- reported 1 km/h or less while the position wandered an average of 46 m
    -- between them, and up to 330 m. That is multipath scatter indoors, not an
    -- animal, and taking it at face value opened a breach 256 m from a paddock
    -- the tag never left.
    --
    -- A tag that says it is standing still, while appearing to travel faster
    -- than a person walks, is reporting a position it cannot support.
    if p_speed_kph is not null and p_speed_kph <= 2 and v_speed > 8 then
      insert into device_anomalies (imei, device_id, kind, detail)
           values (p_imei, v_device.id, 'position_contradicts_speed',
                   jsonb_build_object('reported_kph', p_speed_kph,
                                      'implied_kph', round(v_speed::numeric, 1)));
      v_trusted := false;
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

  -- Two gates now. Only GPS advances the state machine, and only a GPS position
  -- the device's own telemetry corroborates. An untrusted fix is still stored —
  -- discarding it would hide the scatter from anyone diagnosing the tag — it
  -- simply does not get a vote on whether an animal has left its allocation.
  if p_fix = 'gps' and v_trusted and v_device.animal_id is not null then
    v_result := evaluate_containment(v_device.animal_id, v_geom, p_recorded_at);
  end if;

  return v_result;
end $$;
