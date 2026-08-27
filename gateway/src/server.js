/**
 * Production entry point: TCP gateway + Postgres sink + command dispatch.
 *
 *   DATABASE_URL=postgres://... GATEWAY_PORT=5100 node src/server.js
 *
 * The command loop is the reason the web app never touches a device. The app
 * inserts into `command_queue`; this process claims rows for devices whose
 * sockets it is currently holding, pushes them down, and writes the reply back.
 */
import { Gateway } from './gateway.js';
import { PostgresSink } from './sink-postgres.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 5100);
const POLL_MS = Number(process.env.COMMAND_POLL_MS ?? 2000);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. For a local run:');
  console.error('  DATABASE_URL=postgres://localhost/herdwise node src/server.js');
  process.exit(1);
}

const sink = new PostgresSink({
  onContainment: (e) => {
    if (e.event === 'breach_opened') {
      console.log(
        `\n  ⚑ BREACH  animal ${e.animal_id} left "${e.parcel_name}" ` +
        `— ${e.distance_m} m outside since ${e.outside_since}\n`,
      );
    } else {
      console.log(`  ✓ resolved  animal ${e.animal_id} back inside "${e.parcel_name}"`);
    }
  },
});

const gateway = new Gateway({
  sink,
  assumeUtc: process.env.DEVICE_TIME_UTC !== 'false', // see Q4 — confirm with the vendor
});

await gateway.listen(PORT);

let polling = false;
const timer = setInterval(async () => {
  if (polling) return; // never overlap a slow poll with the next tick
  polling = true;
  try {
    const online = [...gateway.devices.keys()];
    if (online.length) {
      const claimed = await sink.claimCommands(online);
      for (const c of claimed) {
        try {
          const ret = await gateway.send(c.imei, c.payload);
          console.log(`  ✓ ${c.command} -> ${c.imei}: ${ret.result ?? ret.type}`);
        } catch (err) {
          console.warn(`  ✗ ${c.command} -> ${c.imei}: ${err.message}`);
          await sink.pool.query(
            `update command_queue set state='failed', settled_at=now(), error=$2 where id=$1`,
            [c.id, err.message],
          );
        }
      }
    }
    await sink.expireStaleCommands();
  } catch (err) {
    console.error('command loop error:', err.message);
  } finally {
    polling = false;
  }
}, POLL_MS);

const shutdown = async () => {
  clearInterval(timer);
  await gateway.close();
  await sink.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
