#!/usr/bin/env bash
# Print the public NAT address of every node of a cluster, one per line.
# usage: discover-source-ips.sh central|oso
# Uses OCP_CENTRAL_* / OCP_OSO_* from the environment (never printed).
set -euo pipefail
side="${1:?central|oso}"
case "$side" in
  central) server="$OCP_CENTRAL_SERVER"; user="${OCP_CENTRAL_USERNAME:-admin}"; pass="$OCP_CENTRAL_PASSWORD" ;;
  oso)     server="$OCP_OSO_SERVER";     user="${OCP_OSO_USERNAME:-admin}";     pass="$OCP_OSO_PASSWORD" ;;
  *) echo "usage: $0 central|oso" >&2; exit 2 ;;
esac
kc="$(mktemp)"; trap 'rm -f "$kc"' EXIT; chmod 0600 "$kc"
oc login --insecure-skip-tls-verify=true "$server" -u "$user" -p "$pass" --kubeconfig="$kc" >/dev/null
for node in $(oc --kubeconfig="$kc" get nodes -o name); do
  oc --kubeconfig="$kc" debug "$node" -q -- chroot /host curl -4 -s -m 10 https://api.ipify.org 2>/dev/null | tail -1
  echo
done | sed '/^$/d' | sort -u
