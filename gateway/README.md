# Herdwise telemetry gateway

The component that talks to HCS048 ear tags. It is a **plain TCP listener**, which
is why it cannot live in the Next.js app: the tag opens a persistent socket and
speaks a custom `#`-delimited protocol, never HTTP, and serverless functions can
neither hold that socket nor listen on a raw port.

Zero dependencies — Node's built-in `net` and `node:test` only.

## Run it

```bash
cd gateway
npm test                 # 26 tests against the vendor's own example packets

npm run gateway          # terminal 1 — listens on :5100
npm run simulator        # terminal 2 — a fake tag dials in and reports
```

Useful simulator flags:

```bash
node src/simulator.js --count 20 --interval 5      # a herd
node src/simulator.js --stray                       # one animal drifts out of its allocation
node src/simulator.js --host 10.0.0.4 --port 5100   # point at a remote gateway
```

The simulator exists so that **hardware is not on the critical path**. It speaks
the real protocol — boot `INFO`, heartbeats, position packets with mixed
GPS/WiFi/cell fix quality, ACK handling and command replies — so the gateway,
the Supabase schema and the containment engine can all be built and tested
before a SIM arrives.

## Layout

| File | What it is |
|---|---|
| `src/protocol.js` | Codec: framing, parsing, field decoders, command builders |
| `src/gateway.js` | TCP server, socket registry, ACKs, downlink dispatch |
| `src/simulator.js` | Fake tag(s) walking a track around Hatcliffe, Harare |
| `test/protocol.test.js` | Every example packet in the vendor doc, verbatim |
| `tools/usb-watch.js` | Diagnose why a tag shows nothing over USB |

## Things the vendor documentation gets wrong

All of these are covered by tests, because each one would otherwise cost us
positions in the field.

- **The declared length is not always right.** It is the byte length of the
  content in hex and it holds for 15 of the 16 example packets — the `INFO`
  example declares `0x8e` (142) for 138 bytes. We frame on the trailing `$` and
  treat the length as a checksum, logging mismatches as anomalies.
- **IMEI is not always 15 digits.** The heartbeat-ACK example carries 16. Nothing
  asserts a length.
- **The `ALERT` bitfield is under-documented.** Bits 0–2 are defined (low power,
  SOS, vibration) but the vendor's own position example sends `0x0040` — bit 6,
  undefined anywhere. Undocumented bits are surfaced, not discarded.
- **Device time may not be UTC.** The doc says "currently non-UTC due to
  background requirements, can be UTC". Harare is UTC+2; guessing wrong shifts
  every track by two hours. The raw string is always stored alongside the parsed
  value, and interpretation is a constructor option, not an assumption.
- **`REBOOT` and `POWERDN` are never answered.** The doc warns the reply may not
  arrive, so they resolve immediately instead of waiting for a `RET` that will
  never come.

## What the user manual tells us

- **The tags ship pointed at the vendor's platform** — `123.57.45.188:8081`, app "FINDME-EVER".
  Login is the **15-digit IMEI with default password `123456`**, over plain HTTP. That is fine for
  commissioning and useless as a system of record: IMEIs are printed on the tags and sent in clear
  text in every packet, so the credentials are effectively public until changed by hand.
- **The "electronic fence" is a platform feature, not a device one.** Their own advice — "make the
  area range as large as possible" — confirms it is computed from sparse, coarse uploaded positions,
  which is exactly why our engine needs a tolerance band and a dwell period.
- **Vibration sensitivity is the master switch for tracking, not a tuning knob.** "Only when the
  motion sensitivity is not closed will there be a trajectory point upload." A tag left at a
  power-saving default may produce no track at all. Confirm this at commissioning.
- **`SOS` is inert on this model.** The protocol defines it; the manual says "Do not have this
  function, please ignore". `assertSupported()` refuses to send it, because the device may reply
  `RET,SOS,1` and do nothing — which would leave an operator believing it was configured.
- **History on their platform is 30 days.** Another reason the record has to be ours.
- **Boot behaviour**: red light = starting, turns green once it has signal. Charging: flashing =
  charging, solid = full, up to 20 minutes before the indicator appears on a flat battery.

## Not yet decided

- **Where the destination server address is configured.** The protocol has no
  command for it. Until the supplier tells us whether it is SMS, a USB tool, or a
  remote change from their platform, the tags cannot be pointed here at all.
- **Storage.** `consoleSink` is a placeholder. Swapping in a Supabase sink
  requires no change to `protocol.js` or the framing logic.
- **Containment.** Belongs immediately after the insert in `gateway.js`, so a
  breach does not wait on a polling cycle. Not written yet.
