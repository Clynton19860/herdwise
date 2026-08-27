# Herdwise database

Postgres + PostGIS. Runs on Supabase in production; these migrations apply
unchanged to a plain Postgres for local work, because `0003_rls.sql` creates a
stand-in `auth.uid()` only when Supabase's own is absent.

## Local setup

```bash
brew install postgresql@18 postgis && brew services start postgresql@18
createdb herdwise_dev
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d herdwise_dev -f "$f"; done
psql -d herdwise_dev -f supabase/seed.sql          # optional demo data
psql -d herdwise_dev -f supabase/tests/containment_test.sql
```

Then point the gateway at it:

```bash
cd gateway
DATABASE_URL=postgres://localhost/herdwise_dev node src/server.js
node src/simulator.js --count 3 --interval 4 --stray --lat -17.76322 --lng 31.03692
```

## Files

| File | Contents |
|---|---|
| `migrations/0001_core.sql` | Wards, owners, land parcels, geofences, animals, devices, partitioned `fixes` |
| `migrations/0002_containment.sql` | `record_fix()` ingest + `evaluate_containment()` state machine |
| `migrations/0003_rls.sql` | Roles and row-level security |
| `tests/containment_test.sql` | 10 groups, ~30 assertions, replayed tracks |
| `seed.sql` | The prototype dataset projected onto real Harare coordinates |

## The containment engine

`record_fix()` is the gateway's only entry point. In one transaction it writes
the fix, updates device health, runs plausibility checks, and advances the
containment state machine — so a breach can never be observed without the fix
that caused it.

Four safeguards stop it flapping, all configurable **per parcel** because the
City will change its mind about what counts as a breach:

| Column | Default | Purpose |
|---|---|---|
| `tolerance_m` | 25 | Band around the boundary treated as "boundary", not "out" |
| `breach_fixes` | 2 | Consecutive outside fixes before a breach can open |
| `breach_dwell_s` | 180 | Seconds outside before a breach can open — **both** must be met |
| `clear_fixes` | 2 | Consecutive inside fixes before it resolves |

Only **GPS** fixes advance the state machine. WiFi and cell-tower fixes are
stored and update "last seen", but never open or close an event — a cell fix can
be kilometres out, and acting on those is how you generate false breaches and
lose the officers' trust.

## Known gaps

- **The seeded parcels are not real allocations.** They are the prototype's
  decorative canvas polygons projected across the whole Harare bounding box,
  which makes them 1,500–4,700 ha. Real parcels must come from the City's own
  data — still an open question in what format.
- **`incidents`** is not modelled yet; containment events are the input to it.
- **Retention.** Monthly partitions exist and `ensure_fixes_partition()` is
  callable, but nothing schedules it and there is no rollup or cold-storage
  ladder yet. Both are needed before the fix table gets large.
