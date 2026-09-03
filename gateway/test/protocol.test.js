/**
 * Every example packet in the vendor's HCS048 TCP/IP protocol document,
 * transcribed verbatim, plus the framing edge cases they imply.
 *
 * These are the only ground truth we have until a tag is on a live SIM, so the
 * suite is deliberately built around the vendor's own bytes rather than around
 * packets we invented to match our parser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deframe, frame, decodePacket, ackFor, stamp,
  decodeAlert, decodeGdata, decodeDeviceTime,
  COMMANDS, ProtocolError, MAX_FRAME_BYTES, NO_REPLY_COMMANDS,
} from '../src/protocol.js';

const HEARTBEAT = 'S168#000000000000000#002a#0017#SYNC:0004;STATUS:13,100$';
const HEARTBEAT_ACK = 'S168#0000000000000000#002a#0017#ACK^SYNC,20231110005435$';
const POSITION =
  'S168#000000000000000#0008#0151#LOCA:G;CELL:1,0,0,279b,33de38f,35;' +
  'GDATA:A,5,231007093611,22.613214,114.102990,0,0,29;ALERT:0040;STATUS:24,100;' +
  'WIFI:10,62-74-24-54-ED-0E,-68,3A-F7-16-DA-EA-35,-68,34-F7-16-DA-EA-35,-68,' +
  '48-A7-3C-FB-54-A5,-70,40-45-DA-83-11-69,-72,08-10-7C-5B-E5-F4,-79,' +
  '28-6C-07-CE-53-2F,-85,50-33-F0-54-E5-9E,-85,B0-AC-D2-0A-CF-3C,-91,' +
  '30-42-40-EF-8C-BE,-93$';
const POSITION_ACK = 'S168#000000000000000#0008#0008#ACK^LOCA$';
const INFO =
  'S168#000000000000000#0001#008e#INFO,ITEM:S281;VER:SGNL101CT004;PLMN:46000;' +
  'IMEI:865015210699940;IMSI:460138481508376;ICCID:89860804042180058376;' +
  'OWNER:;APN:,,;DEV:00000005$';
const CMD_JUST = 'S168#864239068739969#8a36#0004#JUST$';
const RET_JUST = 'S168#864239068739969#8a36#000a#RET,JUST,1$';
const RET_GSENSOR = 'S168#864239068739969#9186#000d#RET,GSENSOR,1$';
const CMD_UP = 'S168#864239068739969#936e#0006#UP,600$';
const CMD_APOF = 'S168#864239068739969#a520#0012#APOF,1,15,00,22,30$';
const CMD_SOS = 'S168#864239068739969#9f93#002b#SOS,3,1779632XXXX,1779632XXXX,1779632XXXX,,$';
const CMD_TONE = 'S168#864239068739969#b389#0007#TONE,8d$';

const one = (s) => {
  const { frames, rest } = deframe(Buffer.from(s, 'utf8'));
  assert.equal(frames.length, 1, `expected exactly one frame from ${s.slice(0, 40)}…`);
  assert.equal(rest.length, 0, 'expected no trailing bytes');
  return frames[0];
};

/* ---------------- framing ---------------- */

test('frames every vendor example', () => {
  for (const raw of [HEARTBEAT, HEARTBEAT_ACK, POSITION, POSITION_ACK, INFO,
                     CMD_JUST, RET_JUST, RET_GSENSOR, CMD_UP, CMD_APOF, CMD_SOS, CMD_TONE]) {
    const f = one(raw);
    assert.equal(f.id, 'S168');
    assert.equal(f.raw, raw);
  }
});

test('LEN is trusted where it is correct, and only there', () => {
  assert.equal(one(HEARTBEAT).lengthTrusted, true);
  assert.equal(one(POSITION).lengthTrusted, true);
  assert.equal(one(CMD_SOS).lengthTrusted, true);
  // The vendor's own INFO example declares 0x8e (142) for 138 bytes of content.
  const info = one(INFO);
  assert.equal(info.lengthTrusted, false);
  assert.equal(info.declaredLength, 142);
  assert.equal(Buffer.byteLength(info.content, 'utf8'), 138);
});

test('a wrong LEN still yields the correct content, and is reported', () => {
  const { frames, anomalies } = deframe(Buffer.from(INFO, 'utf8'));
  assert.equal(frames[0].content.startsWith('INFO,ITEM:S281'), true);
  assert.equal(frames[0].content.endsWith('DEV:00000005'), true);
  assert.deepEqual(anomalies, [{ type: 'length_mismatch', declared: 142, actual: 138 }]);
});

test('does not assume a 15-digit IMEI', () => {
  // The vendor's heartbeat-ACK example carries 16 digits.
  assert.equal(one(HEARTBEAT_ACK).imei, '0000000000000000');
  assert.equal(one(HEARTBEAT).imei, '000000000000000');
});

test('splits several frames delivered in one TCP segment', () => {
  const { frames, rest } = deframe(Buffer.from(HEARTBEAT + POSITION + CMD_JUST, 'utf8'));
  assert.equal(frames.length, 3);
  assert.equal(rest.length, 0);
  assert.deepEqual(frames.map((f) => decodePacket(f).type), ['heartbeat', 'position', 'command']);
});

test('holds a partial frame and completes it on the next segment', () => {
  const cut = 40;
  const a = deframe(Buffer.from(POSITION.slice(0, cut), 'utf8'));
  assert.equal(a.frames.length, 0);
  const b = deframe(Buffer.concat([a.rest, Buffer.from(POSITION.slice(cut), 'utf8')]));
  assert.equal(b.frames.length, 1);
  assert.equal(b.frames[0].raw, POSITION);
});

test('a malformed frame does not poison the ones behind it', () => {
  const junk = 'S168#000000000000000#0001#zzzz#SYNC:0001;STATUS:9,80$';
  const { frames } = deframe(Buffer.from(junk + POSITION, 'utf8'));
  assert.equal(frames.length, 2);
  assert.equal(decodePacket(frames[1]).type, 'position');
});

test('drops unterminated garbage rather than buffering without limit', () => {
  const flood = Buffer.from('S168#000000000000000#0001#0010#' + 'x'.repeat(MAX_FRAME_BYTES + 10), 'utf8');
  const { frames, rest, anomalies } = deframe(flood);
  assert.equal(frames.length, 0);
  assert.equal(rest.length, 0);
  assert.equal(anomalies[0].type, 'oversize');
});

test('frame() round-trips and computes LEN correctly', () => {
  const built = frame({ imei: '000000000000000', seq: '002a', content: 'SYNC:0004;STATUS:13,100' });
  assert.equal(built, HEARTBEAT);
  assert.equal(one(built).content, 'SYNC:0004;STATUS:13,100');
});

/* ---------------- content ---------------- */

test('decodes the heartbeat', () => {
  const p = decodePacket(one(HEARTBEAT));
  assert.equal(p.type, 'heartbeat');
  assert.equal(p.count, 4); // SYNC is hex
  assert.deepEqual(p.status, { batteryPct: 13, signalPct: 100 });
});

test('decodes the position packet end to end', () => {
  const p = decodePacket(one(POSITION));
  assert.equal(p.type, 'position');
  assert.equal(p.fixType, 'gps');
  assert.equal(p.gps.positioned, true);
  assert.equal(p.gps.satellites, 5);
  assert.equal(p.gps.lat, 22.613214);
  assert.equal(p.gps.lng, 114.102990);
  assert.equal(p.gps.speedKph, 0);
  assert.equal(p.gps.altitudeM, 29);
  assert.equal(p.gps.timeRaw, '231007093611');
  assert.equal(p.gps.timestamp.toISOString(), '2023-10-07T09:36:11.000Z');
  assert.deepEqual(p.status, { batteryPct: 24, signalPct: 100 });
});

test('decodes all ten WiFi access points', () => {
  const p = decodePacket(one(POSITION));
  assert.equal(p.wifi.count, 10);
  assert.equal(p.wifi.aps.length, 10);
  assert.equal(p.wifi.aps[0].mac, '62:74:24:54:ED:0E');
  assert.equal(p.wifi.aps[0].rssi, -68);
  assert.equal(p.wifi.aps[9].rssi, -93);
});

test('decodes the base station, hex fields and all', () => {
  const p = decodePacket(one(POSITION));
  assert.equal(p.cell.count, 1);
  assert.deepEqual(p.cell.stations[0], {
    mcc: 0, mnc: 0, lac: 0x279b, cellId: 0x33de38f, rssi: 0x35,
  });
});

test('surfaces the undocumented ALERT bit the vendor example actually sends', () => {
  // Doc defines bit0 low_power, bit1 sos, bit2 vibration — its own example is 0x0040.
  const p = decodePacket(one(POSITION));
  assert.equal(p.alert.bits, 0x40);
  assert.deepEqual(p.alert.flags, []);
  assert.deepEqual(p.alert.undocumented, [6]);
  assert.equal(p.alert.raw, '0040');
});

test('decodes the documented alert bits', () => {
  assert.deepEqual(decodeAlert('0001').flags, ['low_power']);
  assert.deepEqual(decodeAlert('0002').flags, ['sos']);
  assert.deepEqual(decodeAlert('0004').flags, ['vibration']);
  assert.deepEqual(decodeAlert('0007').flags, ['low_power', 'sos', 'vibration']);
});

test('decodes the boot INFO packet', () => {
  const p = decodePacket(one(INFO));
  assert.equal(p.type, 'info');
  assert.equal(p.model, 'S281');
  assert.equal(p.firmware, 'SGNL101CT004');
  assert.equal(p.plmn, '46000');
  assert.equal(p.reportedImei, '865015210699940');
  assert.equal(p.iccid, '89860804042180058376');
  assert.equal(p.simNumber, null); // OWNER: is empty in the example
});

test('distinguishes commands, replies and acks', () => {
  assert.deepEqual(
    [CMD_JUST, RET_JUST, RET_GSENSOR, CMD_UP, POSITION_ACK, HEARTBEAT_ACK]
      .map((r) => decodePacket(one(r)).type),
    ['command', 'ret', 'ret', 'command', 'ack', 'ack'],
  );
  const ret = decodePacket(one(RET_GSENSOR));
  assert.equal(ret.command, 'GSENSOR');
  assert.equal(ret.result, '1');

  const up = decodePacket(one(CMD_UP));
  assert.equal(up.command, 'UP');
  assert.deepEqual(up.args, ['600']);

  const ack = decodePacket(one(HEARTBEAT_ACK));
  assert.equal(ack.keyword, 'SYNC');
  assert.deepEqual(ack.args, ['20231110005435']);
});

test('parses the multi-argument commands without losing empty slots', () => {
  // Deleting an SOS number means leaving its position empty — do not collapse.
  const sos = decodePacket(one(CMD_SOS));
  assert.deepEqual(sos.args, ['3', '1779632XXXX', '1779632XXXX', '1779632XXXX', '', '']);
  const apof = decodePacket(one(CMD_APOF));
  assert.deepEqual(apof.args, ['1', '15', '00', '22', '30']);
  assert.deepEqual(decodePacket(one(CMD_TONE)).args, ['8d']);
});

/* ---------------- acknowledgements ---------------- */

test('produces the exact ACKs the vendor documents, echoing the sequence', () => {
  const now = new Date('2023-11-10T00:54:35Z');
  assert.equal(ackFor(decodePacket(one(HEARTBEAT)), { now }),
    'S168#000000000000000#002a#0017#ACK^SYNC,20231110005435$');
  assert.equal(ackFor(decodePacket(one(POSITION)), { now }), POSITION_ACK);
  assert.equal(ackFor(decodePacket(one(INFO)), { now }),
    frame({ imei: '000000000000000', seq: '0001', content: 'ACK^INFO,20231110005435' }));
});

test('never acknowledges a device reply', () => {
  for (const raw of [RET_JUST, RET_GSENSOR, HEARTBEAT_ACK]) {
    assert.equal(ackFor(decodePacket(one(raw))), null);
  }
});

test('stamp() is UTC, zero padded', () => {
  assert.equal(stamp(new Date('2026-01-05T07:08:09Z')), '20260105070809');
});

/* ---------------- outbound commands ---------------- */

test('builds the documented commands', () => {
  assert.equal(COMMANDS.locateNow(), 'JUST');
  assert.equal(COMMANDS.setInterval(600), 'UP,600');
  assert.equal(COMMANDS.setVibrationSensitivity(1), 'GSENSOR,1');
  assert.equal(COMMANDS.setPowerSaving(2), 'SAVE,2');
  assert.equal(COMMANDS.setPositioningMode(3), 'ONLY,3');
  assert.equal(
    COMMANDS.setAutoPower({ enabled: true, offHour: 15, offMin: 0, onHour: 22, onMin: 30 }),
    'APOF,1,15,00,22,30',
  );
});

test('rejects out-of-range settings the device would silently ignore', () => {
  assert.throws(() => COMMANDS.setInterval(30), ProtocolError);      // min 60
  assert.throws(() => COMMANDS.setInterval(50000), ProtocolError);   // max 43200
  assert.throws(() => COMMANDS.setVibrationSensitivity(4), ProtocolError);
  assert.throws(() => COMMANDS.setPositioningMode(4), ProtocolError);
});

test('a built command matches the vendor example byte for byte', () => {
  assert.equal(
    frame({ imei: '864239068739969', seq: '936e', content: COMMANDS.setInterval(600) }),
    CMD_UP,
  );
  assert.equal(
    frame({ imei: '864239068739969', seq: '8a36', content: COMMANDS.locateNow() }),
    CMD_JUST,
  );
});

/* ---------------- time ---------------- */

test('device time rejects malformed values instead of inventing a date', () => {
  assert.equal(decodeDeviceTime(''), null);
  assert.equal(decodeDeviceTime('23100709361'), null);   // 11 digits
  assert.equal(decodeDeviceTime('231399093611'), null);  // month 13
  assert.equal(decodeDeviceTime('231007253611'), null);  // hour 25
});

test('an unpositioned fix is flagged rather than trusted', () => {
  // "V: Not positioned … uses the data of the last positioning" — never store as live.
  const g = decodeGdata('V,0,231007093611,0,0,0,0,0');
  assert.equal(g.positioned, false);
  assert.equal(g.lat, 0);
});

test('rejects the sentinel heading a real tag sends on non-GPS fixes', () => {
  // Observed in a live track export: WiFi fixes carry direction 998, GPS fixes
  // carry a real bearing. 998 fits the column and would read as a compass
  // heading, so it must not be stored.
  //
  // Coordinates here are Harare, not the bench location. Real captures stay in
  // the database; a public repo is the wrong place for anyone's address, and
  // the assertions under test are the heading sentinel and the validity flag,
  // which do not depend on where the fix was taken.
  const wifi = decodeGdata('A,0,260828002900,-17.830000,31.050000,0,998,1680');
  assert.equal(wifi.headingDeg, null, 'heading 998 is not a bearing');
  const gps = decodeGdata('A,9,260828000500,-17.830000,31.050000,0,0,1680');
  assert.equal(gps.headingDeg, 0, 'a genuine 0 heading survives');
  assert.equal(decodeGdata('A,9,260828000500,-17.83,31.05,0,359,1680').headingDeg, 359);
  assert.equal(decodeGdata('A,9,260828000500,-17.83,31.05,0,360,1680').headingDeg, null);
});

/* ---------------- real hardware ---------------- */

test('parses a frame captured from the physical tag', () => {
  // The first bytes we have ever seen from real hardware: the reply to a
  // Remote restart issued from the vendor platform on 2026-08-27. The IMEI is
  // redacted to a placeholder — the framing and length header are unaffected by
  // which digits it carries, so the test still exercises the real wire format.
  const real = 'S168#860000000000009#4301#000C#RET,REBOOT,1$';
  const { frames, rest, anomalies } = deframe(Buffer.from(real, 'utf8'));

  assert.equal(frames.length, 1);
  assert.equal(rest.length, 0);
  assert.deepEqual(anomalies, [], 'a real frame produces no anomalies');

  const f = frames[0];
  assert.equal(f.id, 'S168', 'the shipped prefix really is S168');
  assert.equal(f.imei, '860000000000009');
  assert.equal(f.declaredLength, 12);
  assert.equal(f.lengthTrusted, true, 'the device gets its own length header right');

  const p = decodePacket(f);
  assert.equal(p.type, 'ret');
  assert.equal(p.command, 'REBOOT');
  assert.equal(p.result, '1');
});

test('REBOOT does reply on this firmware, contradicting the vendor doc', () => {
  // The protocol document states "Uplink: None" for REBOOT and warns the reply
  // may never arrive. The physical tag answered in one second. We still do not
  // block waiting for it — the doc's warning may hold on other firmware — but
  // the reply must be recorded when it does come.
  assert.equal(NO_REPLY_COMMANDS.has('REBOOT'), true, 'still fire-and-forget by design');
  const p = decodePacket(deframe(Buffer.from('S168#860000000000009#4301#000C#RET,REBOOT,1$'))
    .frames[0]);
  assert.equal(p.type, 'ret', 'and is still decoded as a normal reply when it arrives');
});

test('keeps the undocumented SYNC fields real firmware sends', () => {
  // Captured from the physical tag: the doc describes a bare hex counter,
  // the device sends the counter plus three unexplained fields.
  const real = 'S168#860000000000009#0009#0021#SYNC:0006-203-25-1;STATUS:100,100$';
  const { frames, anomalies } = deframe(Buffer.from(real, 'utf8'));
  assert.deepEqual(anomalies, [], 'the extended form still frames cleanly');

  const p = decodePacket(frames[0]);
  assert.equal(p.type, 'heartbeat');
  assert.equal(p.count, 6, 'the counter is still read correctly');
  assert.deepEqual(p.syncExtras, ['203', '25', '1'], 'extras are kept, not dropped');
  assert.equal(p.syncRaw, '0006-203-25-1');
  assert.deepEqual(p.status, { batteryPct: 100, signalPct: 100 });
});

test('a plain SYNC counter still has no extras', () => {
  const p = decodePacket(deframe(Buffer.from('S168#000000000000000#002a#0017#SYNC:0004;STATUS:13,100$')).frames[0]);
  assert.equal(p.count, 4);
  assert.deepEqual(p.syncExtras, []);
});

/* ------------------------------------------------------------------ *
 * The alarm the pilot tag raised on 2 September 2026
 * ------------------------------------------------------------------ */

/**
 * The tag's button was pressed. It sent ALERT:0082 on a frame whose GPS was
 * void — bit 1 (SOS) alongside bit 7, which the vendor never documented but
 * which the hardware sets while charging: 0x0080 appeared the moment the tag
 * went on charge and held while its battery climbed 78 % to 94 %.
 *
 * IMEI redacted to the test range; the structure is exactly as captured.
 */
const SOS_NO_FIX =
  'S168#860000000000009#000e#0075#LOCA:W;CELL:0,0,0,0,0,0;' +
  'GDATA:V,0,260902220011,0.0,0.0,0,0,0;ALERT:0082;STATUS:94,100$';

test('the SOS bit is read from a real alarm frame', () => {
  const p = decodePacket(deframe(Buffer.from(SOS_NO_FIX, 'utf8')).frames[0]);
  assert.equal(p.type, 'position');
  assert.equal(p.gps.positioned, false, 'GDATA:V carries no usable fix');
  assert.ok(p.alert.flags.includes('sos'), 'and the alarm is still there');
  assert.equal(p.status.batteryPct, 94);
});

test('bit 7 is named from what the hardware did, not from the manual', () => {
  // Recorded as inferred rather than documented, so the provenance survives.
  const charging = decodeAlert('0080');
  assert.deepEqual(charging.flags, ['charging']);
  assert.deepEqual(charging.inferred, [7]);
  assert.deepEqual(charging.undocumented, [], 'no longer reported as unknown');

  const both = decodeAlert('0082');
  assert.deepEqual(both.flags, ['sos', 'charging']);

  // Bit 6 from the vendor's own example is still unexplained, and must stay
  // visible rather than being quietly absorbed.
  assert.deepEqual(decodeAlert('0040').undocumented, [6]);
  assert.deepEqual(decodeAlert('0000').flags, []);
});

/* ------------------------------------------------------------------ *
 * The tag that lost its minus sign
 * ------------------------------------------------------------------ */

/**
 * On 3 September two tags standing a few metres apart in the same Harare yard
 * reported opposite hemispheres. One sent `-17.880416`, the other `17.880418`.
 * The frame really does arrive without the sign, so this is the tag's firmware
 * and not our decoding — which the decoder has to keep proving, because if it
 * ever "helpfully" corrected it we would stop being able to tell.
 */
test('a positive latitude is decoded as sent, not silently corrected', () => {
  const dropped = 'S168#860000000000009#0002#007c#LOCA:G;CELL:2,288,1,2,1d9803,62,2,1fb201,63;' +
    'GDATA:A,9,260903233823,17.880418,30.997500,1,0,0;ALERT:0000;STATUS:97,100$';
  const p = decodePacket(deframe(Buffer.from(dropped, 'utf8')).frames[0]);

  assert.equal(p.gps.positioned, true, 'the tag claims a valid fix');
  assert.equal(p.gps.lat, 17.880418, 'and we report exactly what it sent');
  assert.ok(p.gps.lat > 0, 'northern hemisphere — 3,900 km from where it is');

  // The same yard, from the tag that got it right.
  const correct = 'S168#860000000000009#0002#007f#LOCA:G;CELL:2,288,1,2,1d9803,63,2,1fb201,63;' +
    'GDATA:A,13,260903000211,-17.880416,30.997455,1,0,0;ALERT:0000;STATUS:100,100$';
  const q = decodePacket(deframe(Buffer.from(correct, 'utf8')).frames[0]);
  assert.equal(q.gps.lat, -17.880416);

  // Metres apart in reality, hemispheres apart as reported.
  assert.ok(Math.abs(p.gps.lat - q.gps.lat) > 35, 'which is why it cannot be stored');
});

/* ------------------------------------------------------------------ *
 * A clock that breaks backwards
 * ------------------------------------------------------------------ */

test('a device clock sixteen hours behind is not believed', async () => {
  const { PostgresSink } = await import('../src/sink-postgres.js');
  const sink = Object.create(PostgresSink.prototype);
  const now = new Date('2026-09-03T16:22:38Z');

  // What the tags actually sent once their clocks jumped: continuously
  // connected, streaming fixes, each claiming a time from that morning.
  const broken = new Date('2026-09-03T00:17:29Z');
  assert.equal(sink.recordedAt(broken, now).getTime(), now.getTime(),
    'our clock is the better evidence');

  // A short backlog after a gap in coverage is still ordered by the device.
  const backlog = new Date('2026-09-03T14:22:38Z');
  assert.equal(sink.recordedAt(backlog, now).getTime(), backlog.getTime(),
    'two hours behind is a real backlog and is kept');

  // The future was already guarded; this unit reported hours ahead in August.
  const ahead = new Date('2026-09-03T20:00:00Z');
  assert.equal(sink.recordedAt(ahead, now).getTime(), now.getTime());

  // No time at all means we stamp it ourselves.
  assert.equal(sink.recordedAt(null, now).getTime(), now.getTime());
});
