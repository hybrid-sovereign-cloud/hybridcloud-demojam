#!/bin/bash
# Copy BGW dynamic config (wg0.conf, dnsmasq, frr.conf, nftables) from the
# <bgw>-config Secret, attached to the VM as a disk with serial "fabriccfg".
# Runs at every boot before the services start, so EDA updates the Secret and
# restarts the VMI to roll out new peers / listen ranges / DHCP routes.
# No-op when the disk is absent (cloud-init first-boot copies stay in place).
set -u
DEV=/dev/disk/by-id/virtio-fabriccfg
for _ in $(seq 1 15); do [ -e "$DEV" ] && break; sleep 1; done
if [ ! -e "$DEV" ]; then
  echo "fabric-config-sync: $DEV not present, keeping current config"
  exit 0
fi
MNT=$(mktemp -d)
if ! mount -o ro "$DEV" "$MNT"; then
  echo "fabric-config-sync: mount failed, keeping current config"
  rmdir "$MNT"
  exit 0
fi
inst() {
  # inst <file in secret> <dest> <mode> <owner> <group>
  [ -f "$MNT/$1" ] || return 0
  if ! cmp -s "$MNT/$1" "$2"; then
    install -D -m "$3" -o "$4" -g "$5" "$MNT/$1" "$2"
    echo "fabric-config-sync: updated $2"
  fi
}
inst wg0.conf /etc/wireguard/wg0.conf 0600 root root
inst dnsmasq-fabric.conf /etc/dnsmasq.d/fabric.conf 0644 root root
inst fabric.nft /etc/sysconfig/nftables.conf 0600 root root
if getent group frr >/dev/null; then
  inst frr.conf /etc/frr/frr.conf 0640 frr frr
fi
umount "$MNT"
rmdir "$MNT"
exit 0
