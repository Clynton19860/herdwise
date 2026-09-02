-- Farms become the tenant.
--
-- Until now everything hung off a ward: a farmer was registered into one an
-- officer had already created, and his animals and allocations sat in a single
-- flat namespace with everybody else's. That is a municipal register, and it is
-- the right shape for the city's copy of the truth. It is the wrong shape for a
-- farmer, who arrives owning nothing and needs to describe his own place before
-- any of it means anything.
--
-- So: a farm is the unit of tenancy. A person creates one, becomes its owner,
-- appoints whoever else works there, draws its areas and registers its animals.
-- Nothing is made for him in advance.
--
-- The ward does not disappear — it becomes an optional municipal grouping on the
-- farm, so the City of Harare keeps oversight across farms while no farm can see
-- another. Two levels rather than one, which is what the enforcement story rests
-- on.

create table if not exists farms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Optional on purpose. A farm exists whether or not a municipality has placed
  -- it, and requiring a ward would mean inventing one for every new farmer —
  -- which is exactly the imposition this migration removes.
  ward_id     bigint references wards(id) on delete set null,
  district    text,
  created_by  uuid references owners(id) on delete set null,
  created_at  timestamptz not null default now()
);

/**
 * Who works on a farm, and what they may do there.
 *
 * Membership rather than a column on the person: somebody can manage two farms,
 * and a vet may attend several. `owner` is the person who created it and may
 * appoint others; the rest are appointed by them.
 */
create type farm_role as enum ('owner', 'manager', 'herdsman', 'vet');

create table if not exists farm_members (
  farm_id    uuid not null references farms(id) on delete cascade,
  person_id  uuid not null references owners(id) on delete cascade,
  role       farm_role not null default 'herdsman',
  added_at   timestamptz not null default now(),
  primary key (farm_id, person_id)
);

create index if not exists farm_members_person_idx on farm_members (person_id);

-- Tenancy on everything a farm owns. Nullable so the municipal register can
-- still hold a record nobody has claimed into a farm yet.
alter table animals       add column if not exists farm_id uuid references farms(id) on delete set null;
alter table land_parcels  add column if not exists farm_id uuid references farms(id) on delete set null;
alter table geofences     add column if not exists farm_id uuid references farms(id) on delete set null;

create index if not exists animals_farm_idx      on animals (farm_id);
create index if not exists land_parcels_farm_idx on land_parcels (farm_id);
create index if not exists geofences_farm_idx    on geofences (farm_id);

/**
 * The farms a person may act on.
 *
 * SECURITY DEFINER so a scoped query can consult membership without the caller
 * needing to read the whole table — the same reasoning as the policy helpers in
 * 0003.
 */
create or replace function farms_for_person(p_person uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select farm_id from farm_members where person_id = p_person
$$;

-- ---------------------------------------------------------------- backfill
--
-- The existing owner, animal and allocation predate all of this. Rather than
-- leave them stranded outside the model, give them a farm — named for the owner,
-- since nobody has told us what the place is called.

do $$
declare v_person uuid; v_farm uuid; v_name text;
begin
  select id, full_name into v_person, v_name from owners order by created_at limit 1;
  if v_person is null then return; end if;

  if exists (select 1 from farm_members where person_id = v_person) then return; end if;

  insert into farms (name, ward_id, created_by)
  select v_name || '''s farm', o.ward_id, v_person from owners o where o.id = v_person
  returning id into v_farm;

  insert into farm_members (farm_id, person_id, role) values (v_farm, v_person, 'owner');

  update animals      set farm_id = v_farm where owner_id = v_person and farm_id is null;
  update land_parcels set farm_id = v_farm where owner_id = v_person and farm_id is null;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select, insert on farms to herdwise_web;
    grant update (name, district, ward_id) on farms to herdwise_web;
    grant select, insert, delete on farm_members to herdwise_web;
    grant update (role) on farm_members to herdwise_web;
    grant update (farm_id) on animals to herdwise_web;
    grant update (farm_id) on land_parcels to herdwise_web;
    grant update (farm_id) on geofences to herdwise_web;
    grant execute on function farms_for_person(uuid) to herdwise_web;
  end if;
end $$;
