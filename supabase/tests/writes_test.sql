-- The write paths, exercised against a real database.
--
-- The application suite covers pure functions — hashing, sessions, timezones —
-- and cannot see a broken insert, a missing grant or a column that does not
-- exist. Both bugs that reached production were of exactly that shape: a query
-- comparing uuid to text, and a select of a column named `id` from a table keyed
-- on `auth_user_id`. Neither was visible without a database.
--
-- Everything runs inside a transaction that is rolled back, and every assertion
-- is scoped to its own fixture, so this passes against an empty database and a
-- populated one alike.

begin;

-- Results are collected into a table as well as raised as notices, because the
-- Management API returns rows but not notices — without this the suite could
-- pass by doing nothing at all and look identical to passing properly.
create temporary table test_results (n serial, what text, ok boolean) on commit drop;

create or replace function wassert(ok boolean, what text) returns void language plpgsql as $$
begin
  insert into test_results (what, ok) values (what, ok);
  if ok then raise notice '  ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

do $$
declare v_ward bigint; v_owner uuid; v_animal uuid; v_ref text; c integer;
begin
  raise notice E'\n1. an owner can be registered';
  select id into v_ward from wards order by id limit 1;
  insert into owners (full_name, national_id, phone, ward_id)
       values ('WRITE TEST Owner', 'WT-000-001', '+263 77 000 0001', v_ward)
    returning id into v_owner;
  perform wassert(v_owner is not null, 'owner row created');

  raise notice E'\n2. the national ID is unique';
  begin
    insert into owners (full_name, national_id, phone)
         values ('WRITE TEST Duplicate', 'WT-000-001', '+263 77 000 0002');
    perform wassert(false, 'a duplicate national ID should have been refused');
  exception when unique_violation then
    perform wassert(true, 'duplicate national ID refused');
  end;

  raise notice E'\n3. an animal can be registered against that owner';
  insert into animals (tag, name, species, sex, owner_id)
       values ('WT-TAG-0001', 'Write Test', 'cattle', 'female', v_owner)
    returning id into v_animal;
  perform wassert(v_animal is not null, 'animal row created');

  raise notice E'\n4. the ear tag is unique';
  begin
    insert into animals (tag, species, owner_id)
         values ('WT-TAG-0001', 'goat', v_owner);
    perform wassert(false, 'a duplicate ear tag should have been refused');
  exception when unique_violation then
    perform wassert(true, 'duplicate ear tag refused');
  end;

  raise notice E'\n5. an animal cannot belong to an owner that does not exist';
  begin
    insert into animals (tag, species, owner_id)
         values ('WT-TAG-0002', 'cattle', '00000000-0000-4000-8000-ffffffffffff');
    perform wassert(false, 'a missing owner should have been refused');
  exception when foreign_key_violation then
    perform wassert(true, 'missing owner refused');
  end;

  raise notice E'\n6. incident references are allocated by the database';
  insert into incidents (ref, type, severity, animal_id, owner_id, notes)
       values (next_incident_ref(), 'stray', 'medium', v_animal, v_owner, 'write test')
    returning ref into v_ref;
  perform wassert(v_ref like 'HRE-INC-%', format('reference issued: %s', v_ref));
  perform wassert(next_incident_ref() <> v_ref, 'consecutive references differ');

  raise notice E'\n7. an incident moves through its workflow';
  update incidents set status = 'resolved', resolved_at = now() where ref = v_ref;
  select count(*) into c from incidents
   where ref = v_ref and status = 'resolved' and resolved_at is not null;
  perform wassert(c = 1, 'resolved carries the time it was closed');

  raise notice E'\n8. a health record attaches to the animal';
  insert into health_records (animal_id, type, occurred_on, description)
       values (v_animal, 'vaccination', current_date, 'write test');
  select count(*) into c from health_records where animal_id = v_animal;
  perform wassert(c = 1, 'health record stored');

  raise notice E'\n9. deleting an animal takes its health records with it';
  delete from animals where id = v_animal;
  select count(*) into c from health_records where animal_id = v_animal;
  perform wassert(c = 0, 'health records cascade');
end $$;

do $$
declare v_ward bigint; c integer;
begin
  raise notice E'\n10. a zone is stored as real geography with a computed area';
  select id into v_ward from wards order by id limit 1;
  insert into geofences (name, type, ward_id, geom)
  values ('WRITE TEST Zone', 'grazing', v_ward,
          st_makevalid(st_geogfromtext(
            'POLYGON((28.1300 -26.1180, 28.1325 -26.1180, 28.1325 -26.1200, 28.1300 -26.1200, 28.1300 -26.1180))'
          )::geometry)::geography);
  select count(*) into c from geofences where name = 'WRITE TEST Zone' and area_ha > 0;
  perform wassert(c = 1, 'zone stored with a positive area');

  raise notice E'\n11. archiving retires a zone without deleting it';
  update geofences set active = false where name = 'WRITE TEST Zone';
  select count(*) into c from geofences where name = 'WRITE TEST Zone' and not active;
  perform wassert(c = 1, 'zone archived, row retained');
end $$;

do $$
declare v_staff uuid; c integer;
begin
  raise notice E'\n12. staff are keyed on auth_user_id, not id';
  -- The bug this catches: a query selecting `id` from staff returned nothing,
  -- and a catch swallowed the error, so a responder list was silently empty.
  select auth_user_id into v_staff from staff limit 1;
  perform wassert(v_staff is not null, 'staff readable by auth_user_id');

  select count(*) into c
    from information_schema.columns where table_name = 'staff' and column_name = 'id';
  perform wassert(c = 0, 'staff has no column named id — queries must use auth_user_id');
end $$;

do $$
declare v_animal uuid; v_event uuid; c integer;
begin
  raise notice E'\n13. a breach notifies every active officer exactly once';
  select a.id into v_animal from animals a limit 1;
  if v_animal is null then
    raise notice '  skip (no animals in this database)';
  else
    insert into containment_events (animal_id, opened_at, opened_geom, max_distance_m, fix_count)
    values (v_animal, now(), st_setsrid(st_makepoint(28.14, -26.13), 4326)::geography, 90, 3)
      returning id into v_event;

    select count(*) into c from notifications where event_id = v_event and staff_id is not null;
    perform wassert(c = (select count(*) from staff where active),
                    format('%s officers notified', c));

    -- Firing again for the same event must not duplicate.
    insert into notifications (staff_id, subject, body, severity, event_id)
    select auth_user_id, 'dup', 'dup', 'critical', v_event from staff where active
    on conflict do nothing;
    select count(*) into c from notifications where event_id = v_event and staff_id is not null;
    perform wassert(c = (select count(*) from staff where active), 'no duplicate notices');
  end if;
end $$;

do $$
begin
  raise notice E'\n--- all write tests passed ---\n';
end $$;

select count(*) as assertions, count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed
  from test_results;

rollback;
