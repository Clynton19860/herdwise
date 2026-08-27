import "server-only";
import { Pool } from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-ca";
import { toCanvas, polygonToCanvas } from "./geo";
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

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new DatabaseNotConfigured();
  globalForPg.herdwisePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase's pooler presents a certificate from its own private CA, which
    // is in no system trust store. Pin it rather than disabling verification —
    // this connection carries every animal position over the public internet.
    // The CA is embedded (see lib/supabase-ca.ts) because serverless bundles do
    // not reliably ship files read at runtime.
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
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

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool().query(sql, params);
  return rows as T[];
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

function monthsSince(date: string | Date | null): number {
  if (!date) return 0;
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
};

const OWNER_SQL = `
  select o.id, o.full_name, o.national_id, o.phone,
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
  ward: r.ward ?? "—",
  herdSize: Number(r.herd_size),
  registeredOn: iso(r.created_at),
});

export async function getOwners(): Promise<Owner[]> {
  return (await query<OwnerRow>(`${OWNER_SQL} order by o.full_name`)).map(toOwner);
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

const ANIMAL_SQL = `
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
    weightKg: r.weight_kg ? Number(r.weight_kg) : 0,
    color: r.colour ?? "—",
    status: title(r.status) as AnimalStatus,
    ownerId: r.owner_id,
    device: {
      type: DEVICE_LABEL[r.device_type ?? "other"] ?? "Ear Tag",
      serial: r.imei ?? "unpaired",
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

export async function getAnimals(): Promise<Animal[]> {
  return (await query<AnimalRow>(`${ANIMAL_SQL} order by a.tag`)).map(toAnimal);
}

export async function getAnimal(id: string): Promise<Animal | null> {
  // Accepts either the database id or the printed ear-tag number.
  const rows = await query<AnimalRow>(
    `${ANIMAL_SQL} where a.id = $1::uuid or a.tag = $2`, [asUuid(id), id]);
  return rows[0] ? toAnimal(rows[0]) : null;
}

export async function getAnimalsByOwner(ownerId: string): Promise<Animal[]> {
  return (await query<AnimalRow>(
    `${ANIMAL_SQL} where a.owner_id = $1::uuid order by a.tag`, [asUuid(ownerId)])).map(toAnimal);
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
    hectares: Math.round(Number(r.area_ha)),
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

export async function getIncidents(): Promise<Incident[]> {
  return (await query<IncidentRow>(`${INCIDENT_SQL} order by i.reported_at desc`)).map(toIncident);
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

/** Seven-day counts, zero-filled so charts always get seven points. */
export async function getTrendSeries() {
  const rows = await query<{ d: string; fixes: string; incidents: string; registrations: string }>(`
    with days as (
      select generate_series(current_date - interval '6 days', current_date, interval '1 day')::date as d
    )
    select days.d::text as d,
      (select count(*) from fixes f where f.recorded_at::date = days.d) as fixes,
      (select count(*) from incidents i where i.reported_at::date = days.d) as incidents,
      (select count(*) from animals a where a.registered_on = days.d) as registrations
      from days order by days.d`);
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
    (select observed_at, 'Device anomaly: ' || kind || ' (' || coalesce(imei, 'unknown') || ')', 'violet'
       from device_anomalies order by observed_at desc limit 3)
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
  imei: string | null; battery_pct: number | null;
  last_fix_at: string | null; last_fix_type: string | null;
  lat: number | null; lng: number | null;
  parcel_id: string | null; parcel_name: string | null;
  containment_state: string | null; distance_m: number | null;
};

export type MapParcel = {
  id: string; reference: string; name: string; tenure: string;
  area_ha: string; tolerance_m: number; breach_dwell_s: number;
  ward: string | null; owner_name: string | null;
  /** PostGIS ST_AsGeoJSON output — a Polygon, ready for MapLibre. */
  geojson: GeoJSON.Polygon;
  animal_count: string;
};

/** Everything the live map draws, in real coordinates — no canvas projection. */
export async function getMapAnimals(): Promise<MapAnimal[]> {
  return query<MapAnimal>(
    `select * from map_animals where lat is not null order by tag`);
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
