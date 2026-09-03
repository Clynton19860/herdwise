/**
 * What a council sees of a farm, written down once.
 *
 * A farm owns its records and answers to a council for a defined slice of them.
 * That slice is the most consequential boundary in the product — too tight and
 * the City cannot enforce, too loose and no commercial farm will buy privacy
 * that is not private — and it is the first thing a customer's lawyer will ask
 * to see.
 *
 * So it lives here rather than as conditions scattered through queries. One
 * definition, testable, and something to point at.
 *
 * **The council sees everything about the animals.** Identity, position,
 * movement, health, the tags on them, the ground they are allocated, and the
 * cases raised about them. That is what regulating livestock means: ownership
 * verification, disease control, grazing enforcement and licensing all need it.
 *
 * **The council does not see how the farm is run.** Who the farmer employs and
 * what access they hold is the farm's own business, and a register that
 * disclosed it would be collecting employment data it has no mandate for.
 */

/**
 * Every tenant whose records a given tenant may read.
 *
 * Two ways in, and no more: your own tenant, and — if you are a council — the
 * farms that fall under you. One hop, never a chain, which is why the answer
 * is a set rather than a recursive walk.
 */
create or replace function visible_tenants(p_tenant uuid)
returns table (tenant_id uuid) language sql stable as $$
  select p_tenant
  union
  select f.id
    from tenants f
    join tenants c on c.id = f.jurisdiction_id
   where c.id = p_tenant and c.kind = 'municipal'
$$;

comment on function visible_tenants(uuid) is
  'The tenants whose records this tenant may read: itself, plus any farm under '
  'its jurisdiction when it is a council. Jurisdiction is a mandate, not '
  'ownership — it reaches one hop and never chains.';

/**
 * The disclosure itself, as a table anyone can read.
 *
 * Written as data rather than as commentary so it can be shown to a customer,
 * checked against the code, and diffed when it changes. A boundary that exists
 * only in prose is a boundary nobody can audit.
 */
create table if not exists disclosure_policy (
  entity      text primary key,
  disclosed   boolean not null,
  rationale   text not null
);

insert into disclosure_policy (entity, disclosed, rationale) values
  ('animals',        true,  'Ownership verification and disease control require the register itself.'),
  ('fixes',          true,  'Position and movement history are what grazing enforcement is judged on.'),
  ('devices',        true,  'A tag on an animal is part of that animal''s identity to the council.'),
  ('health_records', true,  'Disease control is a municipal veterinary function.'),
  ('land_parcels',   true,  'An allocation is granted by the council and enforced against.'),
  ('geofences',      true,  'Management zones bear on where livestock may lawfully be.'),
  ('incidents',      true,  'An enforcement case is the council''s own record.'),
  ('owners',         true,  'A council cannot verify ownership without knowing the owner.'),
  ('tenant_members', false, 'Who a farm employs, and what access they hold, is the farm''s own business. A livestock register has no mandate to collect employment data.'),
  ('tenants',        false, 'A farm''s plan and commercial standing with us is not a municipal matter.')
on conflict (entity) do update
   set disclosed = excluded.disclosed, rationale = excluded.rationale;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on disclosure_policy to herdwise_web;
    grant execute on function visible_tenants(uuid) to herdwise_web;
  else
    raise notice 'role "herdwise_web" not present — nothing to grant';
  end if;
end $grants$;
