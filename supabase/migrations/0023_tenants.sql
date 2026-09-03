/**
 * Who owns the data, and who may see it.
 *
 * Everything on this platform currently sits in one pool. That was correct for
 * a single-council pilot and is wrong for what this is becoming: municipalities
 * that administer their own jurisdiction, and farms that own their own records
 * and pay their own way.
 *
 * Two relationships, and they do different jobs:
 *
 *   parent          none. Every tenant sits directly under the platform.
 *   jurisdiction    a farm answers to a council for a defined slice of its
 *                   data. It does not belong to that council.
 *
 * The distinction matters commercially and legally. A farm that is merely
 * regulated can be sold to directly, can take its records elsewhere, and can be
 * told exactly what its council can see. A farm owned by its council can do
 * none of those things.
 *
 * Deliberately additive: `tenant_id` is nullable here and nothing is enforced
 * yet. A migration that cannot break a running deployment can be applied while
 * somebody is demonstrating the platform, which is the situation this was
 * written in.
 */

do $t$ begin
  create type tenant_kind as enum ('platform', 'municipal', 'farm');
exception when duplicate_object then null; end $t$;

-- The ceiling on what anyone inside a tenant may do. Set by us, not by them —
-- an invited farm evaluating the platform must not be able to grant itself
-- write access, and a tenant administrator is still inside the tenant.
do $t$ begin
  create type tenant_plan as enum ('full', 'demo', 'suspended');
exception when duplicate_object then null; end $t$;

create table if not exists tenants (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  kind      tenant_kind not null,
  plan      tenant_plan not null default 'full',

  -- Regulatory, not commercial. Null for a municipality, which answers to
  -- nobody here, and for the platform itself.
  jurisdiction_id uuid references tenants(id) on delete restrict,

  ward_id   bigint references wards(id),
  created_at timestamptz not null default now(),

  -- A council cannot fall under another council's jurisdiction, and the
  -- platform falls under nothing. Only a farm is regulated.
  constraint tenants_only_farms_are_regulated
    check (jurisdiction_id is null or kind = 'farm')
);

create index if not exists tenants_jurisdiction_idx on tenants (jurisdiction_id);
create unique index if not exists tenants_one_platform
  on tenants ((kind)) where kind = 'platform';

/**
 * Which tenants a person may act in, and as what.
 *
 * Separate from `farm_members`, which describes working on a farm rather than
 * holding an account in a tenant. A veterinarian may hold membership in several
 * farms and in a council at once — one person, several hats, which is what
 * `people` was created to allow.
 */
do $t$ begin
  create type tenant_role as enum
    ('owner', 'admin', 'manager', 'officer', 'vet', 'herdsman', 'viewer');
exception when duplicate_object then null; end $t$;

create table if not exists tenant_members (
  tenant_id uuid not null references tenants(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  role      tenant_role not null,
  added_at  timestamptz not null default now(),
  primary key (tenant_id, person_id)
);

create index if not exists tenant_members_person_idx on tenant_members (person_id);

-- ------------------------------------------------------------ seed

-- The platform itself, then the council this pilot runs for, then the one farm
-- that exists. Named from what is already in the database rather than invented.
insert into tenants (name, kind, plan)
select 'Herdwise', 'platform', 'full'
 where not exists (select 1 from tenants where kind = 'platform');

insert into tenants (name, kind, plan, ward_id)
select 'City of Harare', 'municipal', 'full', (select id from wards order by id limit 1)
 where not exists (select 1 from tenants where kind = 'municipal' and name = 'City of Harare');

insert into tenants (name, kind, plan, jurisdiction_id, ward_id)
select f.name, 'farm', 'full',
       (select id from tenants where kind = 'municipal' and name = 'City of Harare'),
       f.ward_id
  from farms f
 where not exists (select 1 from tenants t where t.kind = 'farm' and t.name = f.name);

-- --------------------------------------------------------- tenant_id

do $add$
declare t text;
begin
  foreach t in array array[
    'animals', 'owners', 'devices', 'land_parcels', 'geofences',
    'incidents', 'health_records', 'farms'
  ] loop
    execute format(
      'alter table %I add column if not exists tenant_id uuid references tenants(id)', t);
    execute format(
      'create index if not exists %I on %I (tenant_id)', t || '_tenant_idx', t);
  end loop;
end $add$;

-- ------------------------------------------------------------ backfill

-- Everything that exists today belongs to the one farm, which answers to
-- Harare. Staff are municipal and are handled through membership rather than a
-- tenant column, because a `staff` row is a post held inside a council.
do $fill$
declare v_farm uuid; v_council uuid;
begin
  select id into v_farm    from tenants where kind = 'farm' limit 1;
  select id into v_council from tenants where kind = 'municipal' limit 1;
  if v_council is null then return; end if;

  -- A farm owns its own records. Livestock the council has registered against
  -- no farm at all — which is most of a municipal register — stays with the
  -- council until a farm claims it, rather than being left with no owner.
  v_farm := coalesce(v_farm, v_council);

  update farms          set tenant_id = v_farm where tenant_id is null;
  update owners         set tenant_id = v_farm where tenant_id is null;
  update animals        set tenant_id = v_farm where tenant_id is null;
  update devices        set tenant_id = v_farm where tenant_id is null;
  update land_parcels   set tenant_id = v_farm where tenant_id is null;
  update geofences      set tenant_id = v_farm where tenant_id is null;
  update health_records set tenant_id = v_farm where tenant_id is null;

  -- An enforcement case is raised by the council and is the council's record,
  -- even though it concerns a farm's animal.
  update incidents      set tenant_id = v_council where tenant_id is null;

  -- Everyone who can already sign in gets the membership their existing row
  -- implies, so nobody loses access when this is enforced.
  insert into tenant_members (tenant_id, person_id, role)
  select v_council, s.person_id,
         (case s.role::text
            when 'admin' then 'admin' when 'vet' then 'vet' else 'officer' end)::tenant_role
    from staff s where s.person_id is not null and s.active
  on conflict (tenant_id, person_id) do nothing;

  insert into tenant_members (tenant_id, person_id, role)
  select v_farm, o.person_id, 'owner'::tenant_role
    from owners o where o.person_id is not null
  on conflict (tenant_id, person_id) do nothing;
end $fill$;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on tenants, tenant_members to herdwise_web;
  else
    raise notice 'role "herdwise_web" not present — nothing to grant';
  end if;
end $grants$;
