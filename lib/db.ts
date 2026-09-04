import "server-only";
import { Pool } from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-ca";
import { toCanvas, polygonToCanvas, polygonToThumbnail } from "./geo";
import type {
  Animal, AnimalStatus, DeviceType, Geofence, GeoZoneType,
  Incident, IncidentSeverity, IncidentStatus, IncidentType, Owner, Sex, Species,
} from "./types";

/**
 * Data access for the dashboard.
 *
 * Returns exactly the shapes `lib/data.ts` used to export, so pages changed from
 * importing an array to awaiting a function and nothing else. Positions come out
 * of Postgres as real lat/lng and are projected into the stylized canvas here —
 * the map components stay unchanged, and the projection lives in one place.
 *
 * Connects with `pg` rather than supabase-js because Supabase *is* Postgres:
 * the same code runs against a local database today and a Supabase connection
 * string in production.
 */

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("DATABASE_URL is not set — the dashboard needs a database to read from.");
    this.name = "DatabaseNotConfigured";
  }
}

// Next dev re-imports modules on every change; without this the pool leaks
// connections until Postgres refuses new ones.
const globalForPg = globalThis as unknown as { herdwisePool?: Pool };

/**
 * TLS for anything that leaves this machine, and nothing for a local socket.
 *
 * Supabase's pooler presents a certificate from its own private CA, which is in
 * no system trust store. Pin it rather than disabling verification — this
 * connection carries every animal position over the public internet. The CA is
 * embedded (see lib/supabase-ca.ts) because serverless bundles do not reliably
 * ship files read at runtime.
 *
 * A local Postgres has no TLS at all and refuses the handshake, which made it
 * impossible to run the application against the development database. Only an
 * explicit localhost host turns it off, so no deployment can reach this branch
 * by accident.
 */
function tlsFor(url: string) {
  let host = "";
  try { host = new URL(url).hostname; } catch { /* fall through to TLS on */ }
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return isLocal ? false : { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true };
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new DatabaseNotConfigured();
  globalForPg.herdwisePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: tlsFor(process.env.DATABASE_URL),
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  return globalForPg.herdwisePool;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Postgres will not compare a `uuid` column to a text parameter — it raises
 * "operator does not exist: text = uuid". Casting the column (`id::text = $1`)
 * works but discards the primary-key index. Instead, pass the value as a uuid
 * when it is one and null when it is not, so lookups that accept either an id
 * or a human reference stay indexed.
 */
function asUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

/**
 * Show enough of an IMEI to identify a tag in hand, and no more.
 *
 * The tag protocol treats the IMEI as the device's entire identity, and the
 * gateway listens on a public address — so a published IMEI is a route to
 * injecting fabricated positions for that animal. Until authentication exists,
 * every screen is readable by anyone holding the anon key, so the full number
 * does not leave the database.
 */
function maskImei(imei: string | null): string {
  if (!imei) return "unpaired";
  return imei.length <= 4 ? imei : `\u2022\u2022\u2022\u2022 ${imei.slice(-4)}`;
}

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool().query(sql, params);
  return rows as T[];
}

/* ------------------------------------------------------ withheld tags */

/**
 * Tags a named account must never see, whatever else it is allowed to do.
 *
 * The pilot rig is a real tag on a real animal in a real paddock, and the
 * paddock is the owner's home. Its track is his movements, not the product's.
 *
 * Keyed on who is asking rather than on their plan or role, because those are
 * exactly the things that change: an evaluation account gets unlocked for a
 * demonstration and locked again afterwards, and a rule written against the
 * plan would quietly hand over the pilot the moment somebody widened it. This
 * one holds through any promotion.
 *
 * Both halves are configuration. Which tag is "the pilot" and who is being
 * kept away from it are facts about this arrangement, not about livestock, and
 * they change in the Vercel settings without a migration or a deploy.
 */
const WITHHELD_IMEIS = (process.env.WITHHELD_IMEIS ?? "861251110109128")
  .split(",").map((s) => s.trim()).filter(Boolean);

const WITHHELD_FROM = (process.env.WITHHELD_FROM_EMAILS ?? "nellidee7@gmail.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/**
 * The IMEIs to hide from whoever is asking — empty for everybody not named.
 *
 * Resolved here rather than passed in by the page. `getAnimals` alone has
 * eleven call sites, and a filter each of them must remember to apply is a
 * filter that leaks the first time somebody adds a twelfth. This way a page
 * cannot forget, because a page is never asked.
 *
 * Fails closed. An unreadable session, a query that throws, a shape nobody
 * expected — all of them hide the tag rather than show it. That cost a
 * debugging session once, when `staff` turned out to have no `id` column and
 * the pilot silently vanished for every council user too; fail-closed still
 * beats the alternative, which is finding out the other way.
 */
async function withheld(): Promise<string[]> {
  if (WITHHELD_IMEIS.length === 0 || WITHHELD_FROM.length === 0) return [];
  try {
    const { cookies } = await import("next/headers");
    const { SESSION_COOKIE, readSession } = await import("./auth");
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!raw) return [];
    const session = readSession(raw);
    if (!session) return [];

    // `staff` is keyed by auth_user_id and has no `id` column at all; `owners`
    // is keyed by `id`. The session says which post is being held.
    const [table, key] = session.k === "o" ? ["owners", "id"] : ["staff", "auth_user_id"];
    const rows = await query<{ email: string | null }>(
      `select email from ${table} where ${key} = $1::uuid`, [asUuid(session.sub)]);

    const email = rows[0]?.email?.toLowerCase();
    if (!email) return WITHHELD_IMEIS;
    return WITHHELD_FROM.includes(email) ? WITHHELD_IMEIS : [];
  } catch {
    return WITHHELD_IMEIS;
  }
}

/**
 * The withheld list as a SQL literal.
 *
 * `ANIMAL_SQL_BASE` is shared by five queries that each number their own $1
 * and $2, so a new placeholder would renumber all of them. Inlining is safe
 * only because every entry is checked against `^\\d{1,20}$` first — an IMEI is
 * digits, and anything else never reaches the string.
 */
async function withheldLiteral(): Promise<string> {
  const list = (await withheld()).filter((i) => /^\d{1,20}$/.test(i));
  return list.length ? `array[${list.map((i) => `'${i}'`).join(",")}]::text[]` : "array[]::text[]";
}

/* ---------------------------------------------------------------- mapping */

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sentence = (s: string) => title(s.replace(/_/g, " "));

const DEVICE_LABEL: Record<string, DeviceType> = {
  hcs048: "Ear Tag",
  smart_collar: "Smart Collar",
  airtag: "AirTag",
  other: "Ear Tag",
};

/** Null for an unrecorded birth date, so the UI can say "unknown" rather than "0 mo". */
function monthsSince(date: string | Date | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

const minutesSince = (t: Date | null) =>
  t ? Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000)) : 0;

const iso = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

/* ---------------------------------------------------------------- owners */

type OwnerRow = {
  id: string; full_name: string; national_id: string; phone: string;
  ward: string | null; herd_size: string; created_at: Date;
  address: string | null;
  email: string | null;
};

const OWNER_SQL = `
  select o.id, o.full_name, o.national_id, o.phone, o.address, o.email,
         w.name as ward,
         (select count(*) from animals a where a.owner_id = o.id) as herd_size,
         o.created_at
    from owners o
    left join wards w on w.id = o.ward_id`;

const toOwner = (r: OwnerRow): Owner => ({
  id: r.id,
  fullName: r.full_name,
  nationalId: r.national_id,
  phone: r.phone,
  address: r.address ?? null,
  email: r.email ?? null,
  ward: r.ward ?? "—",
  herdSize: Number(r.herd_size),
  registeredOn: iso(r.created_at),
});

/**
 * Paged, with a ceiling.
 *
 * These were unbounded: every list page fetched the whole register and rendered
 * all of it. Invisible with one animal and fatal with a ward's worth — the
 * query, the payload and the DOM all grow together.
 *
 * `PAGE_SIZE` is also a ceiling rather than only a page length. A caller that
 * forgets to page still cannot pull ten thousand rows into memory.
 */
export const PAGE_SIZE = 50;

export async function getOwners(page = 0, size = PAGE_SIZE): Promise<Owner[]> {
  return (await query<OwnerRow>(
    `${OWNER_SQL} order by o.full_name limit $1 offset $2`,
    [Math.min(size, PAGE_SIZE), page * size])).map(toOwner);
}

export async function getOwner(id: string): Promise<Owner | null> {
  const rows = await query<OwnerRow>(`${OWNER_SQL} where o.id = $1::uuid`, [asUuid(id)]);
  return rows[0] ? toOwner(rows[0]) : null;
}

/* ---------------------------------------------------------------- animals */

type AnimalRow = {
  id: string; tag: string; name: string | null; species: string; breed: string | null;
  sex: string | null; birth_date: string | null; weight_kg: string | null;
  colour: string | null; status: string; owner_id: string; registered_on: string;
  device_type: string | null; imei: string | null;
  battery_pct: number | null; signal_pct: number | null; last_fix_at: Date | null;
  lat: number | null; lng: number | null;
  zone_name: string | null; containment_state: string | null; distance_m: number | null;
  speed_kph: number | null; heading_deg: number | null;
  last_vaccination: string | null; next_vaccination: string | null;
};

const ANIMAL_SQL_BASE = `
  select a.id, a.tag, a.name, a.species, a.breed, a.sex, a.birth_date,
         a.weight_kg, a.colour, a.status, a.owner_id, a.registered_on,
         d.type as device_type, d.imei, d.battery_pct, d.signal_pct, d.last_fix_at,
         st_y(d.last_position::geometry) as lat,
         st_x(d.last_position::geometry) as lng,
         coalesce(p.name, z.name) as zone_name,
         cs.state as containment_state, cs.distance_m,
         f.speed_kph, f.heading_deg,
         hs.last_vaccination, hs.next_vaccination
    from animals a
    left join devices d on d.animal_id = a.id
    left join land_parcels p on p.id = a.home_parcel_id
    left join lateral (
      select g.name from geofences g
       where d.last_position is not null and st_intersects(g.geom, d.last_position)
       order by g.area_ha asc limit 1) z on true
    left join containment_status cs on cs.animal_id = a.id
    left join animal_health_summary hs on hs.animal_id = a.id
    left join lateral (
      select speed_kph, heading_deg from fixes
       where animal_id = a.id order by recorded_at desc limit 1) f on true`;

/**
 * The animal query, with the pilot's tag detached for an evaluator.
 *
 * Filtered on the join rather than the row: the animal is real and stays in
 * the register, she simply appears untagged. Removing her outright would be a
 * lie of a different kind — and the live map already drops her, because
 * without a device she has no position to draw.
 */
async function animalSql(): Promise<string> {
  return ANIMAL_SQL_BASE.replace(
    "left join devices d on d.animal_id = a.id",
    `left join devices d on d.animal_id = a.id and d.imei <> all(${await withheldLiteral()})`);
}

function toAnimal(r: AnimalRow): Animal {
  // Fall back to the centre of the canvas only when a device has never
  // reported; drawing an animal at 0,0 would put it in the corner of the map.
  const pos = r.lat != null && r.lng != null ? toCanvas(r.lat, r.lng) : { x: 50, y: 50 };
  return {
    id: r.id,
    tag: r.tag,
    name: r.name ?? undefined,
    species: title(r.species) as Species,
    breed: r.breed ?? "—",
    sex: (r.sex ? title(r.sex) : "Female") as Sex,
    ageMonths: monthsSince(r.birth_date),
    weightKg: r.weight_kg != null ? Number(r.weight_kg) : null,
    color: r.colour ?? "—",
    status: title(r.status) as AnimalStatus,
    ownerId: r.owner_id,
    device: {
      type: DEVICE_LABEL[r.device_type ?? "other"] ?? "Ear Tag",
      serial: maskImei(r.imei),
      battery: r.battery_pct ?? 0,
      signal: r.signal_pct ?? 0,
      lastSyncMin: minutesSince(r.last_fix_at),
    },
    location: {
      x: Number(pos.x.toFixed(2)),
      y: Number(pos.y.toFixed(2)),
      zone: r.zone_name ?? "Unassigned",
      speedKph: r.speed_kph ?? 0,
      heading: r.heading_deg ?? 0,
    },
    health: {
      lastVaccination: iso(r.last_vaccination),
      nextVaccination: iso(r.next_vaccination),
      // The HCS048 has GPS and an accelerometer — no heart-rate or temperature
      // sensor. These stay null until Phase 2 smart collars, and the UI shows a
      // dash rather than inventing a number.
      heartRateBpm: null,
      temperatureC: null,
    },
    registeredOn: iso(r.registered_on),
  };
}

export async function getAnimals(page = 0, size = PAGE_SIZE): Promise<Animal[]> {
  return (await query<AnimalRow>(
    `${await animalSql()} order by a.tag limit $1 offset $2`,
    [Math.min(size, PAGE_SIZE), page * size])).map(toAnimal);
}

export async function getAnimal(id: string): Promise<Animal | null> {
  // Accepts either the database id or the printed ear-tag number.
  const rows = await query<AnimalRow>(
    `${await animalSql()} where a.id = $1::uuid or a.tag = $2`, [asUuid(id), id]);
  return rows[0] ? toAnimal(rows[0]) : null;
}

export async function getAnimalsByOwner(ownerId: string): Promise<Animal[]> {
  return (await query<AnimalRow>(
    `${await animalSql()} where a.owner_id = $1::uuid order by a.tag`, [asUuid(ownerId)])).map(toAnimal);
}

/* ---------------------------------------------------------------- zones */

type ZoneRow = {
  id: string; name: string; type: string; ward: string | null;
  area_ha: string; capacity: number | null; ring: string; occupancy: string;
};

const ZONE_SQL = `
  select g.id, g.name, g.type, w.name as ward, g.area_ha, g.capacity,
         st_asgeojson(g.geom::geometry) as ring,
         (select count(*) from devices d
            where d.last_position is not null
              and st_intersects(g.geom, d.last_position)) as occupancy
    from geofences g
    left join wards w on w.id = g.ward_id`;

function toGeofence(r: ZoneRow): Geofence {
  const gj = JSON.parse(r.ring) as { coordinates: [number, number][][] };
  // GeoJSON is [lng, lat]; the canvas projection takes (lat, lng).
  const ring = (gj.coordinates[0] ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
  return {
    id: r.id,
    name: r.name,
    type: title(r.type) as GeoZoneType,
    ward: r.ward ?? "—",
    polygon: polygonToCanvas(ring),
    // Normalised to its own extent, so the preview shows the shape rather than
    // its position in a city-sized box it may not even be inside.
    thumbnail: polygonToThumbnail(ring),
    // A homestead paddock is a fifth of a hectare, and rounding to whole
    // numbers labelled every small zone "0 hectares" — which reads as an error
    // in the drawing rather than as a small field.
    hectares: Number(r.area_ha) >= 10
      ? Math.round(Number(r.area_ha))
      : Math.round(Number(r.area_ha) * 100) / 100,
    capacity: r.capacity ?? 0,
    occupancy: Number(r.occupancy),
  };
}

export async function getGeofences(): Promise<Geofence[]> {
  return (await query<ZoneRow>(`${ZONE_SQL} where g.active order by g.name`)).map(toGeofence);
}

export async function getGeofence(id: string): Promise<Geofence | null> {
  const rows = await query<ZoneRow>(
    `${ZONE_SQL} where g.id = $1::uuid or g.name = $2`, [asUuid(id), id]);
  return rows[0] ? toGeofence(rows[0]) : null;
}

/* ---------------------------------------------------------------- incidents */

type IncidentRow = {
  id: string; ref: string; type: string; severity: string; status: string;
  animal_id: string | null; owner_id: string | null; reported_at: Date;
  lat: number | null; lng: number | null; location_label: string | null;
  officer: string | null; notes: string | null;
};

const INCIDENT_SQL = `
  select i.id, i.ref, i.type, i.severity, i.status, i.animal_id, i.owner_id,
         i.reported_at, i.location_label, i.officer, i.notes,
         st_y(i.geom::geometry) as lat, st_x(i.geom::geometry) as lng
    from incidents i`;

function toIncident(r: IncidentRow): Incident {
  const pos = r.lat != null && r.lng != null ? toCanvas(r.lat, r.lng) : { x: 50, y: 50 };
  return {
    id: r.id,
    ref: r.ref,
    type: sentence(r.type) as IncidentType,
    severity: title(r.severity) as IncidentSeverity,
    status: sentence(r.status) as IncidentStatus,
    animalId: r.animal_id ?? undefined,
    ownerId: r.owner_id ?? undefined,
    reportedAt: new Date(r.reported_at).toISOString(),
    location: {
      x: Number(pos.x.toFixed(2)),
      y: Number(pos.y.toFixed(2)),
      label: r.location_label ?? "Unknown",
    },
    officer: r.officer ?? "Unassigned",
    notes: r.notes ?? "",
  };
}

export async function getIncidents(page = 0, size = PAGE_SIZE): Promise<Incident[]> {
  return (await query<IncidentRow>(
    `${INCIDENT_SQL} order by i.reported_at desc limit $1 offset $2`,
    [Math.min(size, PAGE_SIZE), page * size])).map(toIncident);
}

export async function getIncident(idOrRef: string): Promise<Incident | null> {
  const rows = await query<IncidentRow>(`${INCIDENT_SQL} where i.id::text = $1 or i.ref = $1`, [idOrRef]);
  return rows[0] ? toIncident(rows[0]) : null;
}

/* ---------------------------------------------------------------- aggregates */

export type PlatformStats = {
  registered: number; liveDevices: number; geofencesActive: number;
  incidentsToday: number; resolvedThisWeek: number; averageResponseMin: number;
  uptime: number; staff: number; offlineDevices: number; lowBattery: number;
  openBreaches: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const [r] = await query<Record<string, string>>(`
    select
      (select count(*) from animals) as registered,
      (select count(*) from devices where last_seen_at > now() - interval '1 hour') as live_devices,
      (select count(*) from devices where last_seen_at is null or last_seen_at <= now() - interval '1 hour') as offline_devices,
      (select count(*) from devices where battery_pct is not null and battery_pct < 30) as low_battery,
      (select count(*) from geofences where active) as geofences_active,
      (select count(*) from incidents where reported_at >= current_date) as incidents_today,
      (select count(*) from incidents where status = 'resolved' and coalesce(resolved_at, reported_at) > now() - interval '7 days') as resolved_week,
      (select count(*) from containment_events where status = 'open') as open_breaches,
      (select count(*) from staff where active) as staff`);

  return {
    registered: Number(r.registered),
    liveDevices: Number(r.live_devices),
    offlineDevices: Number(r.offline_devices),
    lowBattery: Number(r.low_battery),
    geofencesActive: Number(r.geofences_active),
    incidentsToday: Number(r.incidents_today),
    resolvedThisWeek: Number(r.resolved_week),
    openBreaches: Number(r.open_breaches),
    // Not yet measured. Surfacing a real zero beats inventing a plausible
    // number — see the assessment's note on hardcoded dashboard figures.
    averageResponseMin: 0,
    uptime: 0,
    staff: Number(r.staff),
  };
}

/** Species and status composition, derived — never hardcoded percentages. */
export async function getComposition() {
  const species = await query<{ species: string; n: string }>(
    `select species, count(*) as n from animals group by species order by n desc`);
  const status = await query<{ status: string; n: string }>(
    `select status, count(*) as n from animals group by status order by n desc`);
  const total = species.reduce((s, r) => s + Number(r.n), 0) || 1;
  return {
    species: species.map((r) => ({
      name: title(r.species), count: Number(r.n),
      pct: Math.round((Number(r.n) / total) * 100),
    })),
    status: status.map((r) => ({ name: title(r.status), count: Number(r.n) })),
  };
}

/**
 * Seven-day counts, zero-filled so charts always get seven points.
 *
 * Each count used to be a correlated subquery — `where recorded_at::date = d`,
 * once per day. Casting the column to a date defeats the index on it, so every
 * one of those was a full scan of `fixes`, and there were seven of them in a
 * query that also scanned `incidents` and `animals` seven times each. On a
 * table that grows by a position every few seconds per tag, that is the shape
 * of a page that gets slower every week it runs.
 *
 * Each table is now scanned once, bounded by a range the index can serve, and
 * grouped. The days are joined onto the result so a day with nothing still
 * produces a zero — a chart with a missing point lies about the gap.
 */
export async function getTrendSeries() {
  const rows = await query<{ d: string; fixes: string; incidents: string; registrations: string }>(`
    with days as (
      select generate_series(current_date - interval '6 days', current_date, interval '1 day')::date as d
    ),
    -- Comparing the column itself leaves the index usable; casting it to a
    -- date, as this query used to, did not.
    f as (
      select recorded_at::date as d, count(*) as n
        from fixes
       where recorded_at >= current_date - interval '6 days'
       group by 1
    ),
    i as (
      select reported_at::date as d, count(*) as n
        from incidents
       where reported_at >= current_date - interval '6 days'
       group by 1
    ),
    r as (
      select registered_on as d, count(*) as n
        from animals
       where registered_on >= current_date - interval '6 days'
       group by 1
    )
    select days.d::text as d,
           coalesce(f.n, 0) as fixes,
           coalesce(i.n, 0) as incidents,
           coalesce(r.n, 0) as registrations
      from days
      left join f on f.d = days.d
      left join i on i.d = days.d
      left join r on r.d = days.d
     order by days.d`);
  return {
    movement: rows.map((r) => Number(r.fixes)),
    incidents: rows.map((r) => Number(r.incidents)),
    registrations: rows.map((r) => Number(r.registrations)),
    healthAnomalies: rows.map(() => 0),
    days: rows.map((r) => r.d),
  };
}

/** Recent activity, assembled from things that actually happened. */
export async function getRecentActivity() {
  // `when` is a reserved word in Postgres — alias as `at`.
  const rows = await query<{ at: Date; text: string; tone: string }>(`
    (select opened_at as at,
            'Containment breach: ' || a.tag || ' left ' || coalesce(p.name, 'its allocation') as text,
            'coral' as tone
       from containment_events e
       join animals a on a.id = e.animal_id
       left join land_parcels p on p.id = e.parcel_id
      order by opened_at desc limit 5)
    union all
    (select reported_at, 'Incident ' || ref || ': ' || replace(type::text, '_', ' '), 'amber'
       from incidents order by reported_at desc limit 5)
    union all
    -- Diagnostics are written in the officer's language, not the protocol's, and
    -- identify the animal by ear tag rather than by IMEI — the tag protocol treats
    -- the IMEI as the device's whole identity, so it does not belong on screen.
    -- Limited to one row: unpositioned fixes alone number in the thousands and
    -- would otherwise crowd out every breach and incident in the feed.
    (select dan.observed_at,
            case dan.kind
              when 'unpositioned_fix'         then 'Tag reported without a GPS fix'
              when 'undocumented_sync_fields' then 'Tag sent extra fields in a sync message'
              when 'duplicate_imei'           then 'Two connections claimed the same tag'
              when 'source_ip_changed'        then 'Tag reconnected from a new network address'
              else replace(dan.kind, '_', ' ')
            end || coalesce(' — ' || a.tag, ''),
            'violet'
       from device_anomalies dan
       left join devices d on d.imei = dan.imei
       left join animals a on a.id = d.animal_id
      order by dan.observed_at desc limit 1)
    order by at desc limit 8`);

  return rows.map((r, i) => ({
    id: i,
    when: relativeTime(r.at),
    text: r.text,
    tone: r.tone as "veld" | "amber" | "violet" | "coral" | "cyan",
  }));
}

function relativeTime(d: Date | string): string {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Health screen: vaccination status across the herd. */
export async function getHealthOverview() {
  const [r] = await query<Record<string, string>>(`
    select
      (select count(*) from animals where status = 'healthy') as healthy,
      (select count(*) from animals where status = 'monitoring') as monitoring,
      (select count(*) from animals where status = 'alert') as alert,
      (select count(*) from animals where status = 'quarantined') as quarantined,
      (select count(*) from animal_health_summary where overdue_since is not null) as overdue,
      (select count(*) from animal_health_summary
        where next_vaccination between current_date and current_date + interval '30 days') as due_soon`);
  return {
    healthy: Number(r.healthy), monitoring: Number(r.monitoring),
    alert: Number(r.alert), quarantined: Number(r.quarantined),
    overdue: Number(r.overdue), dueSoon: Number(r.due_soon),
  };
}

export async function getHealthRecords(animalId: string) {
  return query<{
    id: string; type: string; occurred_on: string; next_due_on: string | null;
    description: string; veterinarian: string | null;
  }>(`select id, type, occurred_on, next_due_on, description, veterinarian
        from health_records where animal_id = $1::uuid order by occurred_on desc`, [asUuid(animalId)]);
}

/** Open containment breaches, for the tracking and dashboard alert rails. */
export async function getOpenBreaches() {
  return query<{
    id: string; tag: string; animal_id: string; parcel: string | null;
    opened_at: Date; max_distance_m: number | null; owner: string; phone: string;
  }>(`
    select e.id, a.tag, a.id as animal_id, p.name as parcel, e.opened_at,
           e.max_distance_m, o.full_name as owner, o.phone
      from containment_events e
      join animals a on a.id = e.animal_id
      join owners o on o.id = a.owner_id
      left join land_parcels p on p.id = e.parcel_id
     where e.status = 'open'
     order by e.opened_at desc`);
}

/* ---------------------------------------------------------------- map */

export type MapAnimal = {
  animal_id: string; tag: string; name: string | null;
  species: string; status: string; owner_name: string | null;
  battery_pct: number | null;
  last_fix_at: string | null; last_fix_type: string | null;
  lat: number | null; lng: number | null;
  parcel_id: string | null; parcel_name: string | null;
  containment_state: string | null; distance_m: number | null;
};

export type MapParcel = {
  id: string; reference: string | null; name: string; tenure: string | null;
  area_ha: string; tolerance_m: number | null; breach_dwell_s: number | null;
  ward: string | null; owner_name: string | null;
  /** PostGIS ST_AsGeoJSON output — a Polygon, ready for MapLibre. */
  geojson: GeoJSON.Polygon;
  animal_count: string;
  /**
   * An allocation is the ground an animal is permitted on, and is what
   * containment is judged against. A zone is a management area an officer drew.
   * The map draws both but must not imply they mean the same thing.
   */
  kind: "allocation" | "zone";
  zone_type: string | null;
};

/**
 * Everything the live map draws, in real coordinates — no canvas projection.
 *
 * Columns are named rather than `select *` so the view cannot quietly publish a
 * new field. In particular the IMEI stays out: the tag protocol treats it as the
 * device's whole identity, the gateway listens on a public address, and this
 * endpoint is readable with the anon key — so anyone holding an IMEI could
 * inject fabricated positions for that animal. The map never needed it.
 */
export async function getMapAnimals(): Promise<MapAnimal[]> {
  return query<MapAnimal>(
    `select animal_id, tag, name, species, status, owner_name, battery_pct,
            last_fix_at, last_fix_type, lat, lng, parcel_id, parcel_name,
            containment_state, distance_m
       from map_animals
      where lat is not null
        and (imei is null or imei <> all($1::text[]))
      order by tag`, [await withheld()]);
}

export async function getMapParcels(): Promise<MapParcel[]> {
  return query<MapParcel>(`select * from map_parcels order by name`);
}

/** Recent track for one animal, newest last, for drawing a path. */
export async function getAnimalTrack(animalId: string, hours = 24) {
  return query<{ ts: string; lat: number; lng: number; fix: string; speed_kph: number | null }>(
    `select recorded_at as ts,
            st_y(geom::geometry) as lat, st_x(geom::geometry) as lng,
            fix::text as fix, speed_kph
       from fixes
      where animal_id = $1::uuid
        and recorded_at > now() - make_interval(hours => $2)
        and fix = 'gps'
      order by recorded_at`,
    [asUuid(animalId), hours]);
}

/**
 * Persist a field allocation drawn on the map.
 *
 * The ring arrives as [lng, lat] pairs from MapLibre and is closed by the
 * caller. PostGIS validates and orients it; an invalid polygon (self-crossing,
 * for instance) fails here rather than becoming a boundary that silently never
 * matches anything.
 */
export async function createParcel({
  name, tenure = "communal", ring, toleranceM = 25, breachDwellS = 180,
}: {
  name: string;
  tenure?: string;
  ring: [number, number][];
  toleranceM?: number;
  breachDwellS?: number;
}) {
  const wkt = `POLYGON((${ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ")}))`;
  const reference = `HRE-P-${Date.now().toString(36).toUpperCase()}`;

  const rows = await query<{ id: string; name: string; area_ha: string }>(
    `insert into land_parcels (reference, name, tenure, geom, tolerance_m, breach_dwell_s)
     values ($1, $2, $3::tenure_type,
             st_makevalid(st_geogfromtext($4)::geometry)::geography,
             $5, $6)
     returning id, name, area_ha`,
    [reference, name, tenure, wkt, toleranceM, breachDwellS],
  );
  return rows[0];
}

/**
 * Movement derived from consecutive GPS fixes.
 *
 * Only GPS: a WiFi fix can be 70 m off a stationary animal, which would
 * accumulate kilometres of phantom travel. Returns nulls rather than zeros when
 * there is not enough telemetry yet, so the UI can say so instead of implying
 * the herd stood still.
 */
export async function getMovementStats(opts: { ownerId?: string; animalId?: string; days?: number } = {}) {
  const days = opts.days ?? 14;
  const [row] = await query<{
    total_km: string | null; animals: string; active_days: string; median_speed: string | null;
    peak_hour: string | null;
  }>(`
    with steps as (
      select f.animal_id, f.recorded_at, f.speed_kph,
             st_distance(f.geom, lag(f.geom) over (partition by f.animal_id order by f.recorded_at)) as step_m
        from fixes f
        join animals a on a.id = f.animal_id
       where f.fix = 'gps'
         and f.recorded_at > now() - make_interval(days => $1)
         and ($2::uuid is null or a.owner_id = $2::uuid)
         and ($3::uuid is null or a.id = $3::uuid)
    )
    select
      round((sum(step_m) filter (where step_m < 5000) / 1000.0)::numeric, 1) as total_km,
      count(distinct animal_id) as animals,
      count(distinct recorded_at::date) as active_days,
      round(percentile_cont(0.5) within group (order by speed_kph)::numeric, 1) as median_speed,
      (select to_char(date_trunc('hour', recorded_at), 'HH24:00') from steps
        where step_m > 0 group by 1 order by sum(step_m) desc limit 1) as peak_hour
    from steps`,
    [days, opts.ownerId ?? null, opts.animalId ?? null]);

  const n = Number(row?.animals ?? 0);
  const totalKm = row?.total_km != null ? Number(row.total_km) : null;
  return {
    totalKm,
    animals: n,
    activeDays: Number(row?.active_days ?? 0),
    windowDays: days,
    avgKmPerAnimal: totalKm != null && n > 0 ? Number((totalKm / n).toFixed(1)) : null,
    medianSpeedKph: row?.median_speed != null ? Number(row.median_speed) : null,
    peakHour: row?.peak_hour ?? null,
  };
}


/* ------------------------------------------------------------------ shell */

export type Operator = { name: string; role: string; initials: string; ward: string | null };

/**
 * Who the shell shows as signed in, and the real values the assistant offers
 * as opening suggestions.
 *
 * Both used to be hardcoded, and both named things that exist nowhere in the
 * database — an officer with no staff row, a ward and an ear tag that were
 * never registered. That is worse than a placeholder: it reads as a real
 * account and real records, so the first suggestion anyone clicks returns
 * nothing. Until authentication exists the shell shows a genuine staff row, and
 * every suggestion names data that is actually there.
 */
export async function getOperator(): Promise<Operator | null> {
  const rows = await query<{ full_name: string; role: string; ward: string | null }>(
    `select s.full_name, s.role::text as role, (select name from wards order by name limit 1) as ward
       from staff s
      order by case s.role::text when 'officer' then 0 when 'vet' then 1 else 2 end,
               s.full_name
      limit 1`);
  const r = rows[0];
  if (!r) return null;
  const initials = r.full_name
    .replace(/^(Insp\.|Sgt\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { name: r.full_name, role: r.role, initials, ward: r.ward };
}

export async function getAssistantContext(): Promise<{ tag: string | null; ward: string | null }> {
  const tag = await query<{ tag: string }>(
    `select a.tag from animals a
       join devices d on d.animal_id = a.id
      where d.last_position is not null
      order by d.last_fix_at desc nulls last
      limit 1`);
  const ward = await query<{ name: string }>(`select name from wards order by name limit 1`);
  return { tag: tag[0]?.tag ?? null, ward: ward[0]?.name ?? null };
}

/** Registered wards, for pickers. Ordered as an operator would expect to read them. */
export async function getWards(): Promise<{ id: string; name: string }[]> {
  return query<{ id: string; name: string }>(`select id, name from wards order by name`);
}

/**
 * Device diagnostics, grouped by kind.
 *
 * The analytics page used to display an invented "theft risk score" weighted
 * across four wards that were never registered. These counts are the real thing
 * the gateway has observed, and they are the honest version of the same panel:
 * what the hardware is actually doing, rather than a model that does not exist.
 */
export async function getDeviceDiagnostics(): Promise<
  { kind: string; count: number; lastSeen: Date | null }[]
> {
  const rows = await query<{ kind: string; n: string; last_seen: Date | null }>(
    `select kind, count(*)::text as n, max(observed_at) as last_seen
       from device_anomalies
      group by kind
      order by count(*) desc`);
  return rows.map((r) => ({ kind: r.kind, count: Number(r.n), lastSeen: r.last_seen }));
}

/** Staff who can be assigned work, ordered with field officers first. */
export async function getStaff(): Promise<{ id: string; name: string; role: string }[]> {
  const rows = await query<{ id: string; full_name: string; role: string }>(
    `select auth_user_id as id, full_name, role::text as role
       from staff
      where active
      order by case role::text when 'officer' then 0 when 'vet' then 1 else 2 end, full_name`);
  return rows.map((r) => ({ id: r.id, name: r.full_name, role: r.role }));
}

/**
 * Share of the herd carrying each kind of health record.
 *
 * The analytics page used to draw a fixed bar chart — FMD 88%, brucellosis 64%,
 * rabies 72%, anthrax 41% — with no health records in the database at all. This
 * returns an empty list when nothing has been recorded, so the panel can say so
 * instead of inventing coverage.
 */
export async function getVaccinationCoverage(): Promise<
  { type: string; animals: number; pct: number }[]
> {
  const [tot] = await query<{ n: string }>(`select count(*)::text as n from animals`);
  const total = Number(tot?.n ?? 0);
  if (!total) return [];
  const rows = await query<{ type: string; n: string }>(
    `select type::text as type, count(distinct animal_id)::text as n
       from health_records
      group by type
      order by count(distinct animal_id) desc
      limit 6`);
  return rows.map((r) => ({
    type: r.type,
    animals: Number(r.n),
    pct: Math.round((Number(r.n) / total) * 100),
  }));
}

/**
 * Create a management zone from a ring of real coordinates.
 *
 * The zone wizard used to draw on an abstract 0–100 canvas and then simulate a
 * save, so even a carefully drawn boundary could not have become a real one.
 * This writes an actual PostGIS polygon, the same way the live map writes a
 * parcel.
 *
 * `st_makevalid` is applied because a hand-drawn ring can self-intersect, and a
 * geography column rejects an invalid polygon outright rather than storing
 * something the containment engine would later trip over.
 */
export async function createGeofence({
  name, type, ring, wardName, capacity,
}: {
  name: string;
  type: string;
  ring: [number, number][];
  wardName?: string | null;
  capacity?: number | null;
}) {
  const closed =
    ring.length > 2 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
      ? [...ring, ring[0]]
      : ring;
  const wkt = `POLYGON((${closed.map(([lng, lat]) => `${lng} ${lat}`).join(", ")}))`;

  const rows = await query<{ id: string; name: string; area_ha: string }>(
    `insert into geofences (name, type, ward_id, geom, capacity)
     values ($1, $2::zone_type,
             (select id from wards where name = $3),
             st_makevalid(st_geogfromtext($4)::geometry)::geography,
             $5)
     returning id, name, area_ha`,
    [name, type, wardName ?? null, wkt, capacity ?? null],
  );
  return rows[0];
}

/**
 * Whether the gateway is still delivering.
 *
 * The gateway runs on separate infrastructure, so the honest test of "is it up"
 * is whether a position has arrived recently. Measured with the database's own
 * clock rather than the renderer's — the tag's clock has already been shown to
 * run hours fast, and a server component should not be reading wall time during
 * render anyway.
 */
export async function getGatewayStatus(): Promise<{ hoursSinceFix: number | null; live: boolean }> {
  const [row] = await query<{ hours: string | null }>(
    `select extract(epoch from (now() - max(last_fix_at))) / 3600 as hours from devices`);
  const hours = row?.hours != null ? Number(row.hours) : null;
  return { hoursSinceFix: hours, live: hours != null && hours < 6 };
}

export type SearchHit = { type: string; label: string; sub: string | null; href: string };

/**
 * Cross-entity search for the ⌘K field.
 *
 * The field existed, tracked what you typed and did nothing with it. Matching is
 * a case-insensitive prefix-or-contains over the identifiers people actually
 * hold in their heads: an ear tag, an animal's name, an owner, a zone, an
 * incident reference.
 */
export async function search(term: string): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const rows = await query<{ type: string; label: string; sub: string | null; href: string }>(
    `(select 'Animal' as type, a.tag || coalesce(' · ' || a.name, '') as label,
             o.full_name as sub, '/livestock/' || a.id as href
        from animals a left join owners o on o.id = a.owner_id
       where a.tag ilike $1 or a.name ilike $1
       limit 6)
     union all
     (select 'Owner', o.full_name, w.name, '/owners/' || o.id
        from owners o left join wards w on w.id = o.ward_id
       where o.full_name ilike $1 or o.phone ilike $1
       limit 6)
     union all
     (select 'Zone', g.name, g.type::text, '/geofences'
        from geofences g where g.name ilike $1 limit 5)
     union all
     (select 'Incident', i.ref, replace(i.type::text, '_', ' '), '/incidents/' || i.id
        from incidents i where i.ref ilike $1 limit 5)`,
    [like]);
  return rows;
}

/* ------------------------------------------------------------------ auth */

export type StaffAccount = {
  id: string;
  fullName: string;
  role: string;
  ward: string | null;
  passwordHash: string | null;
  tokenVersion: number;
  active: boolean;
  /**
   * The human behind the post.
   *
   * Permissions are held by people, not by council posts — the same
   * veterinarian may be a member of a council and of three farms. Null for a
   * row created before identity was split out, and for a farmer the City has
   * registered who has never signed in.
   */
  personId: string | null;
};

const STAFF_ACCOUNT_SQL = `
  select s.auth_user_id as id, s.full_name, s.role::text as role, w.name as ward,
         s.password_hash, s.token_version, s.active, s.email, s.person_id
    from staff s left join wards w on w.id = s.ward_id`;

type StaffAccountRow = {
  id: string; full_name: string; role: string; ward: string | null;
  password_hash: string | null; token_version: number; active: boolean;
  email: string | null; person_id: string | null;
};

const toAccount = (r: StaffAccountRow): StaffAccount => ({
  id: r.id, fullName: r.full_name, role: r.role, ward: r.ward,
  passwordHash: r.password_hash, tokenVersion: Number(r.token_version), active: r.active,
  personId: r.person_id,
});

/** Case-insensitive: nobody remembers whether they registered with a capital. */
export async function getStaffByEmail(email: string): Promise<StaffAccount | null> {
  const rows = await query<StaffAccountRow>(
    `${STAFF_ACCOUNT_SQL} where lower(s.email) = lower($1)`, [email.trim()]);
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function getStaffById(id: string): Promise<StaffAccount | null> {
  const rows = await query<StaffAccountRow>(
    `${STAFF_ACCOUNT_SQL} where s.auth_user_id = $1::uuid`, [asUuid(id)]);
  return rows[0] ? toAccount(rows[0]) : null;
}

/**
 * Records a successful sign-in.
 *
 * Issuing and checking the six-digit code moved to Supabase Auth, so that it can
 * be delivered by Supabase's own mailer using the branded templates in
 * `supabase/templates`. The `login_codes` table this app used to manage is no
 * longer written to.
 */
export async function touchLastLogin(staffId: string) {
  await query(
    `update staff set last_login_at = now() where auth_user_id = $1::uuid`,
    [asUuid(staffId)],
  );
}

/**
 * Set a password after a verified code, and end every session that person had.
 *
 * The two happen together on purpose. Somebody resetting a password has usually
 * lost control of it, so leaving their old sessions alive would defeat the
 * reset.
 */
export async function setStaffPassword(staffId: string, passwordHash: string) {
  await query(
    `update staff set password_hash = $2 where auth_user_id = $1::uuid`,
    [asUuid(staffId), passwordHash],
  );
  await query(`select bump_token_version($1::uuid)`, [asUuid(staffId)]);
}

/** Adds a colleague. They have no password until they complete the invitation. */
export async function createStaff(opts: {
  fullName: string; email: string; role: string; wardName?: string | null;
}) {
  const rows = await query<{ id: string }>(
    `insert into staff (auth_user_id, full_name, role, ward_id, active, email)
     values (gen_random_uuid(), $1, $2::app_role,
             (select id from wards where name = $3), true, $4)
     returning auth_user_id as id`,
    [opts.fullName, opts.role, opts.wardName ?? null, opts.email.trim()],
  );
  return rows[0];
}

/* --------------------------------------------------------------- writes */

/**
 * Registering an owner.
 *
 * `national_id` is unique in the schema, so a duplicate raises rather than
 * quietly creating a second record for the same person — the caller turns that
 * into a message about which field to correct.
 */
export async function createOwner(o: {
  fullName: string; nationalId: string; phone: string;
  wardName?: string | null; address?: string | null;
}) {
  const rows = await query<{ id: string }>(
    `insert into owners (full_name, national_id, phone, ward_id, address)
     values ($1, $2, $3, (select id from wards where name = $4), $5)
     returning id`,
    [o.fullName, o.nationalId, o.phone, o.wardName ?? null, o.address ?? null]);
  return rows[0];
}

/** Registering an animal against an owner and, optionally, an allocation. */
export async function createAnimal(a: {
  tag: string; name?: string | null; species: string; breed?: string | null;
  sex?: string | null; birthDate?: string | null; colour?: string | null;
  ownerId: string; parcelName?: string | null;
}) {
  const rows = await query<{ id: string; tag: string }>(
    `insert into animals (tag, name, species, breed, sex, birth_date, colour,
                          owner_id, home_parcel_id)
     values ($1, $2, $3::species_type, $4, $5::animal_sex, $6::date, $7,
             $8::uuid, (select id from land_parcels where name = $9))
     returning id, tag`,
    [a.tag, a.name ?? null, a.species, a.breed ?? null, a.sex ?? null,
     a.birthDate ?? null, a.colour ?? null, asUuid(a.ownerId), a.parcelName ?? null]);
  return rows[0];
}

/** Reporting an incident. The reference comes from the database, not the client. */
export async function createIncident(i: {
  type: string; severity: string; animalId?: string | null; ownerId?: string | null;
  locationLabel?: string | null; officer?: string | null; notes?: string | null;
}) {
  const rows = await query<{ id: string; ref: string }>(
    `insert into incidents (ref, type, severity, animal_id, owner_id,
                            location_label, officer, notes)
     values (next_incident_ref(), $1::incident_type, $2::incident_severity,
             $3::uuid, $4::uuid, $5, $6, $7)
     returning id, ref`,
    [i.type, i.severity, asUuid(i.animalId ?? null), asUuid(i.ownerId ?? null),
     i.locationLabel ?? null, i.officer ?? null, i.notes ?? null]);
  return rows[0];
}

/** Logging a vaccination, treatment or inspection. */
export async function createHealthRecord(h: {
  animalId: string; type: string; occurredOn: string; nextDueOn?: string | null;
  description: string; medicine?: string | null; veterinarian?: string | null;
}) {
  const rows = await query<{ id: string }>(
    `insert into health_records (animal_id, type, occurred_on, next_due_on,
                                 description, medicine, veterinarian)
     values ($1::uuid, $2::health_record_type, $3::date, $4::date, $5, $6, $7)
     returning id`,
    [asUuid(h.animalId), h.type, h.occurredOn, h.nextDueOn ?? null,
     h.description, h.medicine ?? null, h.veterinarian ?? null]);
  return rows[0];
}

/**
 * Move an incident through its workflow.
 *
 * `resolved_at` is set by the same statement that sets the status, so the two
 * cannot disagree — a resolved incident always carries the moment it was closed,
 * and reopening one clears it.
 */
export async function updateIncidentStatus(
  id: string, status: string, officer: string,
) {
  const rows = await query<{ id: string; status: string }>(
    `update incidents
        set status = $2::incident_status,
            officer = coalesce(officer, $3),
            resolved_at = case when $2 = 'resolved' then now() else null end
      where id = $1::uuid
      returning id, status::text as status`,
    [asUuid(id), status, officer]);
  return rows[0] ?? null;
}

/** Retire a zone without deleting it — containment events still cite it. */
export async function archiveGeofence(id: string) {
  const rows = await query<{ id: string }>(
    `update geofences set active = false where id = $1::uuid returning id`,
    [asUuid(id)]);
  return rows[0] ?? null;
}

/**
 * Corrections.
 *
 * Everything here was create-only until now, so a mistyped national ID or a
 * wrong ward could only be fixed with a database statement. Each of these
 * updates just the columns the application role was granted in 0011 — role,
 * ward assignment and identity keys stay out of reach.
 *
 * `coalesce($n, column)` throughout: an omitted field leaves the stored value
 * alone rather than blanking it, so a form that sends a subset cannot silently
 * erase what it did not carry.
 */
export async function updateOwner(id: string, o: {
  fullName?: string; phone?: string; address?: string | null; wardName?: string | null;
}) {
  const rows = await query<{ id: string }>(
    `update owners
        set full_name = coalesce($2, full_name),
            phone     = coalesce($3, phone),
            address   = coalesce($4, address),
            ward_id   = coalesce((select id from wards where name = $5), ward_id),
            updated_at = now()
      where id = $1::uuid
      returning id`,
    [asUuid(id), o.fullName ?? null, o.phone ?? null, o.address ?? null, o.wardName ?? null]);
  return rows[0] ?? null;
}

export async function updateAnimal(id: string, a: {
  tag?: string; name?: string | null; breed?: string | null; sex?: string | null;
  birthDate?: string | null; colour?: string | null; status?: string | null;
  parcelName?: string | null;
}) {
  const rows = await query<{ id: string; tag: string }>(
    `update animals
        set tag        = coalesce($9, tag),
            name       = coalesce($2, name),
            breed      = coalesce($3, breed),
            sex        = coalesce($4::animal_sex, sex),
            birth_date = coalesce($5::date, birth_date),
            colour     = coalesce($6, colour),
            status     = coalesce($7::animal_status, status),
            home_parcel_id = coalesce(
              (select id from land_parcels where name = $8), home_parcel_id)
      where id = $1::uuid
      returning id, tag`,
    [asUuid(id), a.name ?? null, a.breed ?? null, a.sex ?? null,
     a.birthDate ?? null, a.colour ?? null, a.status ?? null, a.parcelName ?? null,
     a.tag ?? null]);
  return rows[0] ?? null;
}

/**
 * Totals, counted in the database rather than by measuring a fetched array.
 *
 * A page showing "50 animals" because that is the page size, when the register
 * holds four hundred, is worse than showing nothing.
 */
export async function countRows(table: "animals" | "owners" | "incidents"): Promise<number> {
  const [row] = await query<{ n: string }>(`select count(*)::text as n from ${table}`);
  return Number(row?.n ?? 0);
}

/**
 * Animals needing attention, decided in SQL.
 *
 * The dashboard used to fetch every animal and filter in JavaScript, which is
 * why the list queries could not simply be capped: the watchlist would have
 * silently started missing animals beyond the first page.
 */
export async function getAnimalsNeedingAttention(limit = 20): Promise<Animal[]> {
  return (await query<AnimalRow>(
    `${await animalSql()}
      where a.status <> 'healthy'
         or (d.battery_pct is not null and d.battery_pct between 1 and 24)
         or d.last_fix_at < now() - interval '2 hours'
      order by a.tag
      limit $1`, [limit])).map(toAnimal);
}

/* -------------------------------------------------------- notifications */

export type Notice = {
  id: string; subject: string; body: string; href: string | null;
  severity: string; createdAt: string; read: boolean;
};

/** Unread first, newest first. Bounded — the bell is a summary, not an archive. */
export async function getNotifications(staffId: string, limit = 12): Promise<Notice[]> {
  const rows = await query<{
    id: string; subject: string; body: string; href: string | null;
    severity: string; created_at: Date; read_at: Date | null;
  }>(
    `select id, subject, body, href, severity, created_at, read_at
       from notifications
      where staff_id = $1::uuid
      order by (read_at is null) desc, created_at desc
      limit $2`, [asUuid(staffId), limit]);
  return rows.map((r) => ({
    id: r.id, subject: r.subject, body: r.body, href: r.href,
    severity: r.severity, createdAt: r.created_at.toISOString(), read: r.read_at !== null,
  }));
}

export async function markNotificationsRead(staffId: string, ids?: string[]) {
  if (ids?.length) {
    await query(
      `update notifications set read_at = now()
        where staff_id = $1::uuid and id = any($2::uuid[]) and read_at is null`,
      [asUuid(staffId), ids]);
    return;
  }
  await query(
    `update notifications set read_at = now() where staff_id = $1::uuid and read_at is null`,
    [asUuid(staffId)]);
}

/**
 * Notices waiting to go out over a carrier.
 *
 * In-app notices are delivered by being read, so they are never pending. These
 * are the ones that need an SMS or WhatsApp account the pilot does not yet have.
 */
export async function getPendingOutbound(limit = 50) {
  return query<{ id: string; channel: string; subject: string; body: string; phone: string | null }>(
    `select n.id, n.channel::text as channel, n.subject, n.body, o.phone
       from notifications n
       left join owners o on o.id = n.owner_id
      where n.state = 'pending' and n.channel <> 'in_app'
      order by n.created_at
      limit $1`, [limit]);
}

/* ------------------------------------------------------------- devices */

export type UnclaimedDevice = {
  id: string; imei: string; imeiMasked: string; type: string;
  batteryPct: number | null; lastSeenAt: string | null; anomalies: number;
};

/**
 * Tags reporting to the gateway that belong to no animal yet.
 *
 * The full IMEI is returned alongside the masked one: an officer standing in a
 * field with a tag in their hand needs to match the number printed on it, and
 * four digits is not enough to tell fifteen tags apart. This is behind a
 * session, unlike the map endpoint that publishes to any signed-in viewer.
 */
export async function getUnclaimedDevices(): Promise<UnclaimedDevice[]> {
  const rows = await query<{
    id: string; imei: string; type: string; battery_pct: number | null;
    last_seen_at: Date | null; anomalies: string;
  }>(`select id, imei, type, battery_pct, last_seen_at, anomalies
        from unclaimed_devices
       where imei <> all($1::text[])`, [await withheld()]);
  return rows.map((r) => ({
    id: r.id, imei: r.imei, imeiMasked: maskImei(r.imei), type: r.type,
    batteryPct: r.battery_pct,
    lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
    anomalies: Number(r.anomalies),
  }));
}

export type TagRow = {
  id: string; imei: string; imeiMasked: string;
  batteryPct: number | null; signalPct: number | null;
  lastSeenAt: string | null; lastFixAt: string | null;
  satellites: number | null; fixes: number;
  animalId: string | null; animalTag: string | null; animalName: string | null;
  ownerName: string | null;
};

/**
 * Every tag the platform knows about, assigned or not.
 *
 * This existed nowhere. Device counts across the application were derived from
 * the *animal* list — `tracking` computed offline devices as
 * `animals.length - live` — so a tag that had reached the gateway but was not
 * yet on an animal was invisible to every screen. Ten tags were configured in
 * Harare and nine of them could not be seen without a database query.
 *
 * Ordered by last contact so the ones that just arrived are at the top, which
 * is what somebody watching a rollout actually wants.
 */
export async function getTagInventory(): Promise<TagRow[]> {
  const rows = await query<{
    id: string; imei: string; battery_pct: number | null; signal_pct: number | null;
    last_seen_at: Date | null; last_fix_at: Date | null; satellites: number | null;
    fixes: string; animal_id: string | null; animal_tag: string | null;
    animal_name: string | null; owner_name: string | null;
  }>(`
    select d.id, d.imei, d.battery_pct, d.signal_pct, d.last_seen_at, d.last_fix_at,
           (select f.satellites from fixes f
             where f.device_id = d.id order by f.recorded_at desc limit 1) as satellites,
           (select count(*) from fixes f where f.device_id = d.id) as fixes,
           d.animal_id, a.tag as animal_tag, a.name as animal_name,
           o.full_name as owner_name
      from devices d
      left join animals a on a.id = d.animal_id
      left join owners  o on o.id = a.owner_id
     where d.imei <> all($1::text[])
     order by d.last_seen_at desc nulls last, d.imei`, [await withheld()]);

  return rows.map((r) => ({
    id: r.id, imei: r.imei, imeiMasked: maskImei(r.imei),
    batteryPct: r.battery_pct, signalPct: r.signal_pct,
    lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
    lastFixAt: r.last_fix_at ? r.last_fix_at.toISOString() : null,
    satellites: r.satellites, fixes: Number(r.fixes),
    animalId: r.animal_id, animalTag: r.animal_tag, animalName: r.animal_name,
    ownerName: r.owner_name,
  }));
}

/**
 * Fleet-wide device health, counted from devices rather than from animals.
 *
 * The dashboard reported "Devices online 1 — 100% of fleet" while nine tags sat
 * dark, because the denominator was the number of registered animals. These are
 * the honest numbers.
 */
export async function getFleetStats(): Promise<{
  total: number; online: number; assigned: number; unassigned: number; lowBattery: number;
}> {
  const rows = await query<{
    total: string; online: string; assigned: string; unassigned: string; low_battery: string;
  }>(`
    select count(*) as total,
           count(*) filter (where last_seen_at > now() - interval '10 minutes') as online,
           count(*) filter (where animal_id is not null) as assigned,
           count(*) filter (where animal_id is null) as unassigned,
           count(*) filter (where battery_pct is not null and battery_pct < 30) as low_battery
      from devices
     where imei <> all($1::text[])`, [await withheld()]);
  const r = rows[0];
  return {
    total: Number(r?.total ?? 0), online: Number(r?.online ?? 0),
    assigned: Number(r?.assigned ?? 0), unassigned: Number(r?.unassigned ?? 0),
    lowBattery: Number(r?.low_battery ?? 0),
  };
}

/**
 * Attach a tag to an animal, or detach it.
 *
 * Passing a null animal releases the tag — which is what happens when one is
 * taken off an animal that has been sold or has died, and it becomes claimable
 * again rather than being deleted.
 */
export async function assignDevice(deviceId: string, animalId: string | null) {
  const rows = await query<{ id: string; imei: string }>(
    `update devices set animal_id = $2::uuid where id = $1::uuid returning id, imei`,
    [asUuid(deviceId), asUuid(animalId)]);
  return rows[0] ?? null;
}

/** Find a device by the IMEI printed on it, for claiming during registration. */
export async function getDeviceByImei(imei: string) {
  // Hiding a tag from the lists is not enough on its own: this is the lookup
  // behind "type the number printed on the tag", so an evaluator who guessed
  // the pilot's IMEI could claim it from the list it was removed from — and
  // claiming it would detach a tag from a real animal in a real paddock.
  // Answering "no such tag" is the same answer they get for a typo.
  const rows = await query<{ id: string; animal_id: string | null }>(
    `select id, animal_id from devices
      where imei = $1 and imei <> all($2::text[])`, [imei.trim(), await withheld()]);
  return rows[0] ?? null;
}

/**
 * Remove an animal from the register.
 *
 * Safe to do because of how the foreign keys are declared, which is worth
 * stating rather than trusting from memory. Positions and incidents are
 * `on delete set null`, so telemetry already recorded and any enforcement case
 * raised against the animal both survive it — a council cannot erase its own
 * audit trail by deleting a record. Containment state and health records
 * cascade, because neither means anything without the animal.
 *
 * The device is `on delete set null` too, so the ear tag releases itself. It is
 * released explicitly here anyway, so the IMEI can be shown to whoever pressed
 * the button — the tag is a physical object somebody now has to collect.
 */
export async function deleteAnimal(animalId: string): Promise<{
  tag: string; releasedImei: string | null;
} | null> {
  const released = await query<{ imei: string }>(
    `update devices set animal_id = null where animal_id = $1::uuid returning imei`,
    [asUuid(animalId)]);

  const rows = await query<{ tag: string }>(
    `delete from animals where id = $1::uuid returning tag`, [asUuid(animalId)]);

  if (!rows[0]) return null;
  return { tag: rows[0].tag, releasedImei: released[0]?.imei ?? null };
}

/**
 * Serve a notice on a livestock owner.
 *
 * This is the enforcement half of the platform: a council telling a farmer
 * their animal was out, their licence is due, or their herd is under
 * quarantine. The button for it sat on the owner page doing nothing, which is
 * the wrong thing to show a City that is buying enforcement.
 *
 * Written as a notification rather than an email because that is what the
 * platform can honestly promise today: the row is created and shown to the
 * owner in the platform, and the SMS channel is queued rather than sent — there
 * is no carrier account yet. The state says which, so nothing claims to have
 * been delivered when it has not.
 */
export async function serveNotice(opts: {
  ownerId: string;
  subject: string;
  body: string;
  severity: "low" | "medium" | "high" | "critical";
  channel: "in_app" | "sms";
  officer: string;
}): Promise<{ id: string; state: string } | null> {
  const rows = await query<{ id: string; state: string }>(
    `insert into notifications (owner_id, channel, subject, body, severity, state)
     values ($1::uuid, $2::notification_channel, $3, $4, $5::incident_severity,
             -- In-app is delivered the moment it is written. SMS waits for a
             -- carrier account, and saying "pending" is the honest word for
             -- something nobody has sent.
             case when $2 = 'in_app' then 'sent' else 'pending' end::notification_state)
     returning id, state::text`,
    [asUuid(opts.ownerId), opts.channel, opts.subject.trim(),
     `${opts.body.trim()}\n\n— ${opts.officer}`, opts.severity]);
  return rows[0] ?? null;
}

/* ---------------------------------------------------------- permission */

export type TenantGrant = {
  tenantId: string;
  tenantName: string;
  kind: "platform" | "municipal" | "farm";
  plan: "full" | "demo" | "suspended";
  role: "owner" | "admin" | "manager" | "officer" | "vet" | "herdsman" | "viewer";
  /** The council this farm answers to, for the disclosure boundary. */
  jurisdictionId: string | null;
};

/**
 * What a person may do, read from the database rather than from the session.
 *
 * The plan in particular must never travel in a cookie. A ceiling the browser
 * carries is a ceiling the browser can be persuaded to raise, and the whole
 * point of putting it on the tenant was that nobody inside can lift it.
 *
 * Returns every tenant they hold, because a veterinarian invited onto several
 * farms is one person with several grants and the route has to know which one
 * the record in front of it falls under.
 */
export async function getGrants(personId: string): Promise<TenantGrant[]> {
  const rows = await query<{
    tenant_id: string; name: string; kind: string; plan: string; role: string;
    jurisdiction_id: string | null;
  }>(`select t.id as tenant_id, t.name, t.kind::text, t.plan::text,
             m.role::text, t.jurisdiction_id
        from tenant_members m
        join tenants t on t.id = m.tenant_id
       where m.person_id = $1::uuid
       order by case t.kind when 'platform' then 0 when 'municipal' then 1 else 2 end, t.name`,
     [asUuid(personId)]);

  return rows.map((r) => ({
    tenantId: r.tenant_id, tenantName: r.name,
    kind: r.kind as TenantGrant["kind"],
    plan: r.plan as TenantGrant["plan"],
    role: r.role as TenantGrant["role"],
    jurisdictionId: r.jurisdiction_id,
  }));
}

/**
 * The tenant a record belongs to, so a route can ask about the right ceiling.
 *
 * Answered from the row rather than from which page asked for it — the same
 * reason `animalBelongsTo` exists. A caller that passes its own idea of the
 * tenant is a caller that can pass somebody else's.
 */
export async function tenantOf(
  table: "animals" | "devices" | "land_parcels" | "geofences" | "incidents" | "owners",
  id: string,
): Promise<{ tenantId: string; jurisdictionId: string | null } | null> {
  // The table name is not interpolated from user input — the union above is the
  // whole permitted set, and TypeScript will not compile anything outside it.
  //
  // The jurisdiction comes back with it because a council officer regulating a
  // farm is not a member of that farm, and asking whether they may act on its
  // records cannot be answered from their own memberships alone.
  const rows = await query<{ tenant_id: string | null; jurisdiction_id: string | null }>(
    `select r.tenant_id, t.jurisdiction_id
       from ${table} r left join tenants t on t.id = r.tenant_id
      where r.id = $1::uuid`, [asUuid(id)]);
  const r = rows[0];
  if (!r?.tenant_id) return null;
  return { tenantId: r.tenant_id, jurisdictionId: r.jurisdiction_id };
}

/* ------------------------------------------------------------- identity */

export type PersonAccount = {
  id: string; fullName: string; email: string;
  passwordHash: string | null; active: boolean; tokenVersion: number;
};

export type Membership = {
  kind: "staff" | "owner";
  subjectId: string;
  role: string;
  label: string;
  ward: string | null;
};

/**
 * Sign-in resolves a person, not a role.
 *
 * `staff` and `owners` each carried their own email and password, so the login
 * route had to pick one table to check first — and whichever it picked, the
 * other identity for that address became unreachable. A council administrator
 * who also owns cattle could not sign in as a farmer.
 */
export async function getPersonByEmail(email: string): Promise<PersonAccount | null> {
  const rows = await query<{
    id: string; full_name: string; email: string;
    password_hash: string | null; active: boolean; token_version: number;
  }>(`select id, full_name, email, password_hash, active, token_version
        from people where lower(email) = lower($1)`, [email.trim()]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id, fullName: r.full_name, email: r.email,
    passwordHash: r.password_hash, active: r.active, tokenVersion: Number(r.token_version),
  };
}

/**
 * Every hat this person may wear.
 *
 * Re-derived on the server whenever a hat is chosen, so a browser cannot ask to
 * become somebody it is not by editing an id — the choice is checked against
 * this list rather than trusted.
 */
export async function getMemberships(personId: string): Promise<Membership[]> {
  const rows = await query<{
    kind: string; subject_id: string; role: string; label: string; ward: string | null;
  }>(`select m.kind, m.subject_id, m.role, m.label, w.name as ward
        from person_memberships m
        left join wards w on w.id = m.ward_id
       where m.person_id = $1::uuid and m.active
       order by case m.kind when 'staff' then 0 else 1 end, m.label`,
     [asUuid(personId)]);
  return rows.map((r) => ({
    kind: r.kind === "owner" ? "owner" : "staff",
    subjectId: r.subject_id, role: r.role, label: r.label, ward: r.ward,
  }));
}

/** Records the sign-in against the person, so "last seen" is per human. */
export async function touchPersonLogin(personId: string) {
  await query(`update people set last_login_at = now() where id = $1::uuid`, [asUuid(personId)]);
}

/* ------------------------------------------------------- owner accounts */

export type OwnerAccount = {
  id: string; fullName: string; ward: string | null; phone: string;
  passwordHash: string | null; tokenVersion: number;
  /** The human behind the record. See {@link StaffAccount.personId}. */
  personId: string | null;
};

const OWNER_ACCOUNT_SQL = `
  select o.id, o.full_name, o.phone, w.name as ward,
         o.password_hash, o.token_version, o.person_id
    from owners o left join wards w on w.id = o.ward_id`;

type OwnerAccountRow = {
  id: string; full_name: string; phone: string; ward: string | null;
  password_hash: string | null; token_version: number; person_id: string | null;
};

const toOwnerAccount = (r: OwnerAccountRow): OwnerAccount => ({
  id: r.id, fullName: r.full_name, phone: r.phone, ward: r.ward,
  passwordHash: r.password_hash, tokenVersion: Number(r.token_version),
  personId: r.person_id,
});

export async function getOwnerAccountByEmail(email: string): Promise<OwnerAccount | null> {
  const rows = await query<OwnerAccountRow>(
    `${OWNER_ACCOUNT_SQL} where lower(o.email) = lower($1)`, [email.trim()]);
  return rows[0] ? toOwnerAccount(rows[0]) : null;
}

export async function getOwnerAccountById(id: string): Promise<OwnerAccount | null> {
  const rows = await query<OwnerAccountRow>(
    `${OWNER_ACCOUNT_SQL} where o.id = $1::uuid`, [asUuid(id)]);
  return rows[0] ? toOwnerAccount(rows[0]) : null;
}

/** One address, one principal — checked before an invitation is sent. */
export async function emailIsFree(email: string): Promise<boolean> {
  const [row] = await query<{ free: boolean }>(
    `select email_is_free($1) as free`, [email.trim()]);
  return Boolean(row?.free);
}

export async function setOwnerEmail(ownerId: string, email: string) {
  await query(`update owners set email = $2 where id = $1::uuid`, [asUuid(ownerId), email.trim()]);
}

export async function setOwnerPassword(ownerId: string, passwordHash: string) {
  await query(
    `update owners set password_hash = $2, token_version = token_version + 1
      where id = $1::uuid`, [asUuid(ownerId), passwordHash]);
}

export async function touchOwnerLogin(ownerId: string) {
  await query(`update owners set last_login_at = now() where id = $1::uuid`, [asUuid(ownerId)]);
}

/* ------------------------------------------------ owner-scoped queries */

/**
 * Everything a farm owner may see.
 *
 * Each of these takes the owner's id as a required argument rather than reading
 * it from a session, so the scope is visible at every call site and a query that
 * forgot it would not compile. That is the whole safety argument: the officer
 * pages and these are different code, and the boundary is a function signature
 * rather than a filter somebody has to remember.
 */
export async function getHerd(ownerId: string): Promise<Animal[]> {
  return (await query<AnimalRow>(
    `${await animalSql()} where a.owner_id = $1::uuid order by a.tag`,
    [asUuid(ownerId)])).map(toAnimal);
}

export async function getHerdMap(ownerId: string): Promise<MapAnimal[]> {
  return query<MapAnimal>(
    `select m.animal_id, m.tag, m.name, m.species, m.status, m.owner_name,
            m.battery_pct, m.last_fix_at, m.last_fix_type, m.lat, m.lng,
            m.parcel_id, m.parcel_name, m.containment_state, m.distance_m
       from map_animals m
       join animals a on a.id = m.animal_id
      where a.owner_id = $1::uuid and m.lat is not null
      order by m.tag`, [asUuid(ownerId)]);
}

/** The allocations this owner's animals are held to. */
export async function getHerdParcels(ownerId: string): Promise<MapParcel[]> {
  return query<MapParcel>(
    `select distinct p.* from map_parcels p
       join animals a on a.home_parcel_id = p.id
      where a.owner_id = $1::uuid`, [asUuid(ownerId)]);
}

export async function getOwnerIncidents(ownerId: string): Promise<Incident[]> {
  return (await query<IncidentRow>(
    `${INCIDENT_SQL} where i.owner_id = $1::uuid order by i.reported_at desc limit 50`,
    [asUuid(ownerId)])).map(toIncident);
}

/** Breaches involving this owner's animals, open first. */
export async function getOwnerBreaches(ownerId: string) {
  return query<{
    id: string; tag: string; animal_id: string; parcel: string | null;
    opened_at: Date; closed_at: Date | null; max_distance_m: number | null;
  }>(
    `select e.id, a.tag, a.id as animal_id, p.name as parcel,
            e.opened_at, e.closed_at, e.max_distance_m
       from containment_events e
       join animals a on a.id = e.animal_id
       left join land_parcels p on p.id = e.parcel_id
      where a.owner_id = $1::uuid
      order by (e.closed_at is null) desc, e.opened_at desc
      limit 20`, [asUuid(ownerId)]);
}

/* --------------------------------------------------- ownership checks */

/**
 * Does this animal belong to this owner?
 *
 * Asked before every write a farmer makes. He can do the same things an officer
 * can — register an animal, claim a tag, correct a record, report an incident —
 * but only against his own herd, and the boundary is checked here rather than
 * assumed from which page the request came from. A page can be guessed at; a
 * row's owner_id cannot.
 */
export async function animalBelongsTo(animalId: string, ownerId: string): Promise<boolean> {
  const [row] = await query<{ n: string }>(
    `select count(*)::text as n from animals
      where id = $1::uuid and owner_id = $2::uuid`,
    [asUuid(animalId), asUuid(ownerId)]);
  return Number(row?.n ?? 0) > 0;
}

/**
 * Is this tag free, or already on one of this owner's animals?
 *
 * An unclaimed tag may be claimed by anybody who is holding it — that is what
 * unclaimed means, and the gateway has no way to know whose hand it is in. One
 * already on another farmer's animal may not be taken.
 */
export async function deviceClaimableBy(deviceId: string, ownerId: string): Promise<boolean> {
  const [row] = await query<{ ok: boolean }>(
    `select (d.animal_id is null or a.owner_id = $2::uuid) as ok
       from devices d left join animals a on a.id = d.animal_id
      where d.id = $1::uuid`,
    [asUuid(deviceId), asUuid(ownerId)]);
  return Boolean(row?.ok);
}

/** Unclaimed tags, plus any already on this owner's own animals. */
export async function getClaimableDevices(ownerId: string): Promise<UnclaimedDevice[]> {
  const rows = await query<{
    id: string; imei: string; type: string; battery_pct: number | null;
    last_seen_at: Date | null; anomalies: string;
  }>(
    `select d.id, d.imei, d.type::text as type, d.battery_pct, d.last_seen_at,
            (select count(*) from device_anomalies an where an.imei = d.imei) as anomalies
       from devices d
       left join animals a on a.id = d.animal_id
      where d.animal_id is null or a.owner_id = $1::uuid
      order by d.last_seen_at desc nulls last`, [asUuid(ownerId)]);
  return rows.map((r) => ({
    id: r.id, imei: r.imei, imeiMasked: maskImei(r.imei), type: r.type,
    batteryPct: r.battery_pct,
    lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
    anomalies: Number(r.anomalies),
  }));
}

/* ----------------------------------------------------------------- farms */

export type Farm = {
  id: string; name: string; ward: string | null; district: string | null;
  role: string; animals: number; areas: number; members: number;
};

/**
 * The farms a person belongs to, with their role on each.
 *
 * Somebody can manage two farms and a vet may attend several, so this is
 * membership rather than a column on the person. An empty list is the normal
 * state for a newly invited farmer — he has not described his place yet, and the
 * interface asks him to before anything else.
 */
export async function getFarmsFor(personId: string): Promise<Farm[]> {
  return query<Farm>(
    `select f.id, f.name, w.name as ward, f.district, m.role::text as role,
            (select count(*) from animals a where a.farm_id = f.id)::int as animals,
            (select count(*) from land_parcels p where p.farm_id = f.id)::int as areas,
            (select count(*) from farm_members fm where fm.farm_id = f.id)::int as members
       from farm_members m
       join farms f on f.id = m.farm_id
       left join wards w on w.id = f.ward_id
      where m.person_id = $1::uuid
      order by f.name`, [asUuid(personId)]);
}

/** Creating a farm makes you its owner in the same transaction. */
export async function createFarm(opts: {
  name: string; personId: string; district?: string | null; wardName?: string | null;
}) {
  const rows = await query<{ id: string }>(
    `insert into farms (name, district, ward_id, created_by)
     values ($1, $2, (select id from wards where name = $3), $4::uuid)
     returning id`,
    [opts.name.trim(), opts.district ?? null, opts.wardName ?? null, asUuid(opts.personId)]);
  const farm = rows[0];
  await query(
    `insert into farm_members (farm_id, person_id, role) values ($1::uuid, $2::uuid, 'owner')`,
    [asUuid(farm.id), asUuid(opts.personId)]);
  return farm;
}

/** Is this person a member of this farm, and in what role? */
export async function farmRoleOf(personId: string, farmId: string): Promise<string | null> {
  const [row] = await query<{ role: string }>(
    `select role::text as role from farm_members
      where person_id = $1::uuid and farm_id = $2::uuid`,
    [asUuid(personId), asUuid(farmId)]);
  return row?.role ?? null;
}

export type FarmMember = {
  personId: string; name: string; email: string | null; role: string; phone: string;
};

export async function getFarmMembers(farmId: string): Promise<FarmMember[]> {
  return query<FarmMember>(
    `select o.id as "personId", o.full_name as name, o.email, o.phone,
            m.role::text as role
       from farm_members m join owners o on o.id = m.person_id
      where m.farm_id = $1::uuid
      order by case m.role::text when 'owner' then 0 when 'manager' then 1 else 2 end,
               o.full_name`, [asUuid(farmId)]);
}

/** Add somebody to a farm. The person record is created if the email is new. */
export async function addFarmMember(opts: {
  farmId: string; fullName: string; email: string; role: string; phone: string;
}) {
  const existing = await query<{ id: string }>(
    `select id from owners where lower(email) = lower($1)`, [opts.email.trim()]);

  const personId = existing[0]?.id ?? (await query<{ id: string }>(
    `insert into owners (full_name, national_id, phone, email)
     values ($1, $2, $3, $4) returning id`,
    // A person appointed to a farm has no national ID on record yet; the farm
    // knows who they are, the municipal register does not until it is given one.
    [opts.fullName.trim(), `PENDING-${Date.now().toString(36).toUpperCase()}`,
     opts.phone.trim() || '—', opts.email.trim()],
  ))[0].id;

  await query(
    `insert into farm_members (farm_id, person_id, role)
     values ($1::uuid, $2::uuid, $3::farm_role)
     on conflict (farm_id, person_id) do update set role = excluded.role`,
    [asUuid(opts.farmId), asUuid(personId), opts.role]);

  return { personId };
}

export async function removeFarmMember(farmId: string, personId: string) {
  await query(
    `delete from farm_members where farm_id = $1::uuid and person_id = $2::uuid
       and role <> 'owner'`,
    [asUuid(farmId), asUuid(personId)]);
}
