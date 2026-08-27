-- Containment tolerance has to scale with the parcel, and nothing enforced that.
--
-- The default `tolerance_m` of 25 was chosen for a grazing field of tens of
-- hectares, where 25 m of GPS slack either side of a fence is sensible. Applied
-- to a 2,000 m² smallholding — about 45 m across — that same band is wider than
-- half the parcel, so an animal could stand well outside and still be scored as
-- "boundary". The breach would never open.
--
-- This is easy to get wrong quietly: the parcel looks configured, the engine
-- looks like it is running, and no alert ever fires.

/**
 * The largest sensible tolerance for a parcel, from its own size.
 *
 * Treats the parcel as a circle of equivalent area and allows a band of up to a
 * third of that radius, floored at 5 m (below GPS accuracy there is no point)
 * and capped at 50 m (beyond that you are not really containing anything).
 */
create or replace function suggested_tolerance_m(p_area_ha numeric)
returns integer language sql immutable as $$
  select greatest(5, least(50, floor(sqrt((p_area_ha * 10000) / pi()) / 3)))::integer
$$;

/** Parcels whose tolerance is too wide for their size to ever raise a breach. */
create or replace view parcel_tolerance_review as
select
  p.id,
  p.reference,
  p.name,
  p.area_ha,
  round(sqrt((p.area_ha * 10000) / pi())::numeric, 1) as equivalent_radius_m,
  p.tolerance_m,
  suggested_tolerance_m(p.area_ha) as suggested_tolerance_m,
  case
    when p.tolerance_m > suggested_tolerance_m(p.area_ha) * 2 then 'too wide — breaches may never fire'
    when p.tolerance_m > suggested_tolerance_m(p.area_ha)     then 'wider than recommended'
    else 'ok'
  end as verdict
from land_parcels p;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on parcel_tolerance_review to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'herdwise_gw') then
    grant select on parcel_tolerance_review to herdwise_gw;
  end if;
end $$;

/**
 * Warn on write rather than silently accepting a tolerance that cannot work.
 * A warning, not an error: a wide band is occasionally deliberate (a road
 * reserve you only care about grossly), and refusing the insert would be worse
 * than telling the operator.
 */
create or replace function check_parcel_tolerance() returns trigger
language plpgsql as $$
declare
  v_suggested integer := suggested_tolerance_m(
    round((st_area(new.geom) / 10000.0)::numeric, 2));
begin
  if new.tolerance_m > v_suggested * 2 then
    raise warning
      'parcel %: tolerance_m=% is very wide for a %.2f ha parcel (suggested %). Breaches may never open.',
      new.name, new.tolerance_m, st_area(new.geom) / 10000.0, v_suggested;
  end if;
  return new;
end $$;

drop trigger if exists parcel_tolerance_check on land_parcels;
create trigger parcel_tolerance_check
  before insert or update of geom, tolerance_m on land_parcels
  for each row execute function check_parcel_tolerance();
