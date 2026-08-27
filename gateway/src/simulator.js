/**
 * A fake HCS048 tag.
 *
 * The point of this file is that it removes hardware from the critical path.
 * It speaks the vendor protocol back at us — boot INFO, heartbeats, position
 * packets, ACK handling, command replies — so the gateway, the schema and the
 * containment engine can all be built and tested before a SIM ever arrives.
 *
 *   node src/simulator.js --imei 864239068739969 --interval 5 --stray
 *
 * Walks a herd around Hatcliffe in Harare. With --stray, one animal drifts out
 * of its allocation so boundary logic has something real to fire on.
 */
import net from 'node:net';
import { deframe, frame, decodePacket, COMMANDS } from './protocol.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);

/** Where the herd grazes. Override with --lat/--lng to sit inside a seeded parcel. */
const HOME = {
  lat: Number(arg('lat', -17.7180)),
  lng: Number(arg('lng', 31.0790)),
};

const rnd = (n) => (Math.random() - 0.5) * n;

class SimulatedTag {
  constructor({ imei, host, port, intervalSec, stray }) {
    Object.assign(this, { imei, host, port, intervalSec, stray });
    this.seq = Math.floor(Math.random() * 0x8000);
    this.heartbeats = 0;
    this.battery = 60 + Math.floor(Math.random() * 40);
    this.lat = HOME.lat + rnd(0.004);
    this.lng = HOME.lng + rnd(0.004);
    this.heading = Math.floor(Math.random() * 360);
    this.buffer = Buffer.alloc(0);
    this.upInterval = intervalSec;
  }

  #seqHex() {
    this.seq = (this.seq + 1) & 0xffff;
    return this.seq.toString(16).padStart(4, '0');
  }

  #send(content) {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write(frame({ imei: this.imei, seq: this.#seqHex(), content }));
  }

  #reply(seq, content) {
    this.socket.write(frame({ imei: this.imei, seq, content }));
  }

  connect() {
    this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
      console.log(`[${this.imei}] connected to ${this.host}:${this.port}`);
      // Boot report, exactly as the vendor documents it.
      this.#send(
        `INFO,ITEM:HCS048;VER:SIM100;PLMN:64801;IMEI:${this.imei};` +
        `IMSI:648010000000000;ICCID:8926480000000000000;OWNER:;APN:,,;DEV:00000005`,
      );
      this.#heartbeat();
      this.timers = [
        setInterval(() => this.#heartbeat(), 5 * 60 * 1000),
        setInterval(() => this.#position(), this.upInterval * 1000),
      ];
      setTimeout(() => this.#position(), 800);
    });

    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      const { frames, rest } = deframe(this.buffer);
      this.buffer = rest;
      for (const f of frames) this.#onPacket(decodePacket(f));
    });

    this.socket.on('error', (e) => console.log(`[${this.imei}] socket error: ${e.message}`));
    this.socket.on('close', () => {
      console.log(`[${this.imei}] disconnected — retrying in 5s`);
      for (const t of this.timers ?? []) clearInterval(t);
      setTimeout(() => this.connect(), 5000);
    });
  }

  #onPacket(p) {
    if (p.type === 'ack') {
      if (p.args[0]) console.log(`[${this.imei}] time synced from server: ${p.args[0]}`);
      return;
    }
    if (p.type !== 'command') return;

    console.log(`[${this.imei}] <- command ${p.command} ${p.args.join(',')}`);
    switch (p.command) {
      case 'JUST':
        this.#reply(p.seq, 'RET,JUST,1');
        setTimeout(() => this.#position(), 200);
        break;
      case 'UP': {
        const secs = Number(p.args[0]);
        this.upInterval = secs;
        clearInterval(this.timers[1]);
        this.timers[1] = setInterval(() => this.#position(), secs * 1000);
        this.#reply(p.seq, 'RET,UP,1');
        break;
      }
      case 'REBOOT':
      case 'POWERDN':
        // The vendor warns the server may never get a response. Model that.
        console.log(`[${this.imei}] ${p.command} — going away without replying`);
        this.socket.destroy();
        break;
      default:
        this.#reply(p.seq, `RET,${p.command},1`);
    }
  }

  #heartbeat() {
    this.heartbeats = (this.heartbeats + 1) & 0xffff;
    this.#send(
      `SYNC:${this.heartbeats.toString(16).padStart(4, '0')};` +
      `STATUS:${this.battery},${85 + Math.floor(Math.random() * 15)}`,
    );
  }

  #position() {
    // Grazing pace with occasional purposeful movement.
    const grazing = Math.random() > 0.25;
    const speed = grazing ? Math.random() * 2 : 3 + Math.random() * 6;
    this.heading = (this.heading + rnd(70) + 360) % 360;

    const metres = (speed * 1000 / 3600) * this.upInterval;
    const rad = (this.heading * Math.PI) / 180;
    this.lat += (metres * Math.cos(rad)) / 111_320;
    this.lng += (metres * Math.sin(rad)) / (111_320 * Math.cos((this.lat * Math.PI) / 180));

    if (this.stray) {
      // Deliberate drift east, out of the allocation, to exercise containment.
      this.lng += 0.00035;
    } else {
      // Otherwise gently tethered to the home range.
      this.lat += (HOME.lat - this.lat) * 0.05;
      this.lng += (HOME.lng - this.lng) * 0.05;
    }

    if (Math.random() < 0.02) this.battery = Math.max(1, this.battery - 1);

    // Mixed fix quality, like the real thing: mostly GPS, sometimes a coarse
    // cell-tower fix that containment logic must refuse to act on.
    const roll = Math.random();
    const fix = roll < 0.8 ? 'G' : roll < 0.92 ? 'W' : 'L';
    const jitter = fix === 'G' ? 0.00008 : fix === 'W' ? 0.0004 : 0.008;
    const lat = this.lat + rnd(jitter);
    const lng = this.lng + rnd(jitter);

    const t = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp =
      p(t.getUTCFullYear() % 100) + p(t.getUTCMonth() + 1) + p(t.getUTCDate()) +
      p(t.getUTCHours()) + p(t.getUTCMinutes()) + p(t.getUTCSeconds());

    const alert = this.battery < 20 ? '0001' : '0000';
    this.#send(
      `LOCA:${fix};CELL:1,264,1,279b,33de38f,35;` +
      `GDATA:A,${6 + Math.floor(Math.random() * 6)},${stamp},${lat.toFixed(6)},${lng.toFixed(6)},` +
      `${speed.toFixed(1)},${Math.round(this.heading)},${1480 + Math.round(rnd(30))};` +
      `ALERT:${alert};STATUS:${this.battery},${85 + Math.floor(Math.random() * 15)}`,
    );
  }
}

const host = arg('host', '127.0.0.1');
const port = Number(arg('port', process.env.GATEWAY_PORT ?? 5100));
const intervalSec = Number(arg('interval', 10));
const count = Number(arg('count', 1));
const baseImei = arg('imei', '864239068739000');

console.log(`simulating ${count} tag(s) -> ${host}:${port}, reporting every ${intervalSec}s\n`);
for (let i = 0; i < count; i++) {
  const imei = String(BigInt(baseImei) + BigInt(i));
  const tag = new SimulatedTag({
    imei, host, port, intervalSec,
    stray: flag('stray') && i === 0,
  });
  setTimeout(() => tag.connect(), i * 300);
}

export { SimulatedTag, COMMANDS };
