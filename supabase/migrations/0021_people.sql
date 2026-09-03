/**
 * One person, many hats.
 *
 * `staff` and `owners` each carried an email and a password hash, which made
 * them two parallel identity systems that could not describe the same human
 * twice. The platform's own operator is both a council administrator and a
 * cattle owner; when his owner record was given his address, sign-in never
 * reached it, because the login route checks staff first and stops there.
 *
 * That is not a bug in the route. It is the model: an `owners` row is doing two
 * unrelated jobs at once — a municipal record about a citizen (national ID,
 * ward, address) and an account that signs in. A farmer the City registered but
 * who has never logged in is the same row as a user of the platform.
 *
 * So identity moves to `people`, and `staff` and `owners` become what they
 * always were: records about a person, in a role, held by an organisation. A
 * veterinarian working across several farms is then one person with several
 * memberships rather than several accounts.
 *
 * Additive on purpose. The old columns stay until the application has moved
 * over, so this migration cannot break a running deployment.
 */

create table if not exists people (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null,
  password_hash text,
  active        boolean not null default true,

  -- Bumping this invalidates every session already issued to them, which is
  -- the only revocation a stateless cookie allows.
  token_version int not null default 0,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Addresses are compared case-insensitively everywhere else, so uniqueness has
-- to be too — otherwise Owner@… and owner@… are two people.
create unique index if not exists people_email_key on people (lower(email));

alter table staff  add column if not exists person_id uuid references people(id) on delete cascade;
alter table owners add column if not exists person_id uuid references people(id) on delete cascade;
create index if not exists staff_person_idx  on staff  (person_id);
create index if not exists owners_person_idx on owners (person_id);

-- ------------------------------------------------------------- backfill

-- Staff first: where an address appears on both sides it is one person, and
-- the council row is the one that has been signing in.
insert into people (full_name, email, password_hash, active, token_version, last_login_at)
select s.full_name, lower(s.email), s.password_hash, s.active, s.token_version, s.last_login_at
  from staff s
 where s.email is not null and length(trim(s.email)) > 0
on conflict (lower(email)) do nothing;

insert into people (full_name, email, password_hash, active, token_version, last_login_at)
select o.full_name, lower(o.email), o.password_hash, true, o.token_version, o.last_login_at
  from owners o
 where o.email is not null and length(trim(o.email)) > 0
on conflict (lower(email)) do nothing;

update staff s  set person_id = p.id from people p
 where s.person_id is null and s.email is not null and lower(s.email) = lower(p.email);
update owners o set person_id = p.id from people p
 where o.person_id is null and o.email is not null and lower(o.email) = lower(p.email);

-- ---------------------------------------------------------- memberships

/**
 * Every hat a person wears, in one place.
 *
 * Sign-in resolves a person; this says what they may then act as. A person with
 * one row lands there directly; a person with several chooses, which is the
 * case this whole migration exists to allow.
 */
create or replace view person_memberships as
  select p.id as person_id, 'staff'::text as kind,
         s.auth_user_id as subject_id, s.role::text as role,
         s.full_name as label, s.ward_id, null::uuid as farm_id, s.active
    from people p join staff s on s.person_id = p.id
  union all
  select p.id, 'owner', o.id, 'owner',
         o.full_name, o.ward_id, null::uuid, true
    from people p join owners o on o.person_id = p.id;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on people, person_memberships to herdwise_web;
    grant insert on people to herdwise_web;
    grant update (full_name, email, password_hash, active, token_version, last_login_at)
      on people to herdwise_web;
  else
    raise notice 'role "herdwise_web" not present — nothing to grant';
  end if;
end $grants$;
