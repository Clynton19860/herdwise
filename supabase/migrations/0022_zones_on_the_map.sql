/**
 * Zones belong on the map.
 *
 * Polygons live in two tables. `land_parcels` is an allocation — the piece of
 * ground an animal is permitted on, which the containment engine measures
 * against. `geofences` is a management zone an officer draws: grazing, buffer,
 * restricted, watering, quarantine.
 *
 * `map_parcels` only ever read the first, so every map in the application drew
 * allocations and silently ignored zones. Somebody could draw a grazing zone,
 * save it, open it, and see an empty satellite photograph — the shape was in the
 * database and on no screen. That is what "I still cannot see my geofence lines"
 * turned out to be.
 *
 * The view now carries both, with `kind` saying which so the map can style an
 * allocation and a zone differently rather than pretending they are the same
 * thing. Every existing column keeps its name and meaning, so nothing that
 * already reads this view has to change.
 */
create or replace view map_parcels as
  select p.id,
         p.reference,
         p.name,
         p.tenure::text as tenure,
         p.area_ha,
         p.tolerance_m,
         p.breach_dwell_s,
         w.name as ward,
         o.full_name as owner_name,
         st_asgeojson(p.geom::geometry)::jsonb as geojson,
         (select count(*) from animals a where a.home_parcel_id = p.id) as animal_count,
         'allocation'::text as kind,
         null::text as zone_type
    from land_parcels p
    left join wards w on w.id = p.ward_id
    left join owners o on o.id = p.owner_id

  union all

  select g.id,
         -- Zones carry no cadastral reference; the name is the identifier.
         null::text as reference,
         g.name,
         null::text as tenure,
         g.area_ha,
         -- Tolerance and dwell belong to an allocation, which is the thing
         -- containment is judged against. A zone is descriptive.
         null::integer as tolerance_m,
         null::integer as breach_dwell_s,
         w.name as ward,
         null::text as owner_name,
         st_asgeojson(g.geom::geometry)::jsonb as geojson,
         -- Occupancy is counted by position rather than by allocation, because
         -- an animal is in a grazing zone when it is standing in it.
         (select count(distinct a.id)
            from animals a
            join devices d on d.animal_id = a.id
            join fixes f on f.device_id = d.id
           where f.recorded_at > now() - interval '24 hours'
             and st_within(f.geom::geometry, g.geom::geometry)) as animal_count,
         'zone'::text as kind,
         g.type::text as zone_type
    from geofences g
    left join wards w on w.id = g.ward_id
   where g.active;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on map_parcels to herdwise_web;
  else
    raise notice 'role "herdwise_web" not present — nothing to grant';
  end if;
end $grants$;
