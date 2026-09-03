/**
 * A record created after the migration still needs a tenant.
 *
 * 0023 backfilled every row that existed when it ran, which is all a migration
 * can do. Nothing gave a tenant to anything created afterwards — so an animal
 * registered this afternoon belongs to nobody, and once isolation is enforced
 * she becomes invisible to the farm that owns her.
 *
 * Found by running the CI pipeline in order rather than against a database that
 * happened to be seeded first: migrations run, then the seed adds twelve
 * animals, and every one of them had a null tenant.
 *
 * The application will set this explicitly once it is tenant-aware. This is the
 * safety net beneath that, and it is worth having permanently: a tenant derived
 * from the owner is always right, and a route that forgets to set one should
 * produce a correct row rather than an orphan nobody notices for a month.
 */

create or replace function inherit_tenant() returns trigger language plpgsql as $$
begin
  if new.tenant_id is not null then return new; end if;

  -- A farmer the council has registered belongs to that council until a farm
  -- claims them. This is the root of the chain: everything below derives from
  -- an owner, so an owner without a tenant orphans their whole herd.
  if tg_table_name = 'owners' then
    select t.id into new.tenant_id
      from tenants t where t.kind = 'municipal' and t.ward_id = new.ward_id limit 1;
    if new.tenant_id is null then
      select id into new.tenant_id from tenants where kind = 'municipal' limit 1;
    end if;

  -- An animal belongs to the tenant its owner belongs to.
  elsif tg_table_name = 'animals' then
    select o.tenant_id into new.tenant_id from owners o where o.id = new.owner_id;

  -- A tag belongs with the animal it is on. An unassigned tag legitimately has
  -- no tenant: it is stock, not somebody's record, and inventing an owner for
  -- it would hide that.
  elsif tg_table_name = 'devices' then
    select a.tenant_id into new.tenant_id from animals a where a.id = new.animal_id;

  -- Allocations and zones follow their owner where there is one, and their
  -- ward's council otherwise — a communal grazing area belongs to the council.
  elsif tg_table_name in ('land_parcels', 'geofences') then
    if to_jsonb(new) ? 'owner_id' and (to_jsonb(new)->>'owner_id') is not null then
      select o.tenant_id into new.tenant_id
        from owners o where o.id = (to_jsonb(new)->>'owner_id')::uuid;
    end if;
    if new.tenant_id is null then
      select t.id into new.tenant_id
        from tenants t where t.kind = 'municipal' and t.ward_id = new.ward_id limit 1;
    end if;
    if new.tenant_id is null then
      select id into new.tenant_id from tenants where kind = 'municipal' limit 1;
    end if;

  elsif tg_table_name = 'health_records' then
    select a.tenant_id into new.tenant_id from animals a where a.id = new.animal_id;
  end if;

  return new;
end $$;

do $t$
declare tbl text;
begin
  foreach tbl in array array['owners', 'animals', 'devices', 'land_parcels', 'geofences', 'health_records'] loop
    execute format('drop trigger if exists %I on %I', tbl || '_inherit_tenant', tbl);
    -- Not scoped to particular columns: the tables do not share a column set,
    -- and the trigger returns immediately when a tenant is already present, so
    -- firing on every write costs a comparison.
    execute format(
      'create trigger %I before insert or update on %I
         for each row execute function inherit_tenant()',
      tbl || '_inherit_tenant', tbl);
  end loop;
end $t$;

-- Catch anything already orphaned, including rows a seed added after 0023 ran.
-- Owners first: the rest of the chain derives from them.
update owners o
   set tenant_id = coalesce(
         (select t.id from tenants t where t.kind = 'municipal' and t.ward_id = o.ward_id limit 1),
         (select id from tenants where kind = 'municipal' limit 1))
 where o.tenant_id is null;

update animals a set tenant_id = o.tenant_id
  from owners o where o.id = a.owner_id and a.tenant_id is null;
update devices d set tenant_id = a.tenant_id
  from animals a where a.id = d.animal_id and d.tenant_id is null;
update health_records h set tenant_id = a.tenant_id
  from animals a where a.id = h.animal_id and h.tenant_id is null;
-- An allocation with an owner follows the owner; a communal one follows the
-- council for its ward, which is what "communal" means.
update land_parcels p
   set tenant_id = coalesce(
         (select o.tenant_id from owners o where o.id = p.owner_id),
         (select t.id from tenants t where t.kind = 'municipal' and t.ward_id = p.ward_id limit 1),
         (select id from tenants where kind = 'municipal' limit 1))
 where p.tenant_id is null;
update geofences g
   set tenant_id = coalesce(
         (select t.id from tenants t where t.kind = 'municipal' and t.ward_id = g.ward_id limit 1),
         (select id from tenants where kind = 'municipal' limit 1))
 where g.tenant_id is null;
