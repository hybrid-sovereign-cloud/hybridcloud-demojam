#!/bin/bash
# Bring up hostNetwork WireGuard for fabric VTEP underlay (hub or spoke).
# Expects: wg in PATH (or /binaries/wg), ip from iproute2, privileged + hostNetwork.
set -euo pipefail
export PATH="/binaries:/usr/lib/frr:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
IFACE="${WG_IFACE:-wg0}"
CONF="${WG_CONF:-/etc/wireguard/wg0.conf}"
ADDR="${WG_ADDRESS:?WG_ADDRESS required}"
ROUTES="${WG_ROUTES:-}"

WG_BIN="$(command -v wg || true)"
IP_BIN="$(command -v ip || true)"
if [ -z "$WG_BIN" ]; then echo "wg binary missing" >&2; exit 1; fi
if [ -z "$IP_BIN" ]; then echo "ip binary missing" >&2; exit 1; fi
echo "using wg=$WG_BIN ip=$IP_BIN"

modprobe wireguard 2>/dev/null || nsenter -t 1 -m -- modprobe wireguard 2>/dev/null || true

$IP_BIN link del "$IFACE" 2>/dev/null || true
$IP_BIN link add "$IFACE" type wireguard
$WG_BIN setconf "$IFACE" "$CONF"
$IP_BIN addr replace "$ADDR" dev "$IFACE"
$IP_BIN link set "$IFACE" up

# Hub must forward between spoke peers; spokes must accept VTEP-sourced replies.
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
sysctl -w net.ipv4.conf.all.rp_filter=0 >/dev/null 2>&1 || true
sysctl -w net.ipv4.conf.default.rp_filter=0 >/dev/null 2>&1 || true
sysctl -w "net.ipv4.conf.${IFACE}.rp_filter=0" >/dev/null 2>&1 || true

for cidr in $ROUTES; do
  $IP_BIN route replace "$cidr" dev "$IFACE" || true
done

echo "WireGuard $IFACE up addr=$ADDR"
$WG_BIN show "$IFACE"
exec sleep infinity
