-- Authentication, in the application rather than in Supabase Auth.
--
-- `staff` was written around `auth.uid()`, expecting Supabase's own auth. That
-- would mean the browser holding a Supabase session and talking to PostgREST,
-- while every page in this app reads through a server-side pool instead. Rather
-- than run two identity systems against one database, sign-in lives in the
-- codebase and `staff.auth_user_id` stays the identity it always was.
--
-- Sign-in is two steps: a password, then a six-digit code. The second step is
-- what makes a leaked password insufficient on its own.

-- ------------------------------------------------------------------ staff

alter table staff add column if not exists email          text;
alter table staff add column if not exists password_hash  text;
alter table staff add column if not exists last_login_at  timestamptz;

-- Bumping this invalidates every session already issued to that person —
-- the revocation path for a stolen cookie, without a sessions table to sweep.
alter table staff add column if not exists token_version  integer not null default 0;

-- Case-insensitive: nobody remembers whether they signed up with a capital.
create unique index if not exists staff_email_key on staff (lower(email))
  where email is not null;

-- ------------------------------------------------------------ login codes

/**
 * One row per code issued.
 *
 * The code is stored hashed, for the same reason a password is: this table is
 * readable by the application role, and a plaintext code sitting in it for ten
 * minutes is a second password in the clear.
 *
 * `attempts` is what stops a six-digit code being guessed. A million
 * combinations is a lot for a person and nothing for a script, so the code is
 * useless after a handful of wrong tries rather than after a million.
 */
create table if not exists login_codes (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(auth_user_id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists login_codes_staff_idx
  on login_codes (staff_id, created_at desc);

-- ---------------------------------------------------------------- grants

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    -- Read identities and hashes to verify a sign-in.
    grant select on staff to herdwise_web;
    -- Only these two columns, so the application cannot change a person's role
    -- or ward even if the connection is compromised.
    grant update (last_login_at, token_version) on staff to herdwise_web;
    grant select, insert, update, delete on login_codes to herdwise_web;
  end if;

  -- The anonymous role must never see a password hash or a live code. It has no
  -- grant on either table; this is here so that stays true if someone later runs
  -- a blanket `grant select on all tables`.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on staff from anon;
    revoke all on login_codes from anon;
  end if;
end $$;

-- ---------------------------------------------------------------- hygiene

/**
 * Codes are short-lived by design, so spent and expired rows are noise. Cleared
 * opportunistically on issue rather than by a scheduled job — there is no
 * scheduler here, and this table only grows when somebody signs in.
 */
create or replace function prune_login_codes() returns void
language sql as $$
  delete from login_codes
   where created_at < now() - interval '1 day'
$$;
