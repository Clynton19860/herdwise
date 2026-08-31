-- Close the anonymous read access that stood in for authentication.
--
-- Migration 0005 granted `anon` read on animals, devices, positions, owners,
-- incidents and the map views, marked ⚠ PRE-AUTH TEMPORARY. It was the only way
-- to render a live map before there was any notion of a signed-in person.
--
-- There is one now: sign-in is in the application, sessions are signed cookies,
-- and every page and API route verifies one. Nothing needs the anonymous role
-- any more, and while it exists the entire register — owners' names, national
-- IDs, and the exact position of every animal — is readable by anyone holding
-- the public key that ships in the browser bundle.
--
-- The live map loses its Realtime push with this, because that ran on the anon
-- key. It polls the application's own authenticated endpoint instead.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise notice 'role "anon" not present — nothing to revoke';
    return;
  end if;

  drop policy if exists anon_read_animals on animals;
  drop policy if exists anon_read_devices on devices;
  drop policy if exists anon_read_parcels on land_parcels;
  drop policy if exists anon_read_geofences on geofences;
  drop policy if exists anon_read_fixes on fixes;
  drop policy if exists anon_read_containment on containment_events;
  drop policy if exists anon_read_containment_status on containment_status;
  drop policy if exists anon_read_owners on owners;
  drop policy if exists anon_read_incidents on incidents;

  revoke select on animals, devices, land_parcels, geofences, fixes,
                   containment_events, containment_status, owners, incidents from anon;
  revoke select on map_animals, map_parcels from anon;
  revoke select on parcel_tolerance_review from anon;
end $$;
