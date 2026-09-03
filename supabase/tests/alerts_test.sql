-- Alarms, exercised against a real database.
--
-- This suite exists because of a bug that real hardware found. The pilot tag's
-- button was pressed on 2 September 2026; it sent `ALERT:0082` — bit 1, SOS —
-- on a `LOCA:W;GDATA:V` frame. The gateway decoded it perfectly and stored
-- nothing, because alert bits lived on the `fixes` row and a frame with no GPS
-- never became one.
--
-- The tags that cannot see satellites are the ones under cover: in a shed, in a
-- vehicle, under a tarpaulin. So the case that was being dropped is precisely
-- the case the City is buying the system for.
--
-- Everything runs inside a transaction that is rolled back.

begin;

create temporary table test_results (n serial, what text, ok boolean) on commit drop;

create or replace function aassert(ok boolean, what text) returns void language plpgsql as $$
begin
  insert into test_results (what, ok) values (what, ok);
  if ok then raise notice '  ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

do $$
declare
  v_ward bigint; v_owner uuid; v_animal uuid; v_device uuid; v_bare uuid;
  r jsonb; r2 jsonb; inc incidents%rowtype; a device_alerts%rowtype; c integer;
begin
  select id into v_ward from wards order by id limit 1;
  insert into owners (full_name, national_id, phone, ward_id)
       values ('ALERT TEST Owner', 'AT-000-001', '+263 77 000 9001', v_ward)
    returning id into v_owner;
  insert into animals (tag, name, species, owner_id)
       values ('ALERT-TEST-0001', 'Alarm Test Cow', 'cattle', v_owner)
    returning id into v_animal;
  insert into devices (imei, animal_id) values ('869999000000001', v_animal)
    returning id into v_device;

  -- The last position anyone actually saw, two hours before the alarm.
  insert into fixes (device_id, recorded_at, fix, geom)
       values (v_device, now() - interval '2 hours', 'gps',
               st_setsrid(st_makepoint(31.0335, -17.8252), 4326)::geography);

  raise notice E'\n1. an SOS with no GPS fix is recorded at all';
  r := record_alert('869999000000001', 2, array['sos'], '0002', 'wifi',
                    null, null, 28, 100, now(), '105.245.0.1');
  perform aassert((r->>'alert_id') is not null, 'alert row created without a position');
  perform aassert((r->>'sos')::boolean, 'reported as an SOS');

  raise notice E'\n2. and raises a critical case';
  perform aassert((r->>'incident_id') is not null, 'incident raised');
  select * into inc from incidents where id = (r->>'incident_id')::uuid;
  perform aassert(inc.type = 'panic', 'typed as a panic, not guessed as theft');
  perform aassert(inc.severity = 'critical', 'critical severity');
  perform aassert(inc.status = 'open', 'open for an officer to work');
  perform aassert(inc.animal_id = v_animal, 'attached to the animal');
  perform aassert(inc.owner_id = v_owner, 'attached to the owner');
  perform aassert(inc.device_id = v_device, 'attached to the device');
  perform aassert(inc.ward_id = v_ward, 'carries the ward for routing');

  raise notice E'\n3. it answers "where was it last seen"';
  select * into a from device_alerts where id = (r->>'alert_id')::uuid;
  perform aassert(a.geom is not null, 'carries the last known position');
  perform aassert(a.position_is_last_known, 'and marks it as last known, not live');
  perform aassert(a.position_age_s between 7100 and 7300, 'with the age of that position');
  perform aassert(inc.geom is not null, 'the incident carries it too');
  perform aassert(inc.location_label = 'Last known position', 'labelled honestly');
  perform aassert(inc.notes like '%120 minutes old%', 'the note dates the position');

  raise notice E'\n4. a tag in alarm does not create a hundred cases';
  r2 := record_alert('869999000000001', 2, array['sos'], '0002', 'wifi',
                     null, null, 28, 100, now(), '105.245.0.1');
  perform aassert((r2->>'alert_id') <> (r->>'alert_id'), 'every alarm frame is still recorded');
  perform aassert((r2->>'incident_id') = (r->>'incident_id'), 'but they share the one open case');
  select count(*) into c from incidents where device_id = v_device and type = 'panic';
  perform aassert(c = 1, 'exactly one case for the device');

  raise notice E'\n5. once worked, a later alarm opens a new case';
  update incidents set status = 'resolved', resolved_at = now() where id = inc.id;
  r2 := record_alert('869999000000001', 2, array['sos'], '0002', 'wifi',
                     null, null, 28, 100, now(), '105.245.0.1');
  perform aassert((r2->>'incident_id') <> (r->>'incident_id'), 'a fresh alarm is a fresh case');

  raise notice E'\n6. routine bits are recorded but wake nobody';
  r2 := record_alert('869999000000001', 128, array['charging'], '0080', 'wifi',
                     null, null, 94, 100, now(), '105.245.0.1');
  perform aassert((r2->>'alert_id') is not null, 'charging is recorded');
  perform aassert(not (r2->>'sos')::boolean, 'and is not an SOS');
  perform aassert((r2->>'incident_id') is null, 'and raises no case');

  raise notice E'\n7. a positioned alarm uses its own coordinates';
  r2 := record_alert('869999000000001', 2, array['sos'], '0002', 'gps',
                     -17.8300, 31.0400, 28, 100, now(), '105.245.0.1');
  select * into a from device_alerts where id = (r2->>'alert_id')::uuid;
  perform aassert(not a.position_is_last_known, 'not marked as last known');
  perform aassert(round(st_y(a.geom::geometry)::numeric, 4) = -17.8300, 'latitude from the alarm frame');
  perform aassert(round(st_x(a.geom::geometry)::numeric, 4) = 31.0400, 'longitude from the alarm frame');

  raise notice E'\n8. an unassigned tag can still cry for help';
  insert into devices (imei) values ('869999000000002') returning id into v_bare;
  r2 := record_alert('869999000000002', 2, array['sos'], '0002', 'wifi',
                     null, null, 55, 90, now(), null);
  perform aassert((r2->>'alert_id') is not null, 'alert recorded for an unassigned tag');
  select * into inc from incidents where id = (r2->>'incident_id')::uuid;
  perform aassert(inc.animal_id is null, 'with no animal attached');
  perform aassert(inc.notes like '%not assigned to an animal%', 'and the note says so');

  raise notice E'\n9. an alarm from a tag we have never seen is not lost';
  r2 := record_alert('869999000000003', 2, array['sos'], '0002', 'wifi',
                     null, null, 55, 90, now(), null);
  perform aassert((r2->>'alert_id') is not null, 'recorded against the bare IMEI');
  perform aassert((r2->>'incident_id') is null, 'but raises no case for an unknown device');
end $$;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from test_results;

rollback;
