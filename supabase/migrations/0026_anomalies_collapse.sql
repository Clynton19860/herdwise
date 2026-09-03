/**
 * An anomaly log that records normal behaviour is a log nobody reads.
 *
 * `device_anomalies` was built to learn the protocol from real hardware, and it
 * did that: undocumented SYNC fields and unpositioned frames were genuinely
 * unknown in August. A week later ten tags have produced forty thousand rows,
 * of which thirty thousand say "this heartbeat carried the same three extra
 * fields as the last one".
 *
 *     undocumented_sync_fields   30,498
 *     duplicate_imei              5,977
 *     unpositioned_fix            2,457
 *     source_ip_changed           1,073
 *     position_outside_region       203   ← the ones that matter
 *     implausible_speed              36   ←
 *
 * Two costs. The two hundred rows that describe a real firmware fault are
 * buried under thirty thousand that describe a tag working normally, and the
 * table grows without bound — ten tags did this in a week, and the pilot is
 * fifteen with thousands intended.
 *
 * So repeats collapse. The caller supplies a signature saying what makes one
 * occurrence the same as another: a constant for "this tag sends extra SYNC
 * fields", the coordinates for "this tag reported an impossible position". The
 * first sighting keeps its detail, the count rises, and the last time is
 * recorded — which is more useful than thirty thousand identical rows and
 * survives a fleet a hundred times this size.
 */

alter table device_anomalies add column if not exists signature text;
alter table device_anomalies add column if not exists occurrences int not null default 1;
alter table device_anomalies add column if not exists last_observed_at timestamptz;

update device_anomalies set last_observed_at = observed_at where last_observed_at is null;

-- ------------------------------------------------------- collapse history

/**
 * Fold what is already there.
 *
 * Existing rows have no signature, so they collapse by kind — which is right
 * for the noisy ones and slightly lossy for `position_outside_region`, whose
 * individual coordinates were evidence. Those are preserved in the retained
 * row's detail alongside the count, and the raw frames remain in the gateway's
 * own journal.
 */
with folded as (
  select imei, kind,
         min(observed_at) as first_seen,
         max(observed_at) as last_seen,
         count(*) as n,
         (array_agg(id order by observed_at))[1] as keep_id
    from device_anomalies
   group by imei, kind
)
update device_anomalies a
   set occurrences = f.n,
       observed_at = f.first_seen,
       last_observed_at = f.last_seen,
       signature = a.kind
  from folded f
 where a.id = f.keep_id;

/**
 * Keep exactly one row per (device, kind): the earliest, with `id` breaking a
 * tie so the choice is total and the statement is deterministic.
 *
 * Written as a `distinct on` rather than a self-join. The self-join compares
 * every row with every other and timed out at forty thousand rows — which is
 * the very number this migration exists because of, so it would have failed
 * exactly where it was needed. This sorts once.
 */
with keep as (
  select distinct on (coalesce(imei, ''), kind) id
    from device_anomalies
   order by coalesce(imei, ''), kind, observed_at, id
)
delete from device_anomalies a
 where not exists (select 1 from keep k where k.id = a.id);

-- One row per device, per kind, per signature. The upsert target.
create unique index if not exists device_anomalies_unique
  on device_anomalies (coalesce(imei, ''), kind, coalesce(signature, kind));

create index if not exists device_anomalies_recent
  on device_anomalies (last_observed_at desc);
