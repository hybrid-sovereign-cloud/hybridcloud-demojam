#!/usr/bin/env bash
# Create the RHDP inter-sandbox TLS relay on an OpenStack cloud (see README.md).
# Required env: OS_CLOUD, OCP_CENTRAL_SERVER, OCP_OSO_SERVER, HUB_SOURCE_IPS,
#               OSO_SOURCE_IPS, RELAY_KEYPAIR
# Optional env: RELAY_NAME (shc-rhdp-relay), RELAY_EXTERNAL_NET (internet),
#               RELAY_IMAGE (alma-10), RELAY_FLAVOR (b1.small),
#               RELAY_SUBNET (10.250.250.0/24), RELAY_ADMIN_CIDRS (none)
set -euo pipefail
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${OS_CLOUD:?}" "${OCP_CENTRAL_SERVER:?}" "${OCP_OSO_SERVER:?}" "${HUB_SOURCE_IPS:?}" "${OSO_SOURCE_IPS:?}" "${RELAY_KEYPAIR:?}"
N="${RELAY_NAME:-shc-rhdp-relay}"
EXT="${RELAY_EXTERNAL_NET:-internet}"
IMAGE="${RELAY_IMAGE:-alma-10}"; FLAVOR="${RELAY_FLAVOR:-b1.small}"; SUBNET="${RELAY_SUBNET:-10.250.250.0/24}"
ADMIN="${RELAY_ADMIN_CIDRS:-}"

domain_of() { sed -E 's#^https?://api\.##; s#:[0-9]+/?$##' <<<"$1"; }
HUB_DOMAIN="$(domain_of "$OCP_CENTRAL_SERVER")"; OSO_DOMAIN="$(domain_of "$OCP_OSO_SERVER")"
HUB_VIP="$(dig +short "api.$HUB_DOMAIN" | head -1)"; OSO_VIP="$(dig +short "api.$OSO_DOMAIN" | head -1)"
[ -n "$HUB_VIP" ] && [ -n "$OSO_VIP" ] || { echo "could not resolve api.$HUB_DOMAIN / api.$OSO_DOMAIN" >&2; exit 1; }
echo "hub   apps.$HUB_DOMAIN -> $HUB_VIP (sources: $HUB_SOURCE_IPS)"
echo "oso   apps.$OSO_DOMAIN -> $OSO_VIP (sources: $OSO_SOURCE_IPS)"

openstack network create "$N" --description "RHDP inter-sandbox TLS relay" -f value -c id >/dev/null
openstack subnet create "$N" --network "$N" --subnet-range "$SUBNET" --dns-nameserver 1.1.1.1 --dns-nameserver 8.8.8.8 -f value -c id >/dev/null
openstack router create "$N" --external-gateway "$EXT" -f value -c id >/dev/null
openstack router add subnet "$N" "$N"
SG="$(openstack security group create "$N" --description "RHDP relay: 443/53 from sandbox NAT IPs" -f value -c id)"
for ip in $HUB_SOURCE_IPS $OSO_SOURCE_IPS; do
  openstack security group rule create "$SG" --ingress --protocol tcp --dst-port 443  --remote-ip "$ip/32" >/dev/null
  openstack security group rule create "$SG" --ingress --protocol tcp --dst-port 6443 --remote-ip "$ip/32" >/dev/null
  openstack security group rule create "$SG" --ingress --protocol udp --dst-port 53  --remote-ip "$ip/32" >/dev/null
  openstack security group rule create "$SG" --ingress --protocol tcp --dst-port 53  --remote-ip "$ip/32" >/dev/null
done
for cidr in $ADMIN; do
  for p in "tcp 22" "tcp 443" "tcp 6443" "tcp 53" "udp 53"; do set -- $p
    openstack security group rule create "$SG" --ingress --protocol "$1" --dst-port "$2" --remote-ip "$cidr" >/dev/null
  done
done
openstack security group rule create "$SG" --ingress --protocol icmp >/dev/null
FIP="$(openstack floating ip create "$EXT" --description "$N" -f value -c floating_ip_address)"

ud="$(mktemp)"; trap 'rm -f "$ud"' EXIT
sed -e "s#__FIP__#$FIP#g" -e "s#__HUB_DOMAIN__#$HUB_DOMAIN#g" -e "s#__OSO_DOMAIN__#$OSO_DOMAIN#g" -e "s#__HUB_APPS__#apps.$HUB_DOMAIN#g" -e "s#__OSO_APPS__#apps.$OSO_DOMAIN#g" \
    -e "s#__HUB_VIP__#$HUB_VIP#g" -e "s#__OSO_VIP__#$OSO_VIP#g" \
    -e "s#__HUB_SRC__#$HUB_SOURCE_IPS#g" -e "s#__OSO_SRC__#$OSO_SOURCE_IPS#g" \
    -e "s#__ADMIN_SRC__#${ADMIN:-127.0.0.1}#g" "$here/cloud-init.yaml.tpl" > "$ud"
openstack server create "$N" --image "$IMAGE" --flavor "$FLAVOR" --network "$N" --security-group "$SG" \
  --key-name "$RELAY_KEYPAIR" --user-data "$ud" --wait -f value -c status
openstack server add floating ip "$N" "$FIP"
echo "RELAY_FIP=$FIP"
