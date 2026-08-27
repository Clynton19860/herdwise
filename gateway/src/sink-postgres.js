/**
 * Postgres/Supabase sink.
 *
 * Everything a position implies — the fix row, device health, and the
 * containment decision — happens inside one `record_fix()` call, so a breach
 * can never be observed without the fix that caused it.
 *
 * Connect with the service role: the gateway writes telemetry for every device
 * and is not acting on behalf of any signed-in user.
 */
import fs from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

/**
 * Supabase's pooler presents a certificate from its own private CA
 * ("Supabase Root 2021 CA"), which is in no system trust store — so a plain
 * `sslmode=require` fails verification. Pin their root rather than reaching for
 * `sslmode=no-verify`: that would still encrypt, but would accept any
 * certificate, and this link carries every animal position across the public
 * internet between the gateway and the database.
 */
function tlsOptions() {
  const caFile = process.env.DATABASE_CA_FILE;
  if (!caFile) return undefined;
  return { ca: fs.readFileSync(caFile, 'utf8'), rejectUnauthorized: true };
}

export class PostgresSink {
  /**
   * @param {object} opts
   * @param {string} [opts.connectionString]  defaults to $DATABASE_URL
   * @param {(event: object) => void} [opts.onContainment]  breach callback
   */
  constructor({ connectionString = process.env.DATABASE_URL, onContainment, pool } = {}) {
    this.pool = pool ?? new Pool({
      connectionString,
      ssl: tlsOptions(),
      max: 10,
      // A stalled database must not become a stalled gateway; tags will
      // reconnect but their positions in flight are gone for good.
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
    this.onContainment = onContainment ?? ((e) => {
      console.log(
        `  ⚑ ${e.event === 'breach_opened' ? 'BREACH' : 'resolved'}  ` +
        `animal ${e.animal_id}  ${e.parcel_name ?? ''}` +
        (e.distance_m != null ? `  ${e.distance_m} m outside` : ''),
      );
    });
  }

  async savePosition(p) {
    const g = p.gps;
    // An unpositioned fix repeats the last known coordinates per the vendor
    // doc — storing it as live would fabricate a position we never observed.
    if (!g?.positioned || g.lat == null || g.lng == null) {
      return this.saveAnomaly(p.imei, { type: 'unpositioned_fix', fixType: p.fixTypeRaw });
    }

    const { rows } = await this.pool.query(
      `select record_fix($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) as result`,
      [
        p.imei,
        p.fixType ?? 'none',
        g.lat,
        g.lng,
        (g.timestamp ?? new Date()).toISOString(),
        g.timeRaw ?? null,
        g.speedKph,
        g.headingDeg,
        g.altitudeM,
        g.satellites,
        p.status?.batteryPct ?? null,
        p.status?.signalPct ?? null,
        p.alert?.bits ?? 0,
        p.sourceIp ?? null,
      ],
    );

    console.log(
      `  ↑ position  ${p.imei}  ${String(p.fixType).padEnd(4)}  ` +
      `${g.lat.toFixed(6)},${g.lng.toFixed(6)}  ${g.speedKph ?? '–'}km/h  ` +
      `batt ${p.status?.batteryPct ?? '–'}%`);

    const result = rows[0]?.result;
    if (result) this.onContainment(result);

    // The vendor's own example sends ALERT bit 6, which its documentation never
    // defines. Record every undocumented bit rather than discarding it — one of
    // them may be the tamper signal we actually want.
    if (p.alert?.undocumented?.length) {
      await this.saveAnomaly(p.imei, {
        type: 'undocumented_alert_bit',
        bits: p.alert.undocumented,
        raw: p.alert.raw,
      });
    }
    return result;
  }

  async saveHeartbeat(p) {
    await this.pool.query('select record_heartbeat($1,$2,$3)', [
      p.imei, p.status?.batteryPct ?? null, p.status?.signalPct ?? null,
    ]);
    // Log arrivals as well as writing them. On a sealed ear tag whose LED is
    // only visible while charging, this journal is the sole way to tell a live
    // device from a dead one.
    console.log(
      `  ↑ heartbeat ${p.imei}  #${p.count}  batt ${p.status?.batteryPct ?? '–'}%  ` +
      `sig ${p.status?.signalPct ?? '–'}` +
      (p.syncExtras?.length ? `  sync-extra=[${p.syncExtras.join(',')}]` : ''));

    // Undocumented SYNC fields, kept so their meaning can be worked out from
    // real observations rather than guessed.
    if (p.syncExtras?.length) {
      await this.saveAnomaly(p.imei, {
        type: 'undocumented_sync_fields', raw: p.syncRaw, extras: p.syncExtras,
      });
    }
  }

  async saveInfo(p) {
    await this.pool.query(
      `insert into devices (imei, model, firmware, imsi, iccid, last_seen_at)
            values ($1,$2,$3,$4,$5, now())
       on conflict (imei) do update
          set model = coalesce(excluded.model, devices.model),
              firmware = coalesce(excluded.firmware, devices.firmware),
              imsi = coalesce(excluded.imsi, devices.imsi),
              iccid = coalesce(excluded.iccid, devices.iccid),
              last_seen_at = now()`,
      [p.imei, p.model, p.firmware, p.imsi, p.iccid],
    );
    console.log(`  ↑ boot      ${p.imei}  ${p.model ?? '?'} ${p.firmware ?? '?'}  iccid ${p.iccid ?? '?'}`);
  }

  async saveCommandResult(p) {
    await this.pool.query(
      `update command_queue
          set state = case when $3 = '1' then 'acked'::command_state else 'failed'::command_state end,
              settled_at = now(), result = $3
        where id = (select cq.id from command_queue cq
                      join devices d on d.id = cq.device_id
                     where d.imei = $1 and cq.command = $2 and cq.state = 'sent'
                     order by cq.sent_at desc limit 1)`,
      [p.imei, p.command, p.result],
    );
    console.log(`  ↑ reply     ${p.imei}  ${p.command} -> ${p.result}`);
  }

  async saveAnomaly(imei, a) {
    const { type, ...detail } = a;
    await this.pool.query(
      `insert into device_anomalies (imei, device_id, kind, detail)
       values ($1, (select id from devices where imei = $1), $2, $3)`,
      [imei ?? null, type ?? 'unknown', JSON.stringify(detail)],
    );
  }

  /** Rows the app has queued for devices that are currently connected. */
  async claimCommands(onlineImeis) {
    if (!onlineImeis.length) return [];
    const { rows } = await this.pool.query(
      `update command_queue cq
          set state = 'sent', sent_at = now()
        from devices d
       where d.id = cq.device_id
         and cq.state = 'queued'
         and cq.expires_at > now()
         and d.imei = any($1)
      returning cq.id, d.imei, cq.command, cq.payload`,
      [onlineImeis],
    );
    return rows;
  }

  async expireStaleCommands() {
    await this.pool.query(
      `update command_queue set state = 'expired', settled_at = now()
        where state in ('queued','sent') and expires_at < now()`,
    );
  }

  async close() {
    await this.pool.end();
  }
}
