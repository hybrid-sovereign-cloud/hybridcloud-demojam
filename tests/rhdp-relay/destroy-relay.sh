#!/usr/bin/env bash
# Remove everything build-relay.sh created. Env: OS_CLOUD, RELAY_NAME (shc-rhdp-relay)
set -euo pipefail
: "${OS_CLOUD:?}"; N="${RELAY_NAME:-shc-rhdp-relay}"
for fip in $(openstack floating ip list --description "$N" -f value -c 'Floating IP Address' 2>/dev/null || true); do
  openstack floating ip delete "$fip" || true
done
openstack server delete "$N" --wait || true
openstack router remove subnet "$N" "$N" || true
openstack router delete "$N" || true
openstack subnet delete "$N" || true
openstack network delete "$N" || true
openstack security group delete "$N" || true
