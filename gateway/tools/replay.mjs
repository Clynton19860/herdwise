#!/usr/bin/env node
/**
 * Replay a real recorded track through the gateway as if it came from a tag.
 *
 * We cannot yet redirect the HCS048 to our own server, so we cannot see its
 * traffic directly. But we can still prove our stack against *real* movement:
 * walk a route with the tag, record the same walk on a phone as GPX, then play
 * those coordinates in as the tag's IMEI. Everything downstream — framing, the
 * codec, PostGIS, the containment engine, the dashboard — runs on genuine
 * positions instead of synthetic ones.
 *
 *   node tools/replay.mjs --file walk.gpx --imei 864239068739001
 *   node tools/replay.mjs --file track.csv --imei 8642... --speed 20 --host 1.2.3.4
 *
 * GPX: any <trkpt lat="" lon=""> with optional <time>. Most phone apps export it.
 * CSV/TSV: comma, tab or semicolon separated. Defaults to lat,lng,time but any
 *   column layout works via --lat-col/--lng-col/--time-col (0-indexed), so a
 *   table copied straight out of a tracker platform can be pasted into a file
 *   and replayed without reshaping it by hand.
 */
import net from 'node:net';
import fs from 'node:fs';
import { deframe, frame, decodePacket } from '../src/protocol.js';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? d : process.argv[i + 1];
};

const file = arg('file');
const imei = arg('imei');
const host = arg('host', '127.0.0.1');
const port = Number(arg('port', 5100));
/** Wall-clock compression: 20 means a 20-minute walk replays in one minute. */
const speedup = Number(arg('speed', 60));
const fixType = arg('fix', 'G');

if (!file || !imei) {
  console.error('usage: node tools/replay.mjs --file <gpx|csv> --imei <15 digits> [--host h] [--port p] [--speed 60]');
  process.exit(1);
}

/* ------------------------------------------------------------------ parse */

function parseGpx(text) {
  const pts = [];
  // Deliberately not a full XML parse: GPX track points are flat and regular,
  // and pulling in a parser for three attributes is not worth it.
  const re = /<trkpt[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>|<trkpt[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*\/>/g;
  let m;
  while ((m = re.exec(text))) {
    const lat = Number(m[1] ?? m[4]);
    const lng = Number(m[2] ?? m[5]);
    const inner = m[3] ?? '';
    const t = inner.match(/<time>([^<]+)<\/time>/);
    const ele = inner.match(/<ele>([-\d.]+)<\/ele>/);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      pts.push({ lat, lng, at: t ? new Date(t[1]) : null, alt: ele ? Number(ele[1]) : null });
    }
  }
  return pts;
}

function parseCsv(text) {
  const latCol = Number(arg('lat-col', 0));
  const lngCol = Number(arg('lng-col', 1));
  const timeCol = Number(arg('time-col', 2));
  const fixCol = Number(arg('fix-col', -1));

  const rows = text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    // Split on tab, comma or semicolon — whichever the source used.
    .map((l) => l.split(/\t|,|;/).map((c) => c.trim()))
    .filter((c) => Number.isFinite(Number(c[latCol])) && Number.isFinite(Number(c[lngCol])));

  const pts = rows.map((c) => {
    // Platform exports use "2026/08/27 23:57"; normalise to something Date parses.
    const rawAt = c[timeCol]?.replace(/\//g, '-').replace(' ', 'T');
    const at = rawAt ? new Date(rawAt) : null;
    return {
      lat: Number(c[latCol]),
      lng: Number(c[lngCol]),
      at: at && !Number.isNaN(at.getTime()) ? at : null,
      alt: null,
      // Keep the real positioning method when the export carries it — replaying
      // everything as GPS would hide exactly the WiFi drift we want to measure.
      fix: fixCol >= 0 ? ({ GPS: 'G', WIFI: 'W', LBS: 'L' }[(c[fixCol] || '').toUpperCase()] ?? null) : null,
    };
  });

  // A latitude outside ±90 almost always means the columns are the other way
  // round — a very common shape for pasted tables.
  if (pts.some((p) => Math.abs(p.lat) > 90)) {
    console.error(`\n  lat column ${latCol} holds values outside ±90 — are lat/lng swapped?`);
    console.error(`  try: --lat-col ${lngCol} --lng-col ${latCol}\n`);
    process.exit(1);
  }
  return pts;
}

const raw = fs.readFileSync(file, 'utf8');
const points = file.toLowerCase().endsWith('.gpx') ? parseGpx(raw) : parseCsv(raw);

if (!points.length) {
  console.error(`no track points found in ${file}`);
  process.exit(1);
}

/* ---------------------------------------------------------------- helpers */

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
function metresBetween(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const stamp = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getUTCFullYear() % 100) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
         p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
};

const first = points[0], last = points[points.length - 1];
let distance = 0;
for (let i = 1; i < points.length; i++) distance += metresBetween(points[i - 1], points[i]);
const durationS = first.at && last.at ? (last.at - first.at) / 1000 : points.length * 10;

console.log(`replaying ${points.length} points from ${file}`);
console.log(`  start     ${first.lat.toFixed(6)}, ${first.lng.toFixed(6)}`);
console.log(`  distance  ${(distance / 1000).toFixed(2)} km over ${(durationS / 60).toFixed(1)} min`);
console.log(`  as IMEI   ${imei} -> ${host}:${port}  (${speedup}x)\n`);

/* ------------------------------------------------------------------- send */

let seq = Math.floor(Math.random() * 0x8000);
const nextSeq = () => { seq = (seq + 1) & 0xffff; return seq.toString(16).padStart(4, '0'); };

const socket = net.createConnection({ host, port }, async () => {
  console.log('connected\n');
  socket.write(frame({ imei, seq: nextSeq(), content:
    `INFO,ITEM:HCS048;VER:REPLAY;PLMN:65501;IMEI:${imei};IMSI:;ICCID:;OWNER:;APN:,,;DEV:00000005` }));
  socket.write(frame({ imei, seq: nextSeq(), content: 'SYNC:0001;STATUS:88,95' }));

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const gap = prev?.at && p.at ? Math.max(1, (p.at - prev.at) / 1000) : 10;
    const speed = prev ? (metresBetween(prev, p) / gap) * 3.6 : 0;
    const head = prev ? bearing(prev, p) : 0;

    socket.write(frame({ imei, seq: nextSeq(), content:
      `LOCA:${p.fix ?? fixType};CELL:1,655,1,279b,33de38f,35;` +
      `GDATA:A,10,${stamp(p.at ?? new Date())},${p.lat.toFixed(6)},${p.lng.toFixed(6)},` +
      `${speed.toFixed(1)},${(p.fix ?? fixType) === 'G' ? Math.round(head) : 998},${Math.round(p.alt ?? 1680)};` +
      `ALERT:0000;STATUS:88,95` }));

    process.stdout.write(
      `\r  ${String(i + 1).padStart(4)}/${points.length}  ` +
      `${p.lat.toFixed(5)},${p.lng.toFixed(5)}  ${speed.toFixed(1)} km/h  ${p.fix ?? fixType}   `);

    await new Promise((r) => setTimeout(r, Math.min(5000, (gap / speedup) * 1000)));
  }

  console.log('\n\nreplay complete — check the gateway log and the fixes table');
  setTimeout(() => { socket.end(); process.exit(0); }, 1500);
});

let buf = Buffer.alloc(0);
socket.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  const { frames, rest } = deframe(buf);
  buf = rest;
  for (const f of frames) {
    const p = decodePacket(f);
    if (p.type === 'ack' && p.keyword === 'SYNC' && p.args[0]) {
      console.log(`server time sync: ${p.args[0]}`);
    }
  }
});
socket.on('error', (e) => { console.error(`\nsocket error: ${e.message}`); process.exit(1); });
