#!/usr/bin/env python3
# Ownership / drift check for the hub CNV EVPN backend (backend_cloudvirt_evpn.yml).
#
# Namespaces (plan §2.2): a missing one is created by the role; an existing one is
# adopted only when this entity owns it for this network and it carries the
# primary-UDN label (that label only works when set at creation). Missing owner
# labels (cloudvirt, networkplacement; e.g. a hand-built namespace) are filled in.
# CUDN: one hub CUDN per network name, owned by one placement of one entity.
# OVN-K makes spec.network immutable, so a drift is refused with a clear reason.
#
# Env: ENTITY, NETWORK, CLOUDVIRT, OWNER, NS_FILE ([{item, resources}] from a
#      k8s_info loop), CUDN_FILE (desired CUDN), CUDN_HAVE (k8s_info resources).
# Output: {"errors": [...], "create": [...], "adopt": [...], "cudn": absent|present|drift}
import json
import os
import sys

UDN = "k8s.ovn.org/primary-user-defined-network"
P = "hybridsovereign.redhat/"


def pick(n):
    l2, ev = n.get("layer2") or {}, n.get("evpn") or {}
    return {"topology": n.get("topology"), "role": l2.get("role"),
            "subnets": sorted(l2.get("subnets") or []), "mtu": l2.get("mtu"),
            "ipam": (l2.get("ipam") or {}).get("lifecycle"), "transport": n.get("transport"),
            "vtep": ev.get("vtep"), "ipVRF": ev.get("ipVRF"), "macVRF": ev.get("macVRF")}


def check(ent, net, cv, me, ns_results, want, have_list):
    errors, create, adopt = [], [], []
    for r in ns_results:
        name, res = r["item"], r.get("resources") or []
        if not res:
            create.append(name)
            continue
        lb = res[0]["metadata"].get("labels") or {}
        why = []
        if lb.get(P + "entity") != ent:
            why.append("entity %r" % lb.get(P + "entity"))
        if lb.get(P + "hybridnetwork") != net:
            why.append("network %r" % lb.get(P + "hybridnetwork"))
        if UDN not in lb:
            why.append("no primary-UDN label (it must be set at creation)")
        if lb.get(P + "cloudvirt", cv) != cv:
            why.append("CloudVirt %r" % lb.get(P + "cloudvirt"))
        if lb.get(P + "networkplacement", me) != me:
            why.append("placement %r" % lb.get(P + "networkplacement"))
        if why:
            errors.append("namespace %s exists and is not this placement's (%s)" % (name, ", ".join(why)))
        else:
            adopt.append(name)
    cudn = "absent"
    have = have_list[0] if have_list else None
    if have:
        name = have["metadata"]["name"]
        lb = have["metadata"].get("labels") or {}
        if lb.get(P + "entity", ent) != ent or lb.get(P + "network", net) != net:
            errors.append("ClusterUserDefinedNetwork %s belongs to entity %r network %r"
                          % (name, lb.get(P + "entity"), lb.get(P + "network")))
            cudn = "foreign"
        elif lb.get(P + "networkplacement", me) != me:
            errors.append("ClusterUserDefinedNetwork %s belongs to NetworkPlacement %s (one hub placement per network)"
                          % (name, lb.get(P + "networkplacement")))
            cudn = "foreign"
        else:
            h = pick((have.get("spec") or {}).get("network") or {})
            w = pick(want["spec"]["network"])
            diff = sorted((k, h[k], w[k]) for k in w if h[k] != w[k])
            cudn = "present"
            if diff:
                cudn = "drift"
                errors.append("ClusterUserDefinedNetwork %s spec.network is immutable and differs (%s); delete "
                              "the placement and recreate it to change prefixes, MTU or VNIs"
                              % (name, "; ".join("%s %s -> %s" % d for d in diff)))
    return {"errors": errors, "create": create, "adopt": adopt, "cudn": cudn}


def main():
    E = os.environ
    with open(E["NS_FILE"]) as f:
        ns_results = json.load(f)
    with open(E["CUDN_FILE"]) as f:
        want = json.load(f)
    with open(E["CUDN_HAVE"]) as f:
        have = json.load(f)
    print(json.dumps(check(E["ENTITY"], E["NETWORK"], E["CLOUDVIRT"], E["OWNER"], ns_results, want, have)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
