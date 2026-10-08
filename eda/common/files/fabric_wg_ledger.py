#!/usr/bin/env python3
# WireGuard tunnel address ledger for site gateways (plan §3.2.5).
#
# Allocations live next to the VNI ledger, in ConfigMap fabric-numbering-<fabric>
# key `wgAddresses` (JSON {"<CloudGateway>": "<ip>/32"}). A gateway that sets
# spec.wireguard.address keeps it and never gets a ledger entry.
#
#   fabric_wg_ledger.py allocate   reads GATEWAYS_FILE, allocates, prints JSON
#   fabric_wg_ledger.py release    drops the entry for RELEASE_NAME
#
# Env: CR_API_HOST, CR_TOKEN, CM_NAMESPACE, CM_NAME
#   allocate: GATEWAYS_FILE (JSON list of {name, address, wireguard (bool), deleting (bool)}
#             for every CloudGateway on the fabric), WG_NETWORK (BGW tunnel subnet),
#             WG_RESERVED (JSON list of addresses never handed out, e.g. the BGW wg0),
#             START_OFFSET (first host offset inside WG_NETWORK)
#   release : RELEASE_NAME
# Output: {"addresses": {name: addr}, "changed": bool, "errors": [...]}
# Optimistic concurrency: PUT with the read resourceVersion, retry on 409.
import ipaddress
import json
import os
import sys
import time

import requests
import urllib3

urllib3.disable_warnings()

KEY = "wgAddresses"


def api():
    host = os.environ["CR_API_HOST"].strip()
    if host and not host.startswith(("http://", "https://")):
        host = "https://" + host.lstrip("/")
    url = "%s/api/v1/namespaces/%s/configmaps/%s" % (host, os.environ["CM_NAMESPACE"], os.environ["CM_NAME"])
    return url, {"Authorization": "Bearer %s" % os.environ["CR_TOKEN"]}


def plan_allocate(ledger, gateways, network, reserved, start_offset):
    """Return (new_ledger, addresses, errors). Pure function (unit-testable)."""
    net = ipaddress.ip_network(network, strict=False)
    names = {g["name"] for g in gateways}
    spec_addr = {g["name"]: g["address"] for g in gateways if g.get("address")}
    out = {}
    errors = []
    # Drop entries of gateways that no longer exist or now set spec.wireguard.address.
    new = {k: v for k, v in ledger.items() if k in names and k not in spec_addr}
    used = set()
    for a in list(spec_addr.values()) + list(new.values()) + list(reserved):
        try:
            used.add(ipaddress.ip_interface(a).ip)
        except ValueError:
            errors.append("unparsable address %r" % a)
    for name, a in spec_addr.items():
        out[name] = a
    for g in sorted(gateways, key=lambda x: x["name"]):
        n = g["name"]
        if n in spec_addr:
            continue
        if n in new:
            out[n] = new[n]
            continue
        if not g.get("wireguard") or g.get("deleting"):
            continue
        hosts = list(net.hosts())[max(0, int(start_offset) - 1):]
        free = next((h for h in hosts if h not in used), None)
        if free is None:
            errors.append("no free address in %s for %s" % (net, n))
            continue
        used.add(free)
        new[n] = "%s/32" % free
        out[n] = new[n]
    # Spec addresses that collide with each other are reported, not changed.
    seen = {}
    for n, a in sorted(spec_addr.items()):
        ip = ipaddress.ip_interface(a).ip
        if ip in seen:
            errors.append("%s and %s both use %s" % (seen[ip], n, ip))
        seen[ip] = n
    return new, out, errors


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "allocate"
    url, headers = api()
    gateways = []
    if mode == "allocate":
        with open(os.environ["GATEWAYS_FILE"]) as f:
            gateways = json.load(f)
    for _ in range(10):
        resp = requests.get(url, headers=headers, verify=False, timeout=30)
        if resp.status_code == 404:
            print(json.dumps({"addresses": {g["name"]: g["address"] for g in gateways if g.get("address")},
                              "changed": False,
                              "errors": ["ledger ConfigMap %s not found (HybridFabric not reconciled yet)"
                                         % os.environ["CM_NAME"]]}))
            return 0
        if resp.status_code != 200:
            print("ERROR reading %s: %s %s" % (url, resp.status_code, resp.text[:300]), file=sys.stderr)
            return 1
        cm = resp.json()
        data = cm.get("data") or {}
        ledger = json.loads(data.get(KEY) or "{}")
        if mode == "release":
            name = os.environ["RELEASE_NAME"]
            new = {k: v for k, v in ledger.items() if k != name}
            out, errors = new, []
        else:
            new, out, errors = plan_allocate(
                ledger, gateways, os.environ["WG_NETWORK"],
                json.loads(os.environ.get("WG_RESERVED") or "[]"),
                int(os.environ.get("START_OFFSET") or "10"))
        if new == ledger:
            print(json.dumps({"addresses": out, "changed": False, "errors": errors}))
            return 0
        data[KEY] = json.dumps(new, sort_keys=True)
        cm["data"] = data
        put = requests.put(url, headers=dict(headers, **{"Content-Type": "application/json"}),
                           data=json.dumps(cm), verify=False, timeout=30)
        if put.status_code == 409:
            time.sleep(1)
            continue
        if put.status_code not in (200, 201):
            print("ERROR writing %s: %s %s" % (url, put.status_code, put.text[:300]), file=sys.stderr)
            return 1
        print(json.dumps({"addresses": out, "changed": True, "errors": errors}))
        return 0
    print("ERROR: ledger update kept conflicting (409) after 10 attempts", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
