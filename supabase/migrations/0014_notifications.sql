-- Telling somebody.
--
-- A breach has always been recorded and shown in the platform, and that is where
-- it stopped. An officer who is not looking at a screen learns nothing, which is
-- most of the value of tracking an animal that has left its allocation.
--
-- This is the record of what should be sent and what became of it, kept separate
-- from the sending. Delivery needs a carrier account this pilot does not have
-- yet; the queue does not, and building it now means the day an account exists,
-- nothing upstream changes.

create type notification_channel as enum ('in_app', 'sms', 'whatsapp', 'email');
create type notification_state   as enum ('pending', 'sent', 'failed', 'suppressed');

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  -- Who it is for. Staff and owners are different tables, so exactly one is set.
  staff_id     uuid references staff(auth_user_id) on delete cascade,
  owner_id     uuid references owners(id) on delete cascade,
  channel      notification_channel not null default 'in_app',
  subject      text not null,
  body         text not null,
  /** Where it points. Relative, so it survives a domain change. */
  href         text,
  severity     text not null default 'info',
  state        notification_state not null default 'pending',
  -- What caused it, so a breach cannot raise two notices for the same event.
  event_id     uuid references containment_events(id) on delete set null,
  incident_id  uuid references incidents(id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  read_at      timestamptz,
  error        text,
  constraint notifications_one_recipient
    check ((staff_id is not null) <> (owner_id is not null))
);

create index notifications_staff_idx on notifications (staff_id, created_at desc)
  where staff_id is not null;
create index notifications_pending_idx on notifications (state, created_at)
  where state = 'pending';

/**
 * One notice per event per recipient.
 *
 * Containment re-evaluates on every fix, and a breach that stays open would
 * otherwise raise a notice every thirty seconds. The partial unique index is
 * what makes the trigger below safe to fire repeatedly.
 */
create unique index notifications_event_once
  on notifications (event_id, coalesce(staff_id, owner_id))
  where event_id is not null;

/**
 * Raise notices when a breach opens.
 *
 * Every active officer, and the animal's owner. Written as a trigger rather than
 * in the application so that a breach detected by the gateway — which never
 * touches the web app — still reaches somebody.
 */
create or replace function notify_on_breach() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tag    text;
  v_parcel text;
  v_owner  uuid;
begin
  select a.tag, a.owner_id into v_tag, v_owner from animals a where a.id = new.animal_id;
  select p.name into v_parcel from land_parcels p where p.id = new.parcel_id;

  insert into notifications (staff_id, subject, body, href, severity, event_id)
  select s.auth_user_id,
         format('%s has left %s', v_tag, coalesce(v_parcel, 'its allocation')),
         format('Detected at %s. The animal is being tracked; open the map to see where it is now.',
                to_char(new.opened_at at time zone 'Africa/Harare', 'HH24:MI')),
         '/tracking',
         'critical',
         new.id
    from staff s where s.active
  on conflict do nothing;

  if v_owner is not null then
    insert into notifications (owner_id, channel, subject, body, href, severity, event_id)
    values (v_owner, 'sms',
            format('%s has left %s', v_tag, coalesce(v_parcel, 'its allocation')),
            'Your animal has left its registered area. The ward office has been notified.',
            null, 'critical', new.id)
    on conflict do nothing;
  end if;

  return new;
end $$;

drop trigger if exists breach_notifies on containment_events;
create trigger breach_notifies
  after insert on containment_events
  for each row execute function notify_on_breach();

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'herdwise_web') then
    grant select on notifications to herdwise_web;
    -- Marking one read, and recording a delivery attempt.
    grant update (read_at, state, sent_at, error) on notifications to herdwise_web;
    grant insert on notifications to herdwise_web;
  end if;
end $$;
