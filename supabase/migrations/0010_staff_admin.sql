-- Two flows need to write to `staff`: choosing a password after a reset or an
-- invitation, and an administrator adding a colleague.
--
-- Migration 0007 granted update on `last_login_at` and `token_version` only,
-- deliberately, so a compromised application connection could not change
-- anybody's role or ward. That reasoning still holds — this widens the grant by
-- exactly two more columns and nothing else. `role`, `ward_id` and `active`
-- remain out of reach of the browser-facing role.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    -- Setting a password after a verified code, and correcting an address.
    grant update (last_login_at, token_version, password_hash, email) on staff to herdwise_web;
    -- Adding a colleague. There is no delete: removing somebody is
    -- `active = false`, which preserves who did what in the incident history.
    grant insert on staff to herdwise_web;
  end if;
end $$;

/**
 * A password change ends every session that person already had.
 *
 * Someone resetting a password has usually lost control of it, so leaving old
 * sessions alive would defeat the reset. Bumping `token_version` invalidates
 * every cookie already issued to them, because the session check compares it.
 */
create or replace function bump_token_version(p_staff uuid) returns void
language sql security definer set search_path = public as $$
  update staff set token_version = token_version + 1 where auth_user_id = p_staff
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant execute on function bump_token_version(uuid) to herdwise_web;
  end if;
end $$;
