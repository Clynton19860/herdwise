/**
 * HCS048 wire protocol codec.
 *
 * Frame:  ID#IMEI#SEQ#LEN#CONTENT$
 *
 *   ID       vendor prefix, 4 chars (customisable, "S168" by default)
 *   IMEI     device identity — the ONLY identity claim on the wire
 *   SEQ      4 hex chars, wraps 0000–ffff
 *   LEN      4 hex chars, byte length of CONTENT
 *   CONTENT  keyword groups separated by ';', values by ','
 *
 * Framing is deliberately defensive. Validating the vendor's own 16 example
 * packets showed LEN is correct in 15 of them (the INFO example declares 142
 * bytes for 138 bytes of content) and that one example carries a 16-digit IMEI
 * where the spec says 15. A parser that trusts the header stalls its socket on
 * the first malformed packet and loses every position queued behind it, so we
 * treat LEN as a checksum and fall back to scanning for the terminating '$'.
 */

const HASH = 0x23; // '#'
const DOLLAR = 0x24; // '$'

/** Refuse to buffer more than this while hunting for a frame terminator. */
export const MAX_FRAME_BYTES = 8 * 1024;

export class ProtocolError extends Error {}

/* ------------------------------------------------------------------ *
 * Framing
 * ------------------------------------------------------------------ */

/**
 * Split a TCP buffer into complete frames.
 * Returns { frames, rest, anomalies } — `rest` is the incomplete tail to keep.
 */
export function deframe(buf) {
  const frames = [];
  const anomalies = [];
  let offset = 0;

  while (offset < buf.length) {
    // Locate the four '#' separators that close the header.
    const hashes = [];
    for (let i = offset; i < buf.length && hashes.length < 4; i++) {
      if (buf[i] === HASH) hashes.push(i);
    }
    if (hashes.length < 4) break; // header not fully arrived

    const contentStart = hashes[3] + 1;
    const lenHex = buf.toString('ascii', hashes[2] + 1, hashes[3]);
    const declared = /^[0-9a-fA-F]{1,4}$/.test(lenHex) ? parseInt(lenHex, 16) : NaN;

    let end = -1;
    let lengthTrusted = false;

    if (Number.isFinite(declared) && contentStart + declared < buf.length) {
      if (buf[contentStart + declared] === DOLLAR) {
        end = contentStart + declared;
        lengthTrusted = true;
      }
    }

    if (end === -1) {
      // LEN disagreed with the wire (or hasn't arrived). Fall back to the
      // terminator, which is what the device actually sends.
      const idx = buf.indexOf(DOLLAR, contentStart);
      if (idx === -1) {
        if (buf.length - offset > MAX_FRAME_BYTES) {
          anomalies.push({ type: 'oversize', dropped: buf.length - offset });
          offset = buf.length; // drop the garbage, keep the socket alive
        }
        break;
      }
      end = idx;
      if (Number.isFinite(declared)) {
        anomalies.push({
          type: 'length_mismatch',
          declared,
          actual: end - contentStart,
        });
      } else {
        anomalies.push({ type: 'bad_length_field', value: lenHex });
      }
    }

    const raw = buf.toString('utf8', offset, end + 1);
    frames.push({
      raw,
      id: buf.toString('ascii', offset, hashes[0]),
      imei: buf.toString('ascii', hashes[0] + 1, hashes[1]),
      seq: buf.toString('ascii', hashes[1] + 1, hashes[2]),
      declaredLength: Number.isFinite(declared) ? declared : null,
      lengthTrusted,
      content: buf.toString('utf8', contentStart, end),
    });

    offset = end + 1;
  }

  return { frames, rest: buf.subarray(offset), anomalies };
}

/** Build a wire frame. LEN is the byte length of `content`, lowercase hex. */
export function frame({ id = 'S168', imei, seq, content }) {
  if (!imei) throw new ProtocolError('imei required');
  const len = Buffer.byteLength(content, 'utf8');
  if (len > 0xffff) throw new ProtocolError(`content too long: ${len}`);
  const seqHex = typeof seq === 'number'
    ? seq.toString(16).padStart(4, '0')
    : String(seq);
  return `${id}#${imei}#${seqHex}#${len.toString(16).padStart(4, '0')}#${content}$`;
}

/* ------------------------------------------------------------------ *
 * Content parsing
 * ------------------------------------------------------------------ */

/**
 * Content takes several shapes:
 *   SYNC:0004;STATUS:13,100        keyword groups          -> kind 'keywords'
 *   ACK^LOCA / ACK^SYNC,2023...    server acknowledgement  -> kind 'ack'
 *   RET,GSENSOR,1                  reply to a command      -> kind 'ret'
 *   JUST / UP,600                  a command               -> kind 'command'
 *   INFO,ITEM:S281;VER:...         boot report             -> kind 'keywords' (+ lead)
 */
export function parseContent(content) {
  if (content.startsWith('ACK^')) {
    const [keyword, ...args] = content.slice(4).split(',');
    return { kind: 'ack', keyword, args };
  }

  if (content.startsWith('RET,')) {
    const parts = content.slice(4).split(',');
    return { kind: 'ret', command: parts[0], args: parts.slice(1) };
  }

  // A leading bare token followed by keyword groups (the INFO packet).
  let lead = null;
  let body = content;
  const firstComma = content.indexOf(',');
  const firstColon = content.indexOf(':');
  if (firstComma !== -1 && (firstColon === -1 || firstComma < firstColon)) {
    const head = content.slice(0, firstComma);
    if (/^[A-Z]+$/.test(head) && content.includes(':')) {
      lead = head;
      body = content.slice(firstComma + 1);
    } else {
      return { kind: 'command', command: head, args: content.slice(firstComma + 1).split(',') };
    }
  } else if (firstColon === -1) {
    return { kind: 'command', command: content, args: [] };
  }

  const groups = {};
  for (const group of body.split(';')) {
    if (!group) continue;
    const c = group.indexOf(':');
    if (c === -1) continue;
    groups[group.slice(0, c)] = group.slice(c + 1);
  }
  return { kind: 'keywords', lead, groups };
}

/* ------------------------------------------------------------------ *
 * Field decoders
 * ------------------------------------------------------------------ */

const hex = (v) => {
  const n = parseInt(v, 16);
  return Number.isFinite(n) ? n : null;
};
const dec = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * SYNC:<counter>[-a-b-c]
 *
 * The vendor doc describes a bare hex counter ("SYNC:0004"). Real firmware
 * sends `SYNC:0006-203-25-1` — the counter plus three undocumented
 * dash-separated fields. We keep them verbatim rather than discarding them:
 * one of them is plausibly temperature or signal quality, and we can only work
 * that out by collecting them against known conditions.
 */
export function decodeSync(v) {
  const [head, ...extras] = String(v).split('-');
  return { count: hex(head), extras, raw: String(v) };
}

/** STATUS:battery,signal — both decimal per the vendor table. */
export function decodeStatus(v) {
  const [battery, signal] = String(v).split(',');
  return { batteryPct: dec(battery), signalPct: dec(signal) };
}

/**
 * GDATA:valid,sats,time,lat,lng,speed,heading,altitude
 *
 * `time` is YYMMDDHHMMSS. The vendor doc states it is "currently non-UTC due to
 * background requirements, can be UTC" — so the raw string is preserved and the
 * interpretation is a deployment setting, not an assumption baked into parsing.
 * Harare is UTC+2; guessing wrong shifts every track by two hours.
 */
export function decodeGdata(v, { assumeUtc = true } = {}) {
  const p = String(v).split(',');
  const raw = p[2] ?? '';
  return {
    positioned: p[0] === 'A',
    satellites: dec(p[1]),
    timeRaw: raw,
    timestamp: decodeDeviceTime(raw, { assumeUtc }),
    lat: dec(p[3]),
    lng: dec(p[4]),
    speedKph: dec(p[5]),
    headingDeg: validHeading(dec(p[6])),
    altitudeM: dec(p[7]),
  };
}

/**
 * A WiFi or cell fix has no bearing, and this firmware reports `998` rather
 * than omitting the field — seen in a real track export from a live tag. It
 * fits in the column and would be stored as a real compass heading, so anything
 * outside 0-359 becomes null.
 */
export function validHeading(v) {
  return v != null && v >= 0 && v <= 359 ? v : null;
}

/** YYMMDDHHMMSS -> Date (or null). Assumes 20xx. */
export function decodeDeviceTime(raw, { assumeUtc = true } = {}) {
  if (!/^\d{12}$/.test(raw)) return null;
  const yy = +raw.slice(0, 2), mm = +raw.slice(2, 4), dd = +raw.slice(4, 6);
  const hh = +raw.slice(6, 8), mi = +raw.slice(8, 10), ss = +raw.slice(10, 12);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || mi > 59 || ss > 59) return null;
  const ms = Date.UTC(2000 + yy, mm - 1, dd, hh, mi, ss);
  // If the fleet reports local time, callers shift it; we never guess silently.
  return new Date(assumeUtc ? ms : ms);
}

/** CELL:count,mcc,mnc,lac,cid,rssi[,...] — all hex except count. */
export function decodeCell(v) {
  const p = String(v).split(',');
  const count = dec(p[0]) ?? 0;
  const stations = [];
  for (let i = 0; i < count; i++) {
    const o = 1 + i * 5;
    if (o + 4 >= p.length + 1 && p.length < o + 5) break;
    stations.push({
      mcc: hex(p[o]), mnc: hex(p[o + 1]),
      lac: hex(p[o + 2]), cellId: hex(p[o + 3]),
      rssi: hex(p[o + 4]),
    });
  }
  return { count, stations };
}

/** WIFI:count,mac,rssi,mac,rssi,... */
export function decodeWifi(v) {
  const p = String(v).split(',');
  const count = dec(p[0]) ?? 0;
  const aps = [];
  for (let i = 0; i < count; i++) {
    const o = 1 + i * 2;
    if (o + 1 >= p.length) break;
    aps.push({ mac: p[o].toUpperCase().replace(/-/g, ':'), rssi: dec(p[o + 1]) });
  }
  return { count, aps };
}

/**
 * ALERT is a hex bitfield. The vendor documents only bits 0–2, yet its own
 * position example carries 0x0040 (bit 6) — so undocumented bits are surfaced
 * rather than discarded, and the raw value is always kept.
 */
export const ALERT_BITS = { 0: 'low_power', 1: 'sos', 2: 'vibration' };

/**
 * Bits the vendor never documented, whose meaning we established from the
 * hardware itself. Kept in a separate map so the provenance stays visible: a
 * name here is an inference from observation, not something anyone promised.
 *
 * Bit 7 — charging. On 2 September 2026 the pilot tag set 0x0080 at 15:35:46
 * and held it while its battery climbed 78 → 85 → 87 → 93 → 94 %, having
 * reported 0x0000 all day until it was put on charge.
 */
export const INFERRED_ALERT_BITS = { 7: 'charging' };

export function decodeAlert(v) {
  const bits = hex(v) ?? 0;
  const flags = [];
  const inferred = [];
  const undocumented = [];
  for (let b = 0; b < 16; b++) {
    if (!(bits & (1 << b))) continue;
    if (ALERT_BITS[b]) flags.push(ALERT_BITS[b]);
    else if (INFERRED_ALERT_BITS[b]) { flags.push(INFERRED_ALERT_BITS[b]); inferred.push(b); }
    else undocumented.push(b);
  }
  return { raw: v, bits, flags, inferred, undocumented };
}

/** Fix type from the LOCA keyword. */
export const FIX_TYPE = { G: 'gps', W: 'wifi', L: 'lbs' };

/* ------------------------------------------------------------------ *
 * High-level packet decoding
 * ------------------------------------------------------------------ */

/**
 * Turn a frame into a domain packet. Never throws on bad field data — a single
 * unparseable value must not cost us the whole position.
 */
export function decodePacket(frame, opts = {}) {
  const parsed = parseContent(frame.content);
  const base = { imei: frame.imei, seq: frame.seq, raw: frame.raw };

  if (parsed.kind === 'ack') return { ...base, type: 'ack', ...parsed };
  if (parsed.kind === 'ret') {
    return { ...base, type: 'ret', command: parsed.command, result: parsed.args[0] ?? null, args: parsed.args };
  }
  if (parsed.kind === 'command') {
    return { ...base, type: 'command', command: parsed.command, args: parsed.args };
  }

  const g = parsed.groups;

  if ('SYNC' in g) {
    const sync = decodeSync(g.SYNC);
    return {
      ...base,
      type: 'heartbeat',
      count: sync.count,
      syncExtras: sync.extras,
      syncRaw: sync.raw,
      status: 'STATUS' in g ? decodeStatus(g.STATUS) : null,
    };
  }

  if ('LOCA' in g) {
    const gdata = 'GDATA' in g ? decodeGdata(g.GDATA, opts) : null;
    return {
      ...base,
      type: 'position',
      fixType: FIX_TYPE[g.LOCA] ?? null,
      fixTypeRaw: g.LOCA,
      gps: gdata,
      cell: 'CELL' in g ? decodeCell(g.CELL) : null,
      wifi: 'WIFI' in g ? decodeWifi(g.WIFI) : null,
      alert: 'ALERT' in g ? decodeAlert(g.ALERT) : null,
      status: 'STATUS' in g ? decodeStatus(g.STATUS) : null,
    };
  }

  if (parsed.lead === 'INFO') {
    return {
      ...base,
      type: 'info',
      model: g.ITEM ?? null,
      firmware: g.VER ?? null,
      plmn: g.PLMN ?? null,
      reportedImei: g.IMEI ?? null,
      imsi: g.IMSI ?? null,
      iccid: g.ICCID ?? null,
      simNumber: g.OWNER || null,
      features: g.DEV ?? null,
    };
  }

  return { ...base, type: 'unknown', groups: g, lead: parsed.lead };
}

/* ------------------------------------------------------------------ *
 * Server -> device
 * ------------------------------------------------------------------ */

/** yyyymmddhhmmss in UTC, the format the device expects for time sync. */
export function stamp(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    p(date.getUTCFullYear(), 4) + p(date.getUTCMonth() + 1) + p(date.getUTCDate()) +
    p(date.getUTCHours()) + p(date.getUTCMinutes()) + p(date.getUTCSeconds())
  );
}

/**
 * The acknowledgement a given inbound packet requires, or null if none.
 * ACKs echo the inbound sequence number — that is what lets the device pair
 * them up, and what lets us correlate command replies later.
 */
export function ackFor(packet, { id = 'S168', now = new Date() } = {}) {
  const mk = (content) => frame({ id, imei: packet.imei, seq: packet.seq, content });
  switch (packet.type) {
    case 'heartbeat': return mk(`ACK^SYNC,${stamp(now)}`);
    case 'position': return mk('ACK^LOCA');
    case 'info': return mk(`ACK^INFO,${stamp(now)}`);
    default: return null;
  }
}

/** Downlink commands. Args are joined with ','; the device replies RET,<CMD>,<result>. */
export const COMMANDS = {
  locateNow: () => 'JUST',
  setInterval: (seconds) => {
    if (!(seconds >= 60 && seconds <= 43200)) {
      throw new ProtocolError(`UP interval out of range (60-43200): ${seconds}`);
    }
    return `UP,${seconds}`;
  },
  /** 1 high/30s, 2 standard/60s, 3 low/180s, 0 off. Mutually exclusive with setInterval. */
  setVibrationSensitivity: (level) => {
    if (![0, 1, 2, 3].includes(level)) throw new ProtocolError(`GSENSOR level must be 0-3: ${level}`);
    return `GSENSOR,${level}`;
  },
  setVibrationAlarm: (on) => `GSHAKE,${on ? 1 : 0}`,
  /** 0 always online, 1 all-day power saving, 2 night power saving. */
  setPowerSaving: (mode) => {
    if (![0, 1, 2].includes(mode)) throw new ProtocolError(`SAVE mode must be 0-2: ${mode}`);
    return `SAVE,${mode}`;
  },
  /** 3 GPS first then WiFi, 5 WiFi first then GPS. */
  setPositioningMode: (mode) => {
    if (![3, 5].includes(mode)) throw new ProtocolError(`ONLY mode must be 3 or 5: ${mode}`);
    return `ONLY,${mode}`;
  },
  /** All times UTC per the vendor doc. */
  setAutoPower: ({ enabled, offHour, offMin, onHour, onMin }) =>
    `APOF,${enabled ? 1 : 0},${String(offHour).padStart(2, '0')},${String(offMin).padStart(2, '0')},${String(onHour).padStart(2, '0')},${String(onMin).padStart(2, '0')}`,
  findMe: () => 'FINDME',
  reboot: () => 'REBOOT',
  powerDown: () => 'POWERDN',
};

/**
 * Commands we never block waiting on.
 *
 * The vendor doc says "Uplink: None" for both and warns the reply may not
 * arrive. In practice the physical tag answered a REBOOT with
 * `RET,REBOOT,1` in about one second — so the doc is pessimistic rather than
 * wrong. We still resolve immediately (other firmware may not reply), but the
 * reply is decoded and recorded normally if it does turn up.
 */
export const NO_REPLY_COMMANDS = new Set(['REBOOT', 'POWERDN']);

/**
 * Commands the TCP protocol document defines but the HCS048 hardware does not
 * implement.
 *
 * The protocol is shared across a family of trackers; this model is a sealed
 * solar ear tag with no button, speaker or microphone. The user manual is
 * explicit for one of them — "B: SOS number setting — Do not have this
 * function, please ignore" — so SOS is the only confirmed entry.
 *
 * Sending an unimplemented command is worse than an error: the device may reply
 * RET,<CMD>,1 and do nothing, so an operator would believe an SOS number was
 * configured when the feature does not exist.
 */
export const UNSUPPORTED_ON_HCS048 = new Set(['SOS']);

/**
 * Commands we suspect are inert on this model but the manual does not confirm.
 * TONE announces the time through a speaker and FINDME rings one; the manual
 * says voice intercom and phone listening "do not have this function", which
 * makes a speaker unlikely. Verify with the vendor before relying on either.
 */
export const UNVERIFIED_ON_HCS048 = new Set(['TONE', 'FINDME']);

export function assertSupported(content) {
  const command = content.split(',')[0];
  if (UNSUPPORTED_ON_HCS048.has(command)) {
    throw new ProtocolError(
      `${command} is defined in the protocol but not implemented on the HCS048 ` +
      `(user manual: "Do not have this function, please ignore")`);
  }
  return content;
}
