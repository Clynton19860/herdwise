-- Farm owners can sign in.
--
-- `owners` was written as a record an officer keeps about somebody, not as an
-- account that person holds: a name, a national ID, a phone number, and a
-- nullable `auth_user_id` for a login that was never built.
--
-- A farmer needs to see his own herd, and only his own. He is not staff — giving
-- him a staff row would let him read every other farmer's national ID, phone
-- number and animal positions, which is a data-protection failure rather than an
-- untidy one.
--
-- So owners get their own credentials here, and their own surface in the
-- application. Not a filtered version of the officer interface: a separate set
-- of pages whose queries are written scoped from the start. A filter that must
-- be remembered on twenty queries will be forgotten on one of them, and the
-- failure is silent and someone else's private data.

alter table owners add column if not exists email          text;
alter table owners add column if not exists password_hash  text;
alter table owners add column if not exists token_version  integer not null default 0;
alter table owners add column if not exists last_login_at  timestamptz;

-- Case-insensitive, and only where an address exists: most owners are registered
-- by an officer and never hold an account at all.
create unique index if not exists owners_email_key on owners (lower(email))
  where email is not null;

-- An email address identifies exactly one principal. Without this, a farmer and
-- a member of staff could share an address and sign-in would have to guess which
-- one was meant.
create or replace function email_is_free(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from staff  where lower(email) = lower(p_email))
     and not exists (select 1 from owners where lower(email) = lower(p_email))
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    -- The same narrow set staff were given: enough to sign in and set a
    -- password, and nothing that changes who somebody is. `ward_id` and
    -- `national_id` stay out of reach of the browser-facing role.
    grant update (email, password_hash, token_version, last_login_at) on owners to herdwise_web;
    grant execute on function email_is_free(text) to herdwise_web;
  end if;
end $$;
