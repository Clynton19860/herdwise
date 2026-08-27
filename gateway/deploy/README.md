# Deploying the gateway

The tag dials a **bare IP on a fixed port**. Two consequences drive everything
here:

1. **The IP must never change.** The tag stores an address, not a hostname (the
   vendor's own platform is reached by IP), so a rebuild on a new address means
   re-provisioning every tag by hand. Allocate a static/elastic IP first.
2. **The port must be open to the world.** Tags roam across carrier NAT, so
   there is no source range to allowlist.

## Provision

```bash
scp -r gateway root@<ip>:/tmp/herdwise-gateway
ssh root@<ip> 'bash /tmp/herdwise-gateway/deploy/provision.sh'
```

Then set `DATABASE_URL` in `/etc/herdwise/gateway.env` (chmod 600) and
`systemctl start herdwise-gateway`.

## Prove the public path before any hardware is involved

From your laptop, point the simulator at the server:

```bash
node src/simulator.js --host <public-ip> --port 5100 --count 3 --interval 10
```

Positions should appear in `journalctl -u herdwise-gateway -f` and land in the
`fixes` table. Do this **before** redirecting a real tag — then any later
failure is definitively the tag, not the network path or our code.

## Sizing

Trivial. Each tag is one idle TCP socket and roughly 368 bytes per position; at
2,000 tags on a 10-minute interval that is about 3 positions a second. The
smallest instance any provider sells is enough. `LimitNOFILE=65536` in the unit
covers the socket count.

## What is deliberately not here yet

- **TLS.** The protocol has none — the tag speaks plaintext and identifies
  itself with an IMEI anyone can read off the ear tag. Mitigate at the network
  layer (private APN with an IP allowlist, if the carrier offers one) plus the
  plausibility checks already in `record_fix()`.
- **A second instance.** While the gateway is down, tags have nowhere to report
  and those positions are lost for good. Before go-live, run two behind the same
  address.
- **Log shipping and alerting.** `journalctl` only, for now. A gateway that dies
  quietly is the worst failure mode this system has.
