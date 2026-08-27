# Deploying the dashboard to Vercel

Import `ogjr80/herdwise` in Vercel and set three environment variables. No other
configuration is needed — the framework preset, build command and output are all
detected.

## Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `DATABASE_URL` | Server | Supabase **transaction pooler**, port **6543** |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Public by design |

The values are supplied separately — they are not in this repository.

### Why port 6543 and not 5432

Supabase offers two pooler modes on the same host:

- **5432, session mode** — holds a connection per client. Correct for the
  always-on telemetry gateway.
- **6543, transaction mode** — returns the connection after each statement.
  Correct for serverless.

Vercel functions start and stop constantly. Pointed at 5432 the app will work in
testing and then fail under real traffic with `too many connections`, which is a
poor thing to discover during a demo.

### Which credential

The dashboard uses a `herdwise_web` role that can read everything and insert the
field allocations drawn on the map. It **cannot write telemetry** — that is the
gateway's separate credential, which is never shared. Revoking the web role does
not interrupt tracking.

## What this deployment shows

Live data from the pilot database: registered animals with their last known
positions, land parcels drawn as real boundaries, containment state per animal,
and incidents. Positions update in the browser through Supabase Realtime.

Telemetry itself arrives via a TCP gateway that is **not** part of this
deployment — ear tags speak a raw socket protocol that serverless cannot accept.
See `gateway/README.md`.

## Known gaps

- **No authentication.** Every visitor sees everything. Migration `0005` grants
  the anonymous role read access so the live map works without a login; it is
  marked temporary and should be reversed when auth lands.
- **Seeded parcels are not real allocations.** They are the prototype's
  decorative shapes projected onto Harare, which makes them 1,500–4,700 ha. Real
  boundaries have to come from the City's cadastral data or be drawn on the map.
