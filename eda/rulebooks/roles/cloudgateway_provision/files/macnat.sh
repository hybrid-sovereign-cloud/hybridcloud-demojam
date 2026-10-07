#!/bin/bash
# LAB ONLY MAC anti-spoof shim (RHDP hypervisor drops frames whose source MAC is
# not the node NIC's own). Runs on every node: reads this node's NIC MAC from the
# host netns and rewrites VM_MAC <-> NODE_MAC on that NIC with an nft bridge
# table. Harmless on nodes that do not host the gateway VM.
set -u
IF="${UNDERLAY_IFACE:?}"; VM="${VM_MAC:?}"
while true; do
  NODE_MAC=$(nsenter -t 1 -m -n -- cat /sys/class/net/$IF/address 2>/dev/null)
  if [ -z "$NODE_MAC" ]; then echo "$(date -u +%FT%TZ) $IF not present on this node; idle"; sleep 300; continue; fi
  nsenter -t 1 -m -n -- nft -f - <<RULES && echo "$(date -u +%FT%TZ) macnat applied: $VM <-> $NODE_MAC on $IF" || echo "$(date -u +%FT%TZ) nft apply failed (see stderr)"
table bridge fabricmacnat
delete table bridge fabricmacnat
table bridge fabricmacnat {
  chain pre {
    type filter hook prerouting priority -300; policy accept;
    iifname "$IF" ether daddr $NODE_MAC ether daddr set $VM
    iifname "$IF" arp daddr ether $NODE_MAC arp daddr ether set $VM
  }
  chain post {
    type filter hook postrouting priority 0; policy accept;
    oifname "$IF" ether saddr $VM arp saddr ether $VM arp saddr ether set $NODE_MAC
    oifname "$IF" ether saddr $VM ether saddr set $NODE_MAC
  }
}
RULES
  sleep 300
done
