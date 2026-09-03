-- Identity, exercised against a real database.
--
-- This suite exists because of a collision found by hand: the platform's own
-- operator is both a council administrator and a cattle owner, and when his
-- owner record was given his email address he could not sign in as a farmer.
-- The login route checks `staff` first and stops there, so the second identity
-- was unreachable.
--
-- The fix is that a person is not a role. These assertions hold the line.

begin;

create temporary table test_results (n serial, what text, ok boolean) on commit drop;

create or replace function passert(ok boolean, what text) returns void language plpgsql as $$
begin
  insert into test_results (what, ok) values (what, ok);
  if ok then raise notice '  ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

do $$
declare
  v_ward bigint; v_person uuid; v_owner uuid; c integer; r record;
begin
  select id into v_ward from wards order by id limit 1;

  raise notice E'\n1. one address is one person, whichever side registers it first';
  insert into people (full_name, email, password_hash)
       values ('PEOPLE TEST Person', 'people.test@herdwise.test', 'scrypt$1$1$1$x$y')
    returning id into v_person;
  perform passert(v_person is not null, 'person created');

  begin
    insert into people (full_name, email) values ('Impostor', 'PEOPLE.TEST@herdwise.test');
    perform passert(false, 'a second person cannot take the same address');
  exception when unique_violation then
    perform passert(true, 'a second person cannot take the same address');
  end;

  raise notice E'\n2. the same person can hold both hats at once';
  insert into staff (auth_user_id, full_name, role, ward_id, active, email, person_id)
       values (gen_random_uuid(), 'PEOPLE TEST Officer', 'officer', v_ward, true,
               'people.test@herdwise.test', v_person);
  insert into owners (full_name, national_id, phone, ward_id, email, person_id)
       values ('PEOPLE TEST Farmer', 'PT-000-001', '+263 77 000 8001', v_ward,
               'people.test@herdwise.test', v_person)
    returning id into v_owner;

  select count(*) into c from person_memberships where person_id = v_person;
  perform passert(c = 2, 'two memberships for one person');

  select count(*) into c from person_memberships
   where person_id = v_person and kind = 'staff' and role = 'officer';
  perform passert(c = 1, 'the council hat is there');

  select count(*) into c from person_memberships
   where person_id = v_person and kind = 'owner';
  perform passert(c = 1, 'the farm hat is there — the case that used to be unreachable');

  raise notice E'\n3. a membership points back at the row it represents';
  select * into r from person_memberships where person_id = v_person and kind = 'owner';
  perform passert(r.subject_id = v_owner, 'the owner membership carries the owner id');
  perform passert(r.ward_id = v_ward, 'and the ward, for routing');

  raise notice E'\n4. revoking a person ends every hat at once';
  update people set token_version = token_version + 1 where id = v_person;
  select token_version into c from people where id = v_person;
  perform passert(c = 1, 'one bump invalidates sessions for both roles');

  raise notice E'\n5. the existing accounts were carried over';
  select count(*) into c from staff where email is not null and person_id is null;
  perform passert(c = 0, 'every staff row with an address has a person');
  select count(*) into c from owners where email is not null and person_id is null;
  perform passert(c = 0, 'every owner row with an address has a person');

  raise notice E'\n6. a record without an account is still a valid record';
  insert into owners (full_name, national_id, phone, ward_id)
       values ('PEOPLE TEST Unregistered', 'PT-000-002', '+263 77 000 8002', v_ward);
  perform passert(true, 'a farmer the City registered but who never signed in');
  select count(*) into c from person_memberships p
    join owners o on o.id = p.subject_id and p.kind = 'owner'
   where o.national_id = 'PT-000-002';
  perform passert(c = 0, 'and holds no membership, because there is no account');
end $$;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from test_results;

rollback;
