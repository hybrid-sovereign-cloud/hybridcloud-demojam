#!/bin/bash
# Spoke-side SSH TUN + route bring-up (systemd). Reuses tun0 if already present.
set -euo pipefail
ENV_FILE="${ENV_FILE:-/etc/fabric-ssh-tun.env}"
# shellcheck disable=SC1090
source "$ENV_FILE"
HUB_TUN_IP="${HUB_TUN%/*}"
KEY=/etc/fabric-ssh-tun/id_ed25519

mkdir -p /dev/net
[ -c /dev/net/tun ] || mknod /dev/net/tun c 10 200 2>/dev/null || true

apply_addrs() {
  ip addr replace "${SPOKE_TUN}" dev tun0
  ip link set tun0 up
  ip addr replace "${SPOKE_VTEP}/32" dev lo
  for cidr in ${SPOKE_ROUTES}; do
    ip route replace "$cidr" via "$HUB_TUN_IP" dev tun0 || true
  done
}

if ip link show tun0 >/dev/null 2>&1; then
  apply_addrs
  # Keep process alive while monitoring
  while ip link show tun0 >/dev/null 2>&1; do sleep 15; apply_addrs; done
  exit 1
fi

pkill -f "ssh .*${HUB_ENDPOINT}.*-w" 2>/dev/null || true
sleep 1
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -i "$KEY" -N -w 0:0 -p "${HUB_PORT}" "root@${HUB_ENDPOINT}" &
SSH_PID=$!
for _ in $(seq 1 40); do
  ip link show tun0 >/dev/null 2>&1 && break
  sleep 1
done
apply_addrs
wait "$SSH_PID"
