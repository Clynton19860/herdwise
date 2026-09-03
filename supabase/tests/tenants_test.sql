-- Tenancy, exercised against a real database.
--
-- The structure carries two claims that a customer will eventually ask us to
-- prove: that a farm owns its own records rather than belonging to its council,
-- and that nobody inside a tenant can grant themselves more than the tenant
-- holds. Neither is enforced yet — `tenant_id` is nullable and there is no
-- row-level security — so these assertions cover the shape, and the enforcement
-- suite comes with it.
--
-- Everything runs inside a transaction that is rolled back.

begin;

create temporary table test_results (n serial, what text, ok boolean) on commit drop;

create or replace function tassert(ok boolean, what text) returns void language plpgsql as $$
begin
  insert into test_results (what, ok) values (what, ok);
  if ok then raise notice '  ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

do $$
declare
  v_council uuid; v_farm uuid; v_other uuid; v_person uuid; c integer;
begin
  raise notice E'\n1. the platform is singular';
  select count(*) into c from tenants where kind = 'platform';
  perform tassert(c = 1, 'exactly one platform tenant exists');
  begin
    insert into tenants (name, kind) values ('Impostor Platform', 'platform');
    perform tassert(false, 'a second platform cannot be created');
  exception when unique_violation then
    perform tassert(true, 'a second platform cannot be created');
  end;

  raise notice E'\n2. only a farm answers to a council';
  insert into tenants (name, kind) values ('TENANT TEST Council', 'municipal')
    returning id into v_council;
  insert into tenants (name, kind, jurisdiction_id) values ('TENANT TEST Farm', 'farm', v_council)
    returning id into v_farm;
  perform tassert(true, 'a farm may fall under a council');

  begin
    insert into tenants (name, kind, jurisdiction_id)
         values ('TENANT TEST Subordinate Council', 'municipal', v_council);
    perform tassert(false, 'a council cannot fall under another council');
  exception when check_violation then
    perform tassert(true, 'a council cannot fall under another council');
  end;

  raise notice E'\n3. jurisdiction is not ownership';
  perform tassert(
    (select kind from tenants where id = v_farm) = 'farm',
    'the farm is its own tenant, not a child of the council');
  begin
    delete from tenants where id = v_council;
    perform tassert(false, 'deleting a council cannot silently take its farms with it');
  -- RESTRICT raises 23001, not the 23503 a plain foreign key would.
  exception when restrict_violation or foreign_key_violation then
    perform tassert(true, 'deleting a council cannot silently take its farms with it');
  end;

  raise notice E'\n4. the plan is the ceiling, and it is ours to set';
  perform tassert(
    (select plan from tenants where id = v_farm) = 'full',
    'a tenant is full by default');
  update tenants set plan = 'demo' where id = v_farm;
  perform tassert(
    (select plan from tenants where id = v_farm) = 'demo',
    'and can be put on a demo plan');
  begin
    update tenants set plan = 'unlimited' where id = v_farm;
    perform tassert(false, 'there is no plan outside the three we defined');
  exception when invalid_text_representation then
    perform tassert(true, 'there is no plan outside the three we defined');
  end;

  raise notice E'\n5. one person, membership in several tenants';
  insert into people (full_name, email) values ('TENANT TEST Vet', 'tenant.vet@herdwise.test')
    returning id into v_person;
  insert into tenants (name, kind, jurisdiction_id) values ('TENANT TEST Farm Two', 'farm', v_council)
    returning id into v_other;

  insert into tenant_members (tenant_id, person_id, role) values
    (v_farm,  v_person, 'vet'),
    (v_other, v_person, 'vet'),
    (v_council, v_person, 'vet');
  select count(*) into c from tenant_members where person_id = v_person;
  perform tassert(c = 3, 'a vet works across two farms and a council on one identity');

  begin
    insert into tenant_members (tenant_id, person_id, role) values (v_farm, v_person, 'owner');
    perform tassert(false, 'a person holds one role per tenant, not two');
  exception when unique_violation then
    perform tassert(true, 'a person holds one role per tenant, not two');
  end;

  raise notice E'\n6. removing a tenant removes its memberships, not its people';
  delete from tenants where id = v_other;
  select count(*) into c from tenant_members where person_id = v_person;
  perform tassert(c = 2, 'the membership went with the farm');
  select count(*) into c from people where id = v_person;
  perform tassert(c = 1, 'the person did not');

  raise notice E'\n7. every existing record was given a tenant';
  select count(*) into c from animals where tenant_id is null;
  perform tassert(c = 0, 'no animal was left without one');
  select count(*) into c from devices where tenant_id is null;
  perform tassert(c = 0, 'no tag was left without one');
  select count(*) into c from land_parcels where tenant_id is null;
  perform tassert(c = 0, 'no allocation was left without one');
end $$;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from test_results;

rollback;
