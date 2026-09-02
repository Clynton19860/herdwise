-- Claiming a tag.
--
-- An unknown IMEI is already provisioned automatically: the first time a tag
-- dials in, `record_fix` creates a device row for it and flags the arrival. What
-- was missing is the other half — connecting that device to an animal. Nothing
-- in the interface could do it, so a fleet of tags would arrive, report
-- faithfully, and sit unassigned with no way to claim them short of SQL.
--
-- One column, because that is the whole of the operation. A device belongs to at
-- most one animal (enforced by the unique constraint already on animal_id), and
-- an officer moving a tag from one animal to another is a reassignment rather
-- than a new record.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant update (animal_id) on devices to herdwise_web;
  end if;
end $$;

/**
 * Tags that have reported but belong to no animal.
 *
 * Ordered by when they were last heard from, because the one an officer is
 * holding is the one that just reported.
 */
create or replace view unclaimed_devices as
select d.id, d.imei, d.type::text as type, d.battery_pct, d.last_seen_at,
       d.last_fix_at, d.first_seen_ip,
       (select count(*) from device_anomalies an where an.imei = d.imei) as anomalies
  from devices d
 where d.animal_id is null
 order by d.last_seen_at desc nulls last;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on unclaimed_devices to herdwise_web;
  end if;
end $$;
