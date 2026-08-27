-- Containment engine tests.
--
-- Replays deliberately awkward tracks through record_fix() and asserts the
-- engine behaves. The flapping test is the important one: it is the failure
-- mode that quietly destroys these deployments.

\set ON_ERROR_STOP on
begin;

-- Bypass RLS for the fixture; these run as the owner of the schema.
set local role none;

-- ------------------------------------------------------------------ fixture

-- Hatcliffe, Harare. Roughly an 800 x 800 m allocation.
create temporary table t (k text primary key, v text);

do $$
declare
  v_ward   bigint;
  v_owner  uuid;
  v_parcel uuid;
  v_animal uuid;
  v_device uuid;
begin
  insert into wards (code, name) values ('TESTW', 'Test Ward') returning id into v_ward;

  insert into owners (full_name, national_id, phone, ward_id)
       values ('Test Owner', 'TEST-NID-0001', '+263 00 000 0000', v_ward)
    returning id into v_owner;

  insert into land_parcels (reference, name, tenure, ward_id, owner_id, geom,
                            tolerance_m, breach_fixes, breach_dwell_s, clear_fixes)
       values ('TEST-P-0001', 'Test Paddock', 'communal', v_ward, v_owner,
               st_geogfromtext('POLYGON((31.0752 -17.7216, 31.0828 -17.7216,
                                         31.0828 -17.7144, 31.0752 -17.7144,
                                         31.0752 -17.7216))'),
               25, 2, 120, 2)
    returning id into v_parcel;

  insert into animals (tag, name, species, sex, owner_id, home_parcel_id)
       values ('TEST-CTL-0001', 'Test Cow', 'cattle', 'female', v_owner, v_parcel)
    returning id into v_animal;

  insert into devices (imei, type, animal_id)
       values ('999000000000001', 'hcs048', v_animal)
    returning id into v_device;

  insert into t values ('animal', v_animal::text), ('parcel', v_parcel::text);
end $$;

-- Helper: push one fix and return whatever the engine decided.
create or replace function tf(
  p_lng double precision, p_lat double precision,
  p_offset_s integer, p_fix fix_type default 'gps'
) returns jsonb language sql as $$
  select record_fix(
    '999000000000001', p_fix, p_lat, p_lng,
    timestamptz '2026-08-27 06:00:00+02' + make_interval(secs => p_offset_s),
    null, 1.2, 90::smallint, 1480, 9::smallint, 78::smallint, 92::smallint, 0, '10.0.0.1'::inet)
$$;

-- Scope every assertion to this fixture so the suite passes on a seeded
-- database as well as an empty one.
create or replace function test_animal() returns uuid language sql as $$
  select animal_id from devices where imei = '999000000000001'
$$;
create or replace function events_open() returns integer language sql as $$
  select count(*)::integer from containment_events
   where status = 'open' and animal_id = test_animal()
$$;
create or replace function events_total() returns integer language sql as $$
  select count(*)::integer from containment_events where animal_id = test_animal()
$$;
create or replace function assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', msg; end if;
  raise notice '  ok  %', msg;
end $$;

-- ------------------------------------------------------------------ tests

do $$
declare r jsonb;
begin
  raise notice E'\n1. a fix in the middle of the allocation is quiet';
  r := tf(31.0790, -17.7180, 0);
  perform assert(r is null, 'no event for an animal sitting inside');
  perform assert((select state from containment_status where animal_id = test_animal()) = 'inside', 'state = inside');
end $$;

do $$
declare r jsonb; d real;
begin
  raise notice E'\n2. GPS jitter at the boundary does NOT raise a breach';
  -- ~10 m past the eastern edge — inside the 25 m tolerance band.
  r := tf(31.0829, -17.7180, 60);
  select distance_m into d from containment_status where animal_id = test_animal();
  perform assert(d > 0 and d < 25, format('distance %s m falls in the tolerance band', round(d::numeric,1)));
  perform assert(r is null, 'no event raised for boundary jitter');
  perform assert((select state from containment_status where animal_id = test_animal()) = 'boundary', 'state = boundary');
end $$;

do $$
declare r jsonb;
begin
  raise notice E'\n3. a real excursion needs both the fix count AND the dwell';
  r := tf(31.0838, -17.7180, 120);   -- ~106 m out, streak 1
  perform assert(r is null, 'one fix outside is not yet a breach');
  perform assert((select outside_streak from containment_status where animal_id = test_animal()) = 1, 'outside_streak = 1');

  r := tf(31.0838, -17.7180, 180);   -- streak 2, only 60s elapsed of 120s dwell
  perform assert(r is null, 'fix count met but dwell not yet satisfied');
  perform assert((select outside_streak from containment_status where animal_id = test_animal()) = 2, 'outside_streak = 2');

  r := tf(31.0838, -17.7180, 240);   -- streak 3, 120s elapsed -> breach
  perform assert(r is not null, 'breach opens once both thresholds are met');
  perform assert(r->>'event' = 'breach_opened', 'event = breach_opened');
  perform assert(r->>'parcel_name' = 'Test Paddock', 'names the allocation left');
  perform assert(events_open() = 1, 'exactly one open event');
end $$;

do $$
declare r jsonb; m real;
begin
  raise notice E'\n4. while out, the event tracks how far — it does not duplicate';
  r := tf(31.0850, -17.7180, 300);   -- ~233 m out
  perform assert(r is null, 'no second event while one is already open');
  perform assert(events_total() = 1, 'still exactly one event');
  select max_distance_m into m from containment_events where animal_id = test_animal() order by opened_at desc limit 1;
  perform assert(m > 200, format('max_distance_m grew to %s m', round(m::numeric,1)));
end $$;

do $$
declare r jsonb;
begin
  raise notice E'\n5. a coarse cell-tower fix never moves the state machine';
  -- 2 km away. Acting on this is exactly how false breaches get generated.
  r := tf(31.1000, -17.7180, 330, 'lbs');
  perform assert(r is null, 'lbs fix returns no containment decision');
  perform assert(events_total() = 1, 'lbs fix did not open an event');
  perform assert((select max_distance_m from containment_events where animal_id = test_animal()) < 300,
                 'lbs fix did not pollute max_distance_m');
end $$;

do $$
declare r jsonb;
begin
  raise notice E'\n6. hysteresis on the way back in';
  r := tf(31.0790, -17.7180, 360);
  perform assert(r is null, 'one fix back inside does not resolve it');
  perform assert(events_open() = 1, 'event still open after a single inside fix');

  r := tf(31.0790, -17.7180, 420);
  perform assert(r is not null and r->>'event' = 'breach_resolved', 'resolves after clear_fixes');
  perform assert(events_open() = 0, 'no open events remain');
  perform assert((select bool_and(closed_at is not null) from containment_events where animal_id = test_animal()), 'closed_at set');
end $$;

do $$
declare r jsonb; i integer; opened integer := 0;
begin
  raise notice E'\n7. flapping across the line 20 times raises nothing';
  -- The failure mode that makes officers mute the system.
  for i in 1..20 loop
    r := tf(case when i % 2 = 0 then 31.0827 else 31.0829 end, -17.7180, 480 + i * 30);
    if r is not null then opened := opened + 1; end if;
  end loop;
  perform assert(opened = 0, '20 boundary crossings produced 0 events');
  perform assert(events_total() = 1, 'still only the one historical event');
end $$;

do $$
declare r jsonb;
begin
  raise notice E'\n8. a genuinely new excursion opens a NEW event';
  r := tf(31.0838, -17.7180, 2000);
  r := tf(31.0838, -17.7180, 2060);
  r := tf(31.0838, -17.7180, 2180);
  perform assert(r is not null and r->>'event' = 'breach_opened', 'second breach opens');
  perform assert(events_total() = 2, 'two distinct events, not a reopened one');
end $$;

do $$
declare c integer;
begin
  raise notice E'\n9. every fix was persisted, including the ignored lbs one';
  select count(*) into c from fixes where device_id = (select id from devices where imei='999000000000001');
  perform assert(c = 32, format('%s fix rows stored', c));
  select count(*) into c from fixes where fix = 'lbs' and device_id = (select id from devices where imei='999000000000001');
  perform assert(c = 1, 'the lbs fix is stored even though it was not acted on');
end $$;

do $$
declare c integer;
begin
  raise notice E'\n10. implausible movement is flagged, not silently accepted';
  -- 2 km in 30 s between two GPS fixes is ~240 km/h. No cow does that.
  perform tf(31.0790, -17.7180, 3000);
  perform tf(31.1000, -17.7180, 3030);
  select count(*) into c from device_anomalies where kind = 'implausible_speed' and imei='999000000000001';
  perform assert(c >= 1, 'implausible_speed anomaly recorded');
end $$;

do $$
begin
  raise notice E'\n--- all containment tests passed ---\n';
end $$;

rollback;
