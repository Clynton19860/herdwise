-- What a council sees of a farm, held by assertions.
--
-- This is the most consequential boundary in the product and the first thing a
-- customer's lawyer will ask to see. A council sees everything about the
-- animals — identity, position, movement, health, tags, allocations, cases —
-- because ownership verification, disease control and grazing enforcement all
-- require it. It does not see how the farm is run.
--
-- Everything runs inside a transaction that is rolled back.

begin;

create temporary table test_results (n serial, what text, ok boolean) on commit drop;

create or replace function dassert(ok boolean, what text) returns void language plpgsql as $$
begin
  insert into test_results (what, ok) values (what, ok);
  if ok then raise notice '  ok   %', what;
  else raise exception 'FAILED: %', what;
  end if;
end $$;

do $$
declare
  v_harare uuid; v_bulawayo uuid; v_farm_h uuid; v_farm_b uuid;
  v_owner uuid; v_animal uuid; c integer;
begin
  insert into tenants (name, kind) values ('DISCLOSURE Harare', 'municipal') returning id into v_harare;
  insert into tenants (name, kind) values ('DISCLOSURE Bulawayo', 'municipal') returning id into v_bulawayo;
  insert into tenants (name, kind, jurisdiction_id)
       values ('DISCLOSURE Farm in Harare', 'farm', v_harare) returning id into v_farm_h;
  insert into tenants (name, kind, jurisdiction_id)
       values ('DISCLOSURE Farm in Bulawayo', 'farm', v_bulawayo) returning id into v_farm_b;

  raise notice E'\n1. a council reaches the farms it regulates';
  select count(*) into c from visible_tenants(v_harare) where tenant_id = v_farm_h;
  perform dassert(c = 1, 'Harare sees a farm in its own district');
  select count(*) into c from visible_tenants(v_harare) where tenant_id = v_harare;
  perform dassert(c = 1, 'and its own records');

  raise notice E'\n2. and no further';
  select count(*) into c from visible_tenants(v_harare) where tenant_id = v_farm_b;
  perform dassert(c = 0, 'Harare cannot see a farm in Bulawayo');
  select count(*) into c from visible_tenants(v_harare) where tenant_id = v_bulawayo;
  perform dassert(c = 0, 'nor another council');
  select count(*) into c from visible_tenants(v_harare);
  perform dassert(c = 2, 'exactly itself and its own farm — nothing else');

  raise notice E'\n3. a farm sees only itself';
  select count(*) into c from visible_tenants(v_farm_h);
  perform dassert(c = 1, 'a farm reaches nothing but its own records');
  select count(*) into c from visible_tenants(v_farm_h) where tenant_id = v_harare;
  perform dassert(c = 0, 'not its own council');
  select count(*) into c from visible_tenants(v_farm_h) where tenant_id = v_farm_b;
  perform dassert(c = 0, 'and never a sibling farm');

  raise notice E'\n4. the disclosure is recorded, not implied';
  select count(*) into c from disclosure_policy where entity = 'animals' and disclosed;
  perform dassert(c = 1, 'animals are disclosed');
  select count(*) into c from disclosure_policy where entity = 'fixes' and disclosed;
  perform dassert(c = 1, 'so is where they have been');
  select count(*) into c from disclosure_policy where entity = 'health_records' and disclosed;
  perform dassert(c = 1, 'and their health');

  raise notice E'\n5. and how the farm is run is not';
  select count(*) into c from disclosure_policy where entity = 'tenant_members' and not disclosed;
  perform dassert(c = 1, 'who the farm employs stays the farm''s business');
  select count(*) into c from disclosure_policy where entity = 'tenants' and not disclosed;
  perform dassert(c = 1, 'and so does its commercial standing');

  raise notice E'\n6. every entry carries a reason';
  select count(*) into c from disclosure_policy where coalesce(trim(rationale), '') = '';
  perform dassert(c = 0, 'a boundary without a reason cannot be defended');
end $$;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from test_results;

rollback;
