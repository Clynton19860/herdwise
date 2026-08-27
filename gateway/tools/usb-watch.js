#!/usr/bin/env node
/**
 * Watch the macOS USB bus and report devices appearing and disappearing.
 *
 * Purpose: tell apart the three reasons a tag shows nothing when you plug it in.
 *
 *   1. charge-only cable  — no data lines, so nothing can ever enumerate
 *   2. power-only port    — the cable is fine, the tag simply has no USB data
 *   3. driver missing     — it enumerates, but no /dev/tty.* appears
 *
 * Only (3) is fixable in software. (1) is fixable with a different cable.
 * (2) means configuration has to happen over SMS or from the vendor platform.
 *
 *   node tools/usb-watch.js
 *
 * Then: unplug and replug the tag. If nothing prints, try the SAME cable with a
 * phone or USB stick — if that prints, the cable is good and the tag's port is
 * power-only.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const run = promisify(execFile);

async function usbDevices() {
  const out = new Map();
  try {
    const { stdout } = await run('ioreg', ['-p', 'IOUSB', '-w0', '-l'], { maxBuffer: 8 << 20 });
    let current = null;
    for (const line of stdout.split('\n')) {
      const node = line.match(/\+-o (.+?)@([0-9a-f]+)\s/i);
      if (node) { current = { name: node[1], location: node[2] }; continue; }
      if (!current) continue;
      const vendor = line.match(/"USB Vendor Name" = "(.*)"/);
      const product = line.match(/"USB Product Name" = "(.*)"/);
      const idV = line.match(/"idVendor" = (\d+)/);
      const idP = line.match(/"idProduct" = (\d+)/);
      if (vendor) current.vendor = vendor[1];
      if (product) current.product = product[1];
      if (idV) current.idVendor = Number(idV[1]);
      if (idP) current.idProduct = Number(idP[1]);
      if (current.idVendor != null && current.idProduct != null) {
        const key = `${current.location}:${current.idVendor}:${current.idProduct}`;
        if (!out.has(key)) out.set(key, { ...current });
        current = null;
      }
    }
  } catch { /* ioreg unavailable */ }
  return out;
}

async function serialPorts() {
  try {
    const entries = await fs.readdir('/dev');
    return new Set(
      entries
        .filter((f) => (f.startsWith('tty.') || f.startsWith('cu.')))
        .filter((f) => !/debug|wlan|Bluetooth/i.test(f)),
    );
  } catch { return new Set(); }
}

/** USB-serial bridges these tags typically use, so we can name what we see. */
const KNOWN_BRIDGES = {
  6790: 'QinHeng CH340/CH9102 (needs a driver on macOS)',
  4292: 'Silicon Labs CP210x',
  1027: 'FTDI',
  1659: 'Prolific PL2303',
};

/** Apple's own hub + dock chain is infrastructure, not a device under test. */
const APPLE_INFRA = new Set([4119, 4120, 5219]);
const isInfra = (d) => d.idVendor === 1452 && APPLE_INFRA.has(d.idProduct);

const fmt = (d) =>
  `${d.product ?? d.name} — ${d.vendor ?? 'unknown vendor'} ` +
  `[${d.idVendor}:${d.idProduct}]` +
  (KNOWN_BRIDGES[d.idVendor] ? `  ← ${KNOWN_BRIDGES[d.idVendor]}` : '');

let devices = await usbDevices();
let ports = await serialPorts();

console.log('watching USB — plug and unplug the tag. Ctrl-C to stop.\n');
console.log(`baseline: ${devices.size} USB device(s), ${ports.size} serial port(s)`);
for (const d of devices.values()) console.log(`   • ${fmt(d)}`);
if (!devices.size) console.log('   (nothing attached)');
console.log('');

setInterval(async () => {
  const now = await usbDevices();
  const nowPorts = await serialPorts();
  const t = new Date().toLocaleTimeString();

  let infraChurn = 0;
  for (const [k, d] of now) {
    if (devices.has(k)) continue;
    if (isInfra(d)) { infraChurn++; continue; }
    console.log(`${t}  +++ NEW DEVICE  ${fmt(d)}`);
  }
  for (const [k, d] of devices) {
    if (now.has(k)) continue;
    if (isInfra(d)) { infraChurn++; continue; }
    console.log(`${t}  --- REMOVED     ${fmt(d)}`);
  }
  if (infraChurn) {
    console.log(`${t}  (dock/hub re-enumerated — that is the adapter being replugged, not a device)`);
  }
  for (const p of nowPorts) {
    if (!ports.has(p)) console.log(`${t}  + SERIAL /dev/${p}   <-- this is the one you want`);
  }
  for (const p of ports) {
    if (!nowPorts.has(p)) console.log(`${t}  - SERIAL /dev/${p}`);
  }

  devices = now;
  ports = nowPorts;
}, 700);
