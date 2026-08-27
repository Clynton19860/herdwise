/**
 * Generates supabase/seed.sql from the prototype dataset in lib/data.ts.
 *
 * The prototype stores positions as x/y in a 0–100 canvas. Those are projected
 * to real lat/lng with exactly the bounds lib/geo.ts already uses, so the seeded
 * demo looks like the mockup while every coordinate is genuine.
 *
 *   node supabase/generate-seed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'lib/data.ts'), 'utf8');

const B = { north: -17.65, south: -17.95, west: 30.95, east: 31.25 };
const toLL = (x, y) => [
  B.north - (y / 100) * (B.north - B.south),
  B.west + (x / 100) * (B.east - B.west),
];

const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || Number.isNaN(v) ? 'null' : String(v));
const uid = (prefix, suffix) => `'00000000-0000-4000-8000-${prefix}${String(suffix).padStart(6, '0')}'`;
const point = (x, y) => {
  const [lat, lng] = toLL(x, y);
  return `st_setsrid(st_makepoint(${lng.toFixed(6)}, ${lat.toFixed(6)}), 4326)::geography`;
};

/* ------------------------------------------------------------------ parse */

const owners = [...src.matchAll(
  /\{ id: "(o-\d+)", fullName: "([^"]+)", nationalId: "([^"]+)", phone: "([^"]+)", ward: "([^"]+)", herdSize: (\d+), registeredOn: "([^"]+)"/g,
)].map((m) => ({ id: m[1], name: m[2], nid: m[3], phone: m[4], ward: m[5], registered: m[7] }));

const animals = [...src.matchAll(
  /\{ id: "(a-\d+)", tag: "([^"]+)", name: "([^"]+)", species: "(\w+)", breed: "([^"]+)", sex: "(\w+)", ageMonths: (\d+), weightKg: (\d+), color: "([^"]+)", status: "(\w+)", ownerId: "(o-\d+)",\s*\n\s*device: \{ type: "([^"]+)", serial: "([^"]+)", battery: (\d+), signal: (\d+), lastSyncMin: (\d+) \},\s*\n\s*location: \{ x: ([\d.]+), y: ([\d.]+), zone: "([^"]+)", speedKph: ([\d.]+), heading: (\d+) \},\s*\n\s*health: \{ lastVaccination: "([^"]+)", nextVaccination: "([^"]+)", heartRateBpm: (\d+), temperatureC: ([\d.]+) \},\s*\n\s*registeredOn: "([^"]+)"/g,
)].map((m) => ({
  id: m[1], tag: m[2], name: m[3], species: m[4].toLowerCase(), breed: m[5],
  sex: m[6].toLowerCase(), ageMonths: +m[7], weightKg: +m[8], colour: m[9],
  status: m[10].toLowerCase(), owner: m[11],
  deviceType: m[12], battery: +m[14], signal: +m[15], lastSyncMin: +m[16],
  x: +m[17], y: +m[18], zone: m[19], speed: +m[20], heading: +m[21],
  lastVax: m[22], nextVax: m[23], registered: m[26],
}));

const zones = [...src.matchAll(
  /\{ id: "(g-\d+)", name: "([^"]+)", type: "(\w+)", ward: "([^"]+)", hectares: (\d+), capacity: (\d+), occupancy: (\d+),\s*\n\s*polygon: (\[[^\n]*\])/g,
)].map((m) => ({
  id: m[1], name: m[2], type: m[3].toLowerCase(), ward: m[4],
  hectares: +m[5], capacity: +m[6],
  poly: JSON.parse(m[8].replace(/\s*\}\s*,?\s*$/, '')),
}));

const incidents = [...src.matchAll(
  /\{ id: "(i-\d+)", ref: "([^"]+)", type: "([^"]+)", severity: "(\w+)", status: "([^"]+)",\s*\n\s*animalId: "(a-\d+)", ownerId: "(o-\d+)", reportedAt: "([^"]+)",\s*\n\s*location: \{ x: ([\d.]+), y: ([\d.]+), label: "([^"]+)" \}, officer: "([^"]+)",\s*\n\s*notes: "([^"]+)"/g,
)].map((m) => ({
  id: m[1], ref: m[2], type: m[3].toLowerCase().replace(/ /g, '_'),
  severity: m[4].toLowerCase(), status: m[5].toLowerCase().replace(/ /g, '_'),
  animal: m[6], owner: m[7], reportedAt: m[8],
  x: +m[9], y: +m[10], label: m[11], officer: m[12], notes: m[13],
}));

for (const [label, arr, expected] of [['owners', owners, 6], ['animals', animals, 12], ['zones', zones, 7], ['incidents', incidents, 6]]) {
  if (arr.length !== expected) {
    console.error(`✗ parsed ${arr.length} ${label}, expected ${expected} — lib/data.ts shape changed`);
    process.exit(1);
  }
}
console.log(`parsed ${owners.length} owners, ${animals.length} animals, ${zones.length} zones, ${incidents.length} incidents`);

/* ------------------------------------------------------------------ emit */

/** Geodesic-ish area in hectares: project to local metres, then shoelace. */
function areaHa(ring) {
  const lat0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lng0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const mx = (lng) => (lng - lng0) * 111320 * Math.cos((lat0 * Math.PI) / 180);
  const my = (lat) => (lat - lat0) * 110540;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [la1, ln1] = ring[i];
    const [la2, ln2] = ring[(i + 1) % ring.length];
    a += mx(ln1) * my(la2) - mx(ln2) * my(la1);
  }
  return Math.abs(a) / 2 / 10000;
}

/**
 * Scale a ring about its centroid until it covers `targetHa`.
 *
 * The prototype's polygons are decorative shapes in a 0-100 canvas, and
 * projecting them across the whole 30 km Harare bounding box inflates them
 * about thirtyfold — Hatcliffe came out at 4,711 ha, 6.5 km across, which is
 * not a livestock paddock. The prototype did declare sensible hectares next to
 * each shape, so honour those: keep the layout, fix the scale.
 */
function scaleToHectares(ring, targetHa) {
  const current = areaHa(ring);
  if (!current || !targetHa) return ring;
  const f = Math.sqrt(targetHa / current);
  const lat0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lng0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([la, ln]) => [lat0 + (la - lat0) * f, lng0 + (ln - lng0) * f]);
}

const wkt = (poly, targetHa) => {
  let ring = poly.map(([x, y]) => toLL(x, y));           // [lat, lng]
  ring = scaleToHectares(ring, targetHa);
  const pts = ring.map(([la, ln]) => `${ln.toFixed(6)} ${la.toFixed(6)}`);
  pts.push(pts[0]);
  return `POLYGON((${pts.join(', ')}))`;
};
const ownerUid = (id) => uid('000000', id.slice(2));
const parcelUid = (id) => uid('100000', id.slice(2));
const animalUid = (id) => uid('200000', id.slice(2));

const L = [
  '-- GENERATED by supabase/generate-seed.mjs — do not edit by hand.',
  '--',
  '-- The prototype dataset projected onto real Harare coordinates using the same',
  '-- bounds lib/geo.ts uses, so the demo looks like the mockup while every',
  '-- position is genuine lat/lng.',
  '--',
  '-- Note: the parcel polygons are the prototype\'s decorative shapes stretched',
  '-- across the whole 30 km bounding box, which makes them 1,500-4,700 ha. Real',
  '-- allocations must come from the City\'s own cadastral data.',
  '',
  'begin;',
  '',
];

// The prototype's dates are fixed literals that have since gone stale, which
// makes every vaccination read as overdue and every incident as months old.
// Anchor the demo to the day it is seeded instead.
const today = new Date();
const shift = (days) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const wards = [...new Set(owners.map((o) => o.ward))];
L.push('insert into wards (code, name) values');
L.push(wards.map((w, i) => `  (${q(`W${String(i + 1).padStart(2, '0')}`)}, ${q(w)})`).join(',\n') + ';', '');

for (const o of owners) {
  L.push(`insert into owners (id, full_name, national_id, phone, ward_id, created_at) values (${ownerUid(o.id)}, ${q(o.name)}, ${q(o.nid)}, ${q(o.phone)}, (select id from wards where name = ${q(o.ward)}), ${q(o.registered)});`);
}
L.push('');

for (const z of zones) {
  if (z.type === 'grazing') {
    L.push(`insert into land_parcels (id, reference, name, tenure, ward_id, geom) values (${parcelUid(z.id)}, ${q(`HRE-P-${z.id.slice(2)}`)}, ${q(z.name)}, 'communal', (select id from wards where name like ${q(`${z.ward}%`)} limit 1), st_geogfromtext(${q(wkt(z.poly, z.hectares))}));`);
  }
  L.push(`insert into geofences (name, type, ward_id, geom, capacity) values (${q(z.name)}, ${q(z.type)}, (select id from wards where name like ${q(`${z.ward}%`)} limit 1), st_geogfromtext(${q(wkt(z.poly, z.hectares))}), ${n(z.capacity || null)});`);
}
L.push('');

animals.forEach((a, i) => {
  const home = zones.find((z) => z.name === a.zone && z.type === 'grazing');
  const birth = new Date(Date.UTC(2026, 7, 27));
  birth.setUTCMonth(birth.getUTCMonth() - a.ageMonths);
  const imei = String(864239068739001 + i);

  L.push(`insert into animals (id, tag, name, species, breed, sex, birth_date, weight_kg, colour, status, owner_id, home_parcel_id, registered_on) values (${animalUid(a.id)}, ${q(a.tag)}, ${q(a.name)}, ${q(a.species)}, ${q(a.breed)}, ${q(a.sex)}, ${q(birth.toISOString().slice(0, 10))}, ${n(a.weightKg)}, ${q(a.colour)}, ${q(a.status)}, ${ownerUid(a.owner)}, ${home ? parcelUid(home.id) : 'null'}, ${q(a.registered)});`);

  // Device carries its last known position so the maps have something to draw
  // before any telemetry arrives.
  L.push(`insert into devices (imei, type, animal_id, battery_pct, signal_pct, last_seen_at, last_fix_at, last_fix_type, last_position, reporting_interval_s) values (${q(imei)}, 'hcs048', ${animalUid(a.id)}, ${n(a.battery)}, ${n(a.signal)}, now() - interval '${a.lastSyncMin} minutes', now() - interval '${a.lastSyncMin} minutes', 'gps', ${point(a.x, a.y)}, 600);`);

  // One historical fix per animal, so tracks and "last seen" are not empty.
  L.push(`insert into fixes (device_id, animal_id, recorded_at, fix, geom, speed_kph, heading_deg, satellites, battery_pct, signal_pct) select d.id, ${animalUid(a.id)}, now() - interval '${a.lastSyncMin} minutes', 'gps', ${point(a.x, a.y)}, ${n(a.speed)}, ${n(a.heading)}, 9, ${n(a.battery)}, ${n(a.signal)} from devices d where d.imei = ${q(imei)};`);

  // Spread the herd across compliant / due soon / overdue so the health screen
  // has something real to sort by.
  const cycle = [-150, -120, -95, -70, -40, -20, -190, -175, -60, -35, -200, -80][i % 12];
  L.push(`insert into health_records (animal_id, type, occurred_on, next_due_on, description, veterinarian) values (${animalUid(a.id)}, 'vaccination', ${q(shift(cycle))}, ${q(shift(cycle + 180))}, 'Foot-and-mouth booster', 'Dr. R. Chivasa');`);
});
L.push('');

incidents.forEach((i, idx) => {
  // Keep the original ordering but land them inside the last few days.
  const hoursAgo = [3, 9, 26, 50, 74, 120][idx] ?? idx * 12;
  const resolved = i.status === 'resolved' ? `now() - interval '${Math.max(1, hoursAgo - 2)} hours'` : 'null';
  L.push(`insert into incidents (ref, type, severity, status, animal_id, owner_id, geom, location_label, officer, notes, reported_at, resolved_at) values (${q(i.ref)}, ${q(i.type)}, ${q(i.severity)}, ${q(i.status)}, ${animalUid(i.animal)}, ${ownerUid(i.owner)}, ${point(i.x, i.y)}, ${q(i.label)}, ${q(i.officer)}, ${q(i.notes)}, now() - interval '${hoursAgo} hours', ${resolved});`);
});

L.push('');
for (const [i, [name, role]] of [
  ['Insp. T. Moyo', 'officer'], ['Sgt. P. Ncube', 'officer'],
  ['Dr. R. Chivasa', 'vet'], ['System Administrator', 'admin'],
].entries()) {
  L.push(`insert into staff (auth_user_id, full_name, role, ward_id) values (${uid('300000', i + 1)}, ${q(name)}, ${q(role)}, (select id from wards order by id limit 1));`);
}

L.push('', "select setval('incident_ref_seq', 1000);", '', 'commit;');

fs.writeFileSync(path.join(ROOT, 'supabase/seed.sql'), L.join('\n') + '\n');
console.log(`wrote supabase/seed.sql (${L.length} statements)`);
