-- Live map support: anonymous read access and Realtime.
--
-- ⚠ PRE-AUTH, TEMPORARY. Authentication is not built yet, so the browser has no
-- signed-in identity and every RLS policy written in 0003 denies it. To get a
-- live map working now, this grants the `anon` role read access to the tables
-- the map draws.
--
-- What that means in plain terms: anyone holding the public anon key can read
-- animal positions, owners' names and parcel boundaries. That is acceptable for
-- a bench pilot with fabricated owner data. It is NOT acceptable once real
-- farmers are in the database.
--
-- To reverse: drop every policy named `anon_read_*` below. Nothing else depends
-- on them — server-side reads and writes use the privileged `herdwise_gw` role
-- and are unaffected.

-- ---------------------------------------------------------------- anon read

create policy anon_read_animals on animals for select to anon using (true);
create policy anon_read_devices on devices for select to anon using (true);
create policy anon_read_parcels on land_parcels for select to anon using (true);
create policy anon_read_geofences on geofences for select to anon using (true);
create policy anon_read_fixes on fixes for select to anon using (true);
create policy anon_read_containment on containment_events for select to anon using (true);
create policy anon_read_containment_status on containment_status for select to anon using (true);
create policy anon_read_owners on owners for select to anon using (true);
create policy anon_read_incidents on incidents for select to anon using (true);

grant usage on schema public to anon;
grant select on animals, devices, land_parcels, geofences, fixes,
                containment_events, containment_status, owners, incidents to anon;

-- ---------------------------------------------------------------- realtime

/**
 * The live map follows `devices`, not `fixes`.
 *
 * `record_fix()` updates `devices.last_position` on every position, so one row
 * per animal changes in place — a handful of updates a minute. Streaming
 * `fixes` instead would push every historical row to every browser and grow
 * without bound, for the same information.
 *
 * `containment_events` is added because a breach is exactly the thing an
 * officer must see without refreshing.
 */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table devices;
    alter publication supabase_realtime add table containment_events;
  end if;
end $$;

-- Realtime sends the old row on UPDATE only when a replica identity is set;
-- without this the payload cannot say which device moved.
alter table devices replica identity full;
alter table containment_events replica identity full;

-- ---------------------------------------------------------------- map views

/**
 * One row per animal with everything the map marker needs, so the browser makes
 * a single request rather than joining four tables client-side.
 */
create or replace view map_animals as
select
  a.id            as animal_id,
  a.tag,
  a.name,
  a.species::text as species,
  a.status::text  as status,
  o.full_name     as owner_name,
  d.imei,
  d.battery_pct,
  d.last_fix_at,
  d.last_fix_type,
  st_y(d.last_position::geometry) as lat,
  st_x(d.last_position::geometry) as lng,
  p.id            as parcel_id,
  p.name          as parcel_name,
  cs.state::text  as containment_state,
  cs.distance_m
from animals a
  left join owners o        on o.id  = a.owner_id
  left join devices d       on d.animal_id = a.id
  left join land_parcels p  on p.id  = a.home_parcel_id
  left join containment_status cs on cs.animal_id = a.id;

/** Parcels as GeoJSON, ready for MapLibre to draw without conversion. */
create or replace view map_parcels as
select
  p.id, p.reference, p.name, p.tenure::text as tenure,
  p.area_ha, p.tolerance_m, p.breach_dwell_s,
  w.name as ward,
  o.full_name as owner_name,
  st_asgeojson(p.geom::geometry)::jsonb as geojson,
  (select count(*) from animals a where a.home_parcel_id = p.id) as animal_count
from land_parcels p
  left join wards w  on w.id = p.ward_id
  left join owners o on o.id = p.owner_id;

grant select on map_animals, map_parcels to anon, herdwise_gw;
