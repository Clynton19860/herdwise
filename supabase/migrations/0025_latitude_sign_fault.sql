/**
 * A named, per-device repair for one firmware fault.
 *
 * Unit …08682 reports latitude without the southern-hemisphere sign. It is not
 * a corrupt reading: the longitude is correct and unambiguously Zimbabwe, the
 * magnitude matches every other tag in the same yard to five decimal places,
 * and the coordinates change as the animal moves. It is a correct fix with one
 * character missing.
 *
 * Refusing those positions is the right default and stays the default. But
 * refusing them costs a real animal its tracking for as long as the supplier
 * takes to answer, and this is a pilot whose whole purpose is to find out
 * whether the idea works.
 *
 * So the repair is opt-in per device and never inferred. A tag is marked as
 * having this fault by a person who has looked at the evidence; nothing is
 * corrected for any other device, and a healthy tag cannot be affected by it.
 * Every repaired fix records that it was repaired, so no report can present a
 * corrected position as one the tag actually sent.
 */

alter table devices add column if not exists latitude_sign_fault boolean not null default false;

comment on column devices.latitude_sign_fault is
  'This unit omits the southern-hemisphere sign. Set only from observed evidence: '
  'a correct longitude, a latitude magnitude matching co-located tags, and coordinates '
  'that track movement. The gateway mirrors latitude for these devices and records it.';

alter table fixes add column if not exists repaired text;

comment on column fixes.repaired is
  'Null for a position the device reported correctly. Names the repair applied '
  'otherwise, so a corrected position can never be read as an observed one.';

-- `fixes` is partitioned by month. Adding the column to the parent propagates
-- to every partition automatically; adding it to a partition directly is an
-- error, which is what the first draft of this migration tried to do.
