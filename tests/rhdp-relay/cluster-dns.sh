#!/usr/bin/env bash
# apply|remove the DNS operator forwarders that send the OTHER sandbox's apps
# cluster zone (api. and *.apps) to the relay. Required env: OCP_CENTRAL_*, OCP_OSO_*, RELAY_FIP (apply).
set -euo pipefail
action="${1:?apply|remove}"
domain_of() { sed -E 's#^https?://api\.##; s#:[0-9]+/?$##' <<<"$1"; }
HUB_DOMAIN="$(domain_of "$OCP_CENTRAL_SERVER")"; OSO_DOMAIN="$(domain_of "$OCP_OSO_SERVER")"
login() { # side -> kubeconfig path
  local kc; kc="$(mktemp)"; chmod 0600 "$kc"
  case "$1" in
    central) oc login --insecure-skip-tls-verify=true "$OCP_CENTRAL_SERVER" -u "${OCP_CENTRAL_USERNAME:-admin}" -p "$OCP_CENTRAL_PASSWORD" --kubeconfig="$kc" >/dev/null ;;
    oso)     oc login --insecure-skip-tls-verify=true "$OCP_OSO_SERVER"     -u "${OCP_OSO_USERNAME:-admin}"     -p "$OCP_OSO_PASSWORD"     --kubeconfig="$kc" >/dev/null ;;
  esac; echo "$kc"
}
patch() { # kubeconfig name zone
  if [ "$action" = apply ]; then : "${RELAY_FIP:?}"
    oc --kubeconfig="$1" patch dns.operator default --type merge \
      -p "{\"spec\":{\"servers\":[{\"name\":\"$2\",\"zones\":[\"$3\"],\"forwardPlugin\":{\"upstreams\":[\"$RELAY_FIP\"],\"policy\":\"Sequential\"}}]}}"
  else
    oc --kubeconfig="$1" patch dns.operator default --type json -p '[{"op":"remove","path":"/spec/servers"}]' || true
  fi
  oc --kubeconfig="$1" rollout status ds/dns-default -n openshift-dns --timeout=180s
}
kc="$(login central)"; patch "$kc" rhdp-relay-oso "$OSO_DOMAIN"; rm -f "$kc"
kc="$(login oso)";     patch "$kc" rhdp-relay-hub "$HUB_DOMAIN"; rm -f "$kc"
