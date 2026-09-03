-- The anomaly log, exercised against a real database.
--
-- It was built to learn the protocol from real hardware and it did that. A week
-- later ten tags had produced forty thousand rows, thirty thousand of which
-- said "this heartbeat carried the same extra fields as the last one" — burying
-- two hundred that described a real firmware fault, and growing without bound
-- on a fleet meant to reach thousands.
--
-- These assertions hold the collapse, and hold the distinction that makes it
-- safe: repeats of the same thing fold together, and different evidence does
-- not.

begin;

create temporary table test_results (n serial, what text, ok boolean) on commit drop;

create or replace function nassert(ok boolean, what text) returns void language plpgsql as $$
begin
  insert into test_results (what, ok) values (what, ok);
  if ok then raise notice '  ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

do $$
declare c integer; d jsonb; n integer;
begin
  raise notice E'\n1. repeats of the same thing collapse';
  for i in 1..50 loop
    insert into device_anomalies (imei, kind, detail, signature, last_observed_at)
    values ('869999000000010', 'undocumented_sync_fields',
            jsonb_build_object('attempt', i), 'undocumented_sync_fields', now())
    on conflict (coalesce(imei, ''), kind, coalesce(signature, kind)) do update
       set occurrences = device_anomalies.occurrences + 1, last_observed_at = now();
  end loop;

  select count(*) into c from device_anomalies
   where imei = '869999000000010' and kind = 'undocumented_sync_fields';
  perform nassert(c = 1, 'fifty occurrences are one row');

  select occurrences into n from device_anomalies
   where imei = '869999000000010' and kind = 'undocumented_sync_fields';
  perform nassert(n = 50, 'and the count is kept');

  raise notice E'\n2. the first sighting keeps its detail, not the last';
  select detail into d from device_anomalies
   where imei = '869999000000010' and kind = 'undocumented_sync_fields';
  perform nassert((d->>'attempt') = '1',
    'the occurrence that was investigated is the one retained');

  raise notice E'\n3. different evidence stays separate';
  insert into device_anomalies (imei, kind, detail, signature, last_observed_at)
  values ('869999000000010', 'position_outside_region',
          jsonb_build_object('lat', 17.88, 'lng', 30.99), '17.88,30.99', now());
  insert into device_anomalies (imei, kind, detail, signature, last_observed_at)
  values ('869999000000010', 'position_outside_region',
          jsonb_build_object('lat', 17.91, 'lng', 31.02), '17.91,31.02', now());

  select count(*) into c from device_anomalies
   where imei = '869999000000010' and kind = 'position_outside_region';
  perform nassert(c = 2,
    'two distinct impossible positions are two findings, not one repeated');

  raise notice E'\n4. two devices with the same fault are two rows';
  insert into device_anomalies (imei, kind, detail, signature, last_observed_at)
  values ('869999000000011', 'undocumented_sync_fields', '{}'::jsonb,
          'undocumented_sync_fields', now());
  select count(*) into c from device_anomalies
   where kind = 'undocumented_sync_fields' and imei like '8699990000000%';
  perform nassert(c = 2, 'a fleet-wide fault is still traceable to each device');

  raise notice E'\n5. the log stays bounded';
  -- Ten devices, eight kinds: eighty rows however long the pilot runs, rather
  -- than forty thousand a week and rising.
  select count(*) into c from device_anomalies where imei like '8699990000000%';
  -- 50 sync-field repeats + 2 distinct bad positions + 1 on a second device.
  perform nassert(c = 4, 'fifty-three writes produced four rows');
end $$;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from test_results;

rollback;
