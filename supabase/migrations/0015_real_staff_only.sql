-- Remove the placeholder staff, and let an ear tag be corrected.
--
-- `staff` was seeded with four names — a vet, two officers and a system
-- administrator — none of which is a person. No email, no password, never signed
-- in. They survived earlier clean-ups because they are rows in the database, and
-- "it is in the database" was doing too much work as a definition of real.
--
-- They were not harmless. Settings listed four colleagues who do not exist, the
-- incident form offered them as people to assign work to, and the breach trigger
-- raises a notice for every active officer — so a real breach would have written
-- four notices addressed to nobody. The write-path test asserted that behaviour
-- and passed, because it counted officers rather than people.
--
-- Deleted rather than deactivated: nothing references them. No incident names
-- one, no notification is addressed to one.

delete from staff where email is null and password_hash is null and last_login_at is null;

/**
 * The ear tag is a label, not a key.
 *
 * It was left out of the editable columns on the grounds that changing it would
 * reassign an animal's history. That was wrong. Positions, breaches and health
 * records all reference `animals.id`; the tag is the number printed on the
 * plastic, and when a tag is replaced in the field the record has to follow.
 * Refusing the edit does not protect the history — it just forces somebody to
 * do it in SQL.
 *
 * Uniqueness is still enforced by the index, so two animals cannot share one.
 */
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant update (tag) on animals to herdwise_web;
  end if;
end $$;
