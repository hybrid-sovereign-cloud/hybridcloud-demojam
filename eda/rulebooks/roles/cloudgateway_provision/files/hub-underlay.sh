#!/bin/bash
# Hub node leg of the fabric underlay (CloudGateway openshift path, plan §4;
# proven live 2026-10-08, handover/hub-build/10-hub-underlay-ds.yaml). Runs in a
# privileged hostNetwork+hostPID pod on every hub node and uses the host's
# ip/nft/ovs-vsctl through nsenter. Per node:
#   - VTEP address <hubVtepBlock first three octets>.<node IP last octet> with the
#     WHOLE underlay prefix length on the node bridge (e.g. 192.168.65.30/18 on
#     br-ex). OVN-K's br-ex flows send host-originated traffic straight to the
#     uplink except for subnets configured on br-ex, which go to NORMAL; only then
#     does traffic reach the BGW's localnet port on the node that hosts the BGW VM.
#     The VTEP CR (mode Unmanaged) discovers the address.
#   - static routes via the BGW hub leg for each remote site underlay (SITE_CIDRS,
#     inside the on-link underlay prefix, so they must be more specific) and the BGW
#     WireGuard network. No loopback route: the hub FRRConfiguration peers with
#     the hub-leg address on-link.
#   - optional MAC-NAT shim (MACNAT_ENABLED): a netdev-family nft table on the node
#     NIC that rewrites the BGW hub-leg MAC <-> the NIC MAC, for hypervisors that
#     drop frames whose source MAC is not the node NIC's. Ingress matches every
#     destination the BGW routes (hub leg, loopback, underlay, WireGuard network)
#     except the node's own VTEP. netdev, not bridge: br-ex is OVS, bridge-family
#     hooks never see its traffic.
# Re-applied every REAPPLY_SECONDS (ovs-configuration / NM may rewrite br-ex).
# The applied set is recorded in /run/fabric-hub-underlay.state on the host, so a
# parameter change removes the previous address/routes. Pod restarts and rolling
# updates leave node state in place (no flap); HUB_UNDERLAY_MODE=remove (set by
# cloudgateway_teardown before deleting the DaemonSet) removes everything.
# The pod reports Ready (/tmp/ready) after its first complete pass.
#
# Env (same names as the hand-built DaemonSet): UNDERLAY_IFACE (empty = discover
# the br-ex uplink), UNDERLAY_BRIDGE, BGW_MAC, BGW_IP (hub-leg IP), BGW_LOOPBACK,
# VTEP_BLOCK, UNDERLAY_CIDR, BGW_WG_CIDR, SITE_CIDRS (comma-separated, may be
# empty); plus NODE_IP, MACNAT_ENABLED, HUB_UNDERLAY_MODE, REAPPLY_SECONDS.
set -u
MODE=${HUB_UNDERLAY_MODE:-apply}
BR=${UNDERLAY_BRIDGE:?}; VM=${BGW_MAC:?}; VMIP=${BGW_IP:?}; LO=${BGW_LOOPBACK:?}
BLOCK=${VTEP_BLOCK:?}; UNDERLAY=${UNDERLAY_CIDR:?}; WGNET=${BGW_WG_CIDR:?}; NODE_IP=${NODE_IP:?}
SITES=${SITE_CIDRS:-}; SHIM=${MACNAT_ENABLED:-false}; IF=${UNDERLAY_IFACE:-}
INTERVAL=${REAPPLY_SECONDS:-120}
STATE=/run/fabric-hub-underlay.state
PFX=${BLOCK%.*}; LEN=${UNDERLAY##*/}
VTEP=$PFX.${NODE_IP##*.}; ADDR=$VTEP/$LEN
ROUTES="$(echo "${SITES//,/ } $WGNET" | xargs)"
CUR="ADDR=$ADDR VMIP=$VMIP BR=$BR ROUTES=${ROUTES// /,}"

ns() { nsenter -t 1 -m -n -- "$@"; }
log() { echo "$(date -u +%FT%TZ) hub underlay: $*"; }

# remove_set "<old state line>" ["<new state line>"]: delete the routes and the
# address recorded in the old set that the new set (if any) does not keep, so a
# parameter change (e.g. one more site) does not flap the VTEP address.
remove_set() {
  local ADDR="" VMIP="" BR="" ROUTES="" kv c
  local NADDR="" NVMIP="" NBR="" NROUTES=""
  for kv in $1; do
    case $kv in
      ADDR=*) ADDR=${kv#ADDR=} ;; VMIP=*) VMIP=${kv#VMIP=} ;;
      BR=*) BR=${kv#BR=} ;; ROUTES=*) ROUTES=${kv#ROUTES=} ;;
    esac
  done
  for kv in ${2:-}; do
    case $kv in
      ADDR=*) NADDR=${kv#ADDR=} ;; VMIP=*) NVMIP=${kv#VMIP=} ;;
      BR=*) NBR=${kv#BR=} ;; ROUTES=*) NROUTES=${kv#ROUTES=} ;;
    esac
  done
  if [ -n "$VMIP" ] && [ -n "$BR" ]; then
    for c in ${ROUTES//,/ }; do
      if [ "$VMIP/$BR" = "$NVMIP/$NBR" ] && [[ ",$NROUTES," == *",$c,"* ]]; then continue; fi
      ns ip route del "$c" via "$VMIP" dev "$BR" 2>/dev/null
    done
  fi
  if [ -n "$ADDR" ] && [ -n "$BR" ] && [ "$ADDR/$BR" != "$NADDR/$NBR" ]; then
    ns ip addr del "$ADDR" dev "$BR" 2>/dev/null
  fi
  return 0
}

# The physical uplink of the node bridge (first non-patch OVS port), unless
# UNDERLAY_IFACE (CloudGateway spec.macNatShim.interface) names it.
nic() {
  if [ -n "$IF" ]; then echo "$IF"; return; fi
  ns ovs-vsctl list-ports "$BR" 2>/dev/null | grep -v '^patch-' | head -n 1
}

shim_apply() {
  local dev mac
  dev=$(nic)
  if [ -z "$dev" ] || ! ns test -e "/sys/class/net/$dev/address"; then
    log "MAC-NAT shim: no uplink NIC found on $BR (set CloudGateway spec.macNatShim.interface)"
    return 1
  fi
  mac=$(ns cat "/sys/class/net/$dev/address")
  ns nft -f - <<RULES || return 1
table netdev fabricmacnat
delete table netdev fabricmacnat
table netdev fabricmacnat {
  chain in {
    type filter hook ingress device $dev priority -300; policy accept;
    ether daddr $mac ip daddr { $VMIP, $LO, $UNDERLAY, $WGNET } ip daddr != $VTEP ether daddr set $VM
    ether daddr $mac arp daddr ip $VMIP ether daddr set $VM arp daddr ether set $VM
  }
  chain out {
    type filter hook egress device $dev priority 0; policy accept;
    ether saddr $VM arp saddr ether $VM arp saddr ether set $mac
    ether saddr $VM ether saddr set $mac
  }
}
RULES
  SHIM_NOTE="macnat $VM<->$mac on $dev"
}

apply() {
  local prev ok=0 c
  prev=$(ns cat "$STATE" 2>/dev/null || true)
  if [ -n "$prev" ] && [ "$prev" != "$CUR" ]; then
    log "parameters changed, removing what is no longer wanted from ($prev)"
    remove_set "$prev" "$CUR"
  fi
  ns ip addr replace "$ADDR" dev "$BR" || ok=1
  for c in $ROUTES; do
    ns ip route replace "$c" via "$VMIP" dev "$BR" src "$VTEP" || ok=1
  done
  echo "$CUR" | ns tee "$STATE" >/dev/null
  SHIM_NOTE="macnat off"
  if [ "$SHIM" = "true" ]; then
    shim_apply || ok=1
  else
    ns nft delete table netdev fabricmacnat 2>/dev/null
  fi
  if [ $ok -eq 0 ]; then
    touch /tmp/ready
    log "$ADDR on $BR, routes ${ROUTES:-none} via $VMIP, $SHIM_NOTE"
  else
    log "apply incomplete for $ADDR on $BR, retrying in ${INTERVAL}s"
  fi
}

remove() {
  local prev
  prev=$(ns cat "$STATE" 2>/dev/null || true)
  [ -n "$prev" ] && [ "$prev" != "$CUR" ] && remove_set "$prev"
  remove_set "$CUR"
  ns nft delete table netdev fabricmacnat 2>/dev/null
  ns rm -f "$STATE"
  touch /tmp/ready
  log "removed ($CUR, MAC-NAT shim)"
}

trap 'exit 0' TERM
if [ "$MODE" = "remove" ]; then
  remove
  while true; do sleep 3600 & wait $!; done
fi
while true; do apply; sleep "$INTERVAL" & wait $!; done
