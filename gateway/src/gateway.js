/**
 * HCS048 telemetry gateway.
 *
 * A plain TCP listener — this is the component that cannot live on Vercel.
 * The device dials in, holds one socket open, and we both push commands down it
 * and read positions up it.
 *
 * Storage is deliberately behind a `sink` interface so the protocol layer can be
 * proven before Supabase exists. Swap `consoleSink` for a Postgres sink and
 * nothing in this file changes.
 */
import net from 'node:net';
import { EventEmitter } from 'node:events';
import {
  deframe, frame, decodePacket, ackFor, NO_REPLY_COMMANDS,
} from './protocol.js';

const DEFAULT_PORT = Number(process.env.GATEWAY_PORT ?? 5100);

/** Sockets go quiet on a dead network without ever erroring. Reap them. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // heartbeat is every 5 min

/**
 * Dump every inbound byte. Without this, a device that connects and sends
 * something we cannot frame is indistinguishable from one that sends nothing at
 * all — the bytes just sit in the reassembly buffer and no log line is ever
 * written. Set GATEWAY_DEBUG_RAW=1 when commissioning new hardware.
 */
const DEBUG_RAW = process.env.GATEWAY_DEBUG_RAW === '1';

const preview = (buf) => {
  const ascii = buf.toString('latin1').replace(/[^\x20-\x7e]/g, (c) =>
    '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
  return `${buf.length}B  ascii="${ascii}"  hex=${buf.toString('hex').slice(0, 120)}`;
};

export const consoleSink = {
  async savePosition(p) {
    const g = p.gps;
    const where = g?.positioned ? `${g.lat.toFixed(6)},${g.lng.toFixed(6)}` : 'no fix';
    console.log(
      `  ↑ position  ${p.imei}  ${String(p.fixType).padEnd(4)}  ${where}` +
      `  ${g?.speedKph ?? '–'}km/h  batt ${p.status?.batteryPct ?? '–'}%` +
      (p.alert?.flags.length ? `  ALERT ${p.alert.flags.join('+')}` : '') +
      (p.alert?.undocumented.length ? `  alert-bit?${p.alert.undocumented.join(',')}` : ''),
    );
  },
  async saveHeartbeat(p) {
    console.log(`  ↑ heartbeat ${p.imei}  #${p.count}  batt ${p.status?.batteryPct ?? '–'}%  sig ${p.status?.signalPct ?? '–'}`);
  },
  async saveInfo(p) {
    console.log(`  ↑ boot      ${p.imei}  ${p.model} ${p.firmware}  plmn ${p.plmn}  iccid ${p.iccid}`);
  },
  async saveCommandResult(p) {
    console.log(`  ↑ reply     ${p.imei}  ${p.command} -> ${p.result}`);
  },
  async saveAnomaly(imei, a) {
    console.warn(`  ! anomaly   ${imei ?? '?'}  ${JSON.stringify(a)}`);
  },
};

export class Gateway extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} [opts.sink]      storage adapter
   * @param {string} [opts.id]        vendor prefix expected/emitted
   * @param {boolean} [opts.assumeUtc] whether device time is UTC (see Q4)
   */
  constructor({ sink = consoleSink, id = 'S168', assumeUtc = true } = {}) {
    super();
    this.sink = sink;
    this.id = id;
    this.assumeUtc = assumeUtc;
    /** @type {Map<string, {socket: net.Socket, lastSeen: number, remote: string}>} */
    this.devices = new Map();
    this.pending = new Map(); // seq -> {resolve, reject, timer, command}
    this.seq = 0;
    this.server = net.createServer((s) => this.#onConnection(s));
  }

  listen(port = DEFAULT_PORT, host = '0.0.0.0') {
    return new Promise((res) => this.server.listen(port, host, () => {
      const a = this.server.address();
      console.log(`gateway listening on ${a.address}:${a.port}  (tags dial in here)`);
      res(a);
    }));
  }

  close() {
    for (const { socket } of this.devices.values()) socket.destroy();
    this.devices.clear();
    return new Promise((res) => this.server.close(res));
  }

  #nextSeq() {
    this.seq = (this.seq + 1) & 0xffff;
    return this.seq.toString(16).padStart(4, '0');
  }

  #onConnection(socket) {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`+ connect ${remote}`);
    socket.setNoDelay(true);
    socket.setTimeout(IDLE_TIMEOUT_MS);

    let buffer = Buffer.alloc(0);
    let imei = null;

    socket.on('data', async (chunk) => {
      if (DEBUG_RAW) console.log(`  << ${remote}  ${preview(chunk)}`);
      buffer = Buffer.concat([buffer, chunk]);
      const { frames, rest, anomalies } = deframe(buffer);
      buffer = rest;
      if (DEBUG_RAW && rest.length) {
        console.log(`  .. ${remote} holding ${rest.length}B incomplete: ${preview(rest)}`);
      }

      for (const a of anomalies) await this.sink.saveAnomaly(imei, a);

      for (const f of frames) {
        let packet;
        try {
          packet = decodePacket(f, { assumeUtc: this.assumeUtc });
          // The protocol authenticates nothing, so the source address is the
          // only corroborating signal we get. Carry it with every packet.
          packet.sourceIp = socket.remoteAddress?.replace(/^::ffff:/, '') ?? null;
        } catch (err) {
          await this.sink.saveAnomaly(imei, { type: 'decode_failed', error: String(err), raw: f.raw });
          continue; // one bad packet must never drop the socket
        }

        // First frame on a socket binds it to an IMEI — this is the registry
        // that makes downlink possible at all.
        if (!imei) {
          imei = packet.imei;
          const existing = this.devices.get(imei);
          if (existing && existing.socket !== socket) {
            // Same identity from two sockets. On a plaintext, IMEI-only
            // protocol this is either a reconnect or a spoof — surface it.
            await this.sink.saveAnomaly(imei, {
              type: 'duplicate_imei', existing: existing.remote, incoming: remote,
            });
            existing.socket.destroy();
          }
          this.devices.set(imei, { socket, lastSeen: Date.now(), remote });
          this.emit('device', { imei, remote });
        }

        const entry = this.devices.get(imei);
        if (entry) entry.lastSeen = Date.now();

        await this.#handle(packet, socket);
      }
    });

    const drop = (why) => {
      if (imei && this.devices.get(imei)?.socket === socket) this.devices.delete(imei);
      console.log(`- disconnect ${remote}${imei ? ` (${imei})` : ''} — ${why}`);
      this.emit('disconnect', { imei, remote, why });
      socket.destroy();
    };
    socket.on('timeout', () => drop('idle'));
    socket.on('error', (e) => drop(e.message));
    socket.on('close', () => drop('closed'));
  }

  async #handle(packet, socket) {
    switch (packet.type) {
      case 'position': await this.sink.savePosition(packet); break;
      case 'heartbeat': await this.sink.saveHeartbeat(packet); break;
      case 'info': await this.sink.saveInfo(packet); break;
      case 'ret': {
        await this.sink.saveCommandResult(packet);
        const waiter = this.pending.get(packet.seq);
        if (waiter) {
          clearTimeout(waiter.timer);
          this.pending.delete(packet.seq);
          waiter.resolve(packet);
        }
        break;
      }
      default:
        await this.sink.saveAnomaly(packet.imei, { type: 'unhandled', packetType: packet.type, raw: packet.raw });
    }

    this.emit('packet', packet);

    const ack = ackFor(packet, { id: this.id });
    if (ack && !socket.destroyed) socket.write(ack);
  }

  isOnline(imei) {
    return this.devices.has(imei);
  }

  /**
   * Send a command down the socket we already hold for this device.
   * Resolves with the device's RET, or rejects if it never answers.
   * REBOOT/POWERDN are fire-and-forget — the vendor warns their reply may never
   * arrive, so we must not queue them waiting for one.
   */
  send(imei, content, { timeoutMs = 30_000 } = {}) {
    const entry = this.devices.get(imei);
    if (!entry) return Promise.reject(new Error(`device ${imei} is not connected`));

    const seq = this.#nextSeq();
    const wire = frame({ id: this.id, imei, seq, content });
    entry.socket.write(wire);
    console.log(`  ↓ command   ${imei}  ${content}`);

    const command = content.split(',')[0];
    if (NO_REPLY_COMMANDS.has(command)) return Promise.resolve({ type: 'sent', command, seq });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`no reply to ${command} from ${imei} within ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(seq, { resolve, reject, timer, command });
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gw = new Gateway();
  await gw.listen();
  console.log('waiting for tags — run `npm run simulator` in another terminal\n');
  process.on('SIGINT', async () => { await gw.close(); process.exit(0); });
}
