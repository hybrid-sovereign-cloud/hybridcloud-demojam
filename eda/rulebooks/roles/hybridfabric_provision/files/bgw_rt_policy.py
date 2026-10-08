#!/usr/bin/env python3
# Per-site RT policy for the border gateway (plan §3.2.5, decision 6).
#
# Every spoke still peers with the BGW route reflector, but each site now lands
# in its own FRR peer-group (one `bgp listen range` set per site) with an
# l2vpn-evpn route-map that accepts (in) and reflects (out) only the RTs of the
# HybridNetworks that have a NetworkPlacement on that site. The fabric-wide
# ledger allow-list still applies: a site RT that is not in the ledger is dropped.
#
# Sites:
#   HUB      hub underlay (HybridFabric.spec.underlay.cidr) minus every remote site
#            underlay; placements on CloudVirt (hub CNV) and, until the cutover
#            removes them, PlatformOpenshift.
#   SITE-<g> one per WireGuard CloudGateway <g>: its siteUnderlay.cidr; placements
#            on a CloudOSO whose cloudRef (deprecated: name == openstackCloudOSORef)
#            is the gateway's site.
#   TUNNEL   the BGW tunnel subnet (no BGP speakers expected): EVPN denied.
# Hub CNV (localnet fabric, HUB_VTEP_BLOCK set): a CloudVirt placement also adds
# the macVRF RT <asn>:<L2VNI_OFFSET + vni> to HUB (Layer2 CUDN Type-2 routes), and
# the HUB listen ranges must cover the hub VTEP block (hub node VTEPs peer from it).
# FRR rejects overlapping listen ranges, so HUB is the underlay with the site
# CIDRs carved out (ipaddress.address_exclude).
#
# Inputs (files, JSON): GATEWAYS_FILE [{name, siteCidr, site, legacyCloudOSO}],
#   PLACEMENTS_FILE, NETWORKS_FILE, CLOUDOSOS_FILE (k8s list items).
# Env: FABRIC, UNDERLAY_CIDR, WG_NETWORK, ALLOWED_RTS (JSON list), ASN,
#   L2VNI_OFFSET, HUB_VTEP_BLOCK (localnet fabrics only).
# Output: {"groups": [{name, kind, ranges, rts, gateway}], "spokesRanges": [...], "errors": [...]}
import ipaddress
import json
import os
import re
import sys


def N(c):
    return ipaddress.ip_network(c, strict=False)


def carve(base, holes):
    """base minus every hole that lies inside it; returns sorted disjoint CIDRs."""
    parts = [N(base)]
    for h in holes:
        h = N(h)
        nxt = []
        for p in parts:
            if p.version != h.version or not p.overlaps(h):
                nxt.append(p)
            elif h.subnet_of(p):
                nxt.extend(p.address_exclude(h))
            # else p lies inside the hole: drop it
        parts = nxt
    return [str(p) for p in sorted(parts)]


def pg_name(prefix, name):
    return prefix + re.sub(r"[^A-Za-z0-9_-]", "-", name)


def l2_rt(rt, offset):
    a, _, v = rt.partition(":")
    return "%s:%d" % (a, offset + int(v)) if v.isdigit() else ""


def plan(fabric, underlay, wg_net, allowed, gateways, placements, networks, cloudosos,
         l2_offset=0, hub_block=""):
    errors = []
    allowed = set(allowed)
    nets = {}
    for hn in networks:
        md = hn.get("metadata") or {}
        st = hn.get("status") or {}
        if st.get("fabric") and st.get("fabric") != fabric:
            continue
        rt = st.get("canonicalRt") or ""
        if rt:
            nets[(md.get("namespace"), md.get("name"))] = rt
    osos = {}
    for o in cloudosos:
        md = o.get("metadata") or {}
        osos[(md.get("namespace"), md.get("name"))] = ((o.get("spec") or {}).get("cloudRef") or {}).get("name") or ""

    # Sites; drop a site CIDR that overlaps an earlier one (FRR would reject it).
    sites = []
    for g in sorted(gateways, key=lambda x: x["name"]):
        try:
            cidr = N(g["siteCidr"])
        except (KeyError, ValueError):
            errors.append("gateway %s: bad siteCidr %r" % (g.get("name"), g.get("siteCidr")))
            continue
        clash = [s for s in sites if N(s["siteCidr"]).overlaps(cidr)]
        if clash:
            errors.append("gateway %s siteCidr %s overlaps %s; no per-site policy for it"
                          % (g["name"], cidr, clash[0]["name"]))
            continue
        sites.append(dict(g, siteCidr=str(cidr)))

    hub_rts, site_rts = set(), {s["name"]: set() for s in sites}
    for p in placements:
        md = p.get("metadata") or {}
        spec = p.get("spec") or {}
        if md.get("deletionTimestamp") or spec.get("state") == "absent":
            continue
        rt = nets.get((md.get("namespace"), spec.get("network")))
        if not rt or rt not in allowed:
            continue
        backend = spec.get("backend") or {}
        kind, name = backend.get("kind"), backend.get("name")
        if kind in ("CloudVirt", "PlatformOpenshift"):
            hub_rts.add(rt)
            if kind == "CloudVirt" and hub_block and l2_offset:
                l2 = l2_rt(rt, l2_offset)
                if l2 and l2 in allowed:
                    hub_rts.add(l2)
        elif kind == "CloudOSO":
            infra = osos.get((md.get("namespace"), name), "")
            for s in sites:
                if (infra and s.get("site") == infra) or (not infra and s.get("legacyCloudOSO") == name):
                    site_rts[s["name"]].add(rt)

    def key(rt):
        a, _, v = rt.partition(":")
        return (a, int(v) if v.isdigit() else v)

    groups = []
    hub_ranges = carve(underlay, [s["siteCidr"] for s in sites]) if underlay else []
    groups.append({"name": "HUB", "kind": "hub", "ranges": hub_ranges,
                   "rts": sorted(hub_rts, key=key), "gateway": ""})
    if hub_block and not any(N(hub_block).subnet_of(N(r)) for r in hub_ranges):
        errors.append("hub VTEP block %s is not inside the HUB listen ranges %s (a site underlay overlaps it)"
                      % (hub_block, hub_ranges))
    for s in sites:
        groups.append({"name": pg_name("SITE-", s["name"]), "kind": "site", "ranges": [s["siteCidr"]],
                       "rts": sorted(site_rts[s["name"]], key=key), "gateway": s["name"]})
    if wg_net:
        taken = [r for g in groups for r in g["ranges"]]
        if any(N(wg_net).overlaps(N(r)) for r in taken):
            errors.append("tunnel subnet %s overlaps an underlay range; not listened on" % wg_net)
        else:
            groups.append({"name": "TUNNEL", "kind": "tunnel", "ranges": [str(N(wg_net))],
                           "rts": [], "gateway": ""})
    # Single-group fallback (bgw_rt_policy fabric/off): FRR rejects overlapping
    # listen ranges, so collapse them (a site inside the hub underlay folds in).
    every = [N(r) for r in ([underlay] if underlay else []) + [s["siteCidr"] for s in sites]
             + ([wg_net] if wg_net else [])]
    spokes = [str(n) for n in ipaddress.collapse_addresses([n for n in every if n.version == 4])]
    return {"groups": groups, "spokesRanges": spokes, "errors": errors}


def load(env):
    with open(os.environ[env]) as f:
        return json.load(f)


def main():
    out = plan(
        os.environ["FABRIC"],
        os.environ.get("UNDERLAY_CIDR", ""),
        os.environ.get("WG_NETWORK", ""),
        json.loads(os.environ.get("ALLOWED_RTS") or "[]"),
        load("GATEWAYS_FILE"),
        load("PLACEMENTS_FILE"),
        load("NETWORKS_FILE"),
        load("CLOUDOSOS_FILE"),
        int(os.environ.get("L2VNI_OFFSET") or 0),
        os.environ.get("HUB_VTEP_BLOCK", ""),
    )
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
