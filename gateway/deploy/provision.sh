#!/usr/bin/env bash
#
# Provision a fresh Ubuntu/Debian VPS as the Herdwise telemetry gateway.
#
#   scp -r gateway root@<ip>:/tmp/herdwise-gateway
#   ssh root@<ip> 'bash /tmp/herdwise-gateway/deploy/provision.sh'
#
# Idempotent: safe to re-run to upgrade an existing install.
#
# The tag reaches this box by raw IP on a fixed port, so two things must be true
# and neither is the default: the IP must never change, and the port must be
# open to the whole internet (tags roam across carrier NAT — you cannot
# allowlist their addresses).

set -euo pipefail

PORT="${GATEWAY_PORT:-5100}"
APP_DIR=/opt/herdwise/gateway
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$1"; }

[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }

log "Installing Node.js 22 and tools"
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y --no-install-recommends ufw ca-certificates curl

log "Creating the herdwise service account"
id -u herdwise &>/dev/null || useradd --system --home /opt/herdwise --shell /usr/sbin/nologin herdwise
install -d -o herdwise -g herdwise /opt/herdwise /var/log/herdwise
install -d -o root -g root -m 750 /etc/herdwise

log "Installing the gateway to $APP_DIR"
install -d -o herdwise -g herdwise "$APP_DIR"
cp -r "$SRC_DIR"/{src,package.json} "$APP_DIR"/
[[ -f "$SRC_DIR/package-lock.json" ]] && cp "$SRC_DIR/package-lock.json" "$APP_DIR"/
chown -R herdwise:herdwise "$APP_DIR"
cd "$APP_DIR"
sudo -u herdwise npm ci --omit=dev 2>/dev/null || sudo -u herdwise npm install --omit=dev

log "Configuration"
if [[ ! -f /etc/herdwise/gateway.env ]]; then
  cp "$SRC_DIR/deploy/gateway.env.example" /etc/herdwise/gateway.env
  chmod 600 /etc/herdwise/gateway.env
  warn "Edit /etc/herdwise/gateway.env and set DATABASE_URL before starting."
fi

log "Firewall: SSH plus the tag port"
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp
ufw allow "${PORT}/tcp" comment 'HCS048 tags'
ufw --force enable

log "Installing the service"
cp "$SRC_DIR/deploy/herdwise-gateway.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable herdwise-gateway

if grep -q 'user:password@host' /etc/herdwise/gateway.env; then
  warn "Not starting: DATABASE_URL is still the placeholder."
  warn "Edit /etc/herdwise/gateway.env, then: systemctl start herdwise-gateway"
else
  systemctl restart herdwise-gateway
  sleep 2
  systemctl is-active --quiet herdwise-gateway \
    && log "Gateway running on port ${PORT}" \
    || { warn "Failed to start — journalctl -u herdwise-gateway -n 50"; exit 1; }
fi

IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo '<this-server>')"
cat <<EOF

  ────────────────────────────────────────────────────────────
   Point the tags at:   ${IP}:${PORT}

   This address must NEVER change. The tag stores a bare IP,
   so a rebuild on a new address means re-provisioning every
   tag by hand. Reserve/allocate a static IP now.

   Logs     journalctl -u herdwise-gateway -f
   Restart  systemctl restart herdwise-gateway
   Verify   node src/simulator.js --host ${IP} --port ${PORT}
  ────────────────────────────────────────────────────────────
EOF
