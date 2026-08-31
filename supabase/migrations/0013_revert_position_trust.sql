-- Back out 0012. The signal it relied on carries no information.
--
-- 0012 refused to advance containment when the tag reported it was stationary
-- while its position appeared to move faster than a person walks. The premise
-- was that the tag's speedometer could corroborate its position.
--
-- It cannot. Across every fix this device has ever sent, 79 of 87 report exactly
-- 1 km/h — including while genuinely moving. The field is an idle default, not a
-- measurement, so "the tag says it is stationary" is true almost always and
-- distinguishes nothing.
--
-- Worse, the gate would have suppressed real movement: the containment suite
-- moves its fixture at implied speeds of 24 to 38 km/h with the same 1.2 km/h
-- reported, and every breach assertion in it would have stopped firing.
--
-- This restores record_fix to its 0002 behaviour. The absolute 120 km/h
-- implausibility check stays, because that one does not depend on the tag
-- agreeing with itself.

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
