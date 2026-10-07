# Plan / validate PlatformOpenshift cluster CIDRs (design/fabric.md §16).
# Embedded by common/tasks/platformopenshift_fabric_ipam.yml (python3 heredoc).
# Inputs (env, JSON): SOURCE (recorded|explicit|allocate|legacy-default),
#   RECORDED, EXPLICIT, IPAM, HUB_NETWORK, PEERS, SELF_NAME, SELF_NAMESPACE.
# Output: JSON {clusterNetwork, serviceNetwork, machineNetwork, allocationSource,
#   legacy, conflicts[], message}.
#
# Rules (cluster/service CIDRs are never advertised into the fabric):
#   * cluster + service CIDRs must not overlap the hub's own cluster/service CIDRs
#     (HyperShift on KubeVirt).
#   * cluster + service CIDRs must not overlap other clusters' cluster/service
#     CIDRs when ipam.denyOverlappingClusterCidrs (default true).
#   * machine networks are fabric underlay (machineNetworkPool) and are always
#     unique across clusters.
#   * no check against overlay (HybridNetwork) prefixes: overlay uniqueness is per
#     HybridNetwork and is enforced by NetworkPlacement.
#   * cluster/service CIDRs outside the fabric pools => legacy=True
#     (ipamCondition LegacyClusterCidrs); the cluster still joins.
import ipaddress
import json
import os

src = os.environ["SOURCE"]
recorded = json.loads(os.environ.get("RECORDED") or "{}")
explicit = json.loads(os.environ.get("EXPLICIT") or "{}")
ipam = json.loads(os.environ.get("IPAM") or "{}")
hub = json.loads(os.environ.get("HUB_NETWORK") or "{}")
peers = json.loads(os.environ.get("PEERS") or "[]")
me = (os.environ["SELF_NAMESPACE"], os.environ["SELF_NAME"])

# Greenfield defaults: CG-NAT 100.64.0.0/10 for pod and service ranges.
cluster_pool = (ipam.get("clusterNetworkPool") or {}).get("cidr") or "100.64.0.0/11"
cluster_plen = int((ipam.get("clusterNetworkPool") or {}).get("blockPrefixLength") or 14)
service_pool = (ipam.get("serviceNetworkPool") or {}).get("cidr") or "100.96.0.0/11"
service_plen = int((ipam.get("serviceNetworkPool") or {}).get("blockPrefixLength") or 16)
machine_pool = (ipam.get("machineNetworkPool") or {}).get("cidr") or ""
machine_plen = int((ipam.get("machineNetworkPool") or {}).get("blockPrefixLength") or 24)
deny_peer_overlap = bool(ipam.get("denyOverlappingClusterCidrs", True))


def N(c):
    return ipaddress.ip_network(c, strict=False)


def cidrs(lst):
    out = []
    for x in lst or []:
        c = x.get("cidr") if isinstance(x, dict) else x
        if c:
            out.append(str(N(c)))
    return out


hub_spec = hub.get("status") or hub.get("spec") or {}
hub_cidrs = cidrs(hub_spec.get("clusterNetwork")) + cidrs(hub_spec.get("serviceNetwork"))

peer_cs, peer_machine = [], []
for p in peers:
    md = p.get("metadata") or {}
    if (md.get("namespace"), md.get("name")) == me:
        continue
    net = (p.get("status") or {}).get("networking") or {}
    tag = "%s/%s" % (md.get("namespace"), md.get("name"))
    peer_cs += [(c, tag) for c in cidrs(net.get("clusterNetwork")) + cidrs(net.get("serviceNetwork"))]
    peer_machine += [(c, tag) for c in cidrs(net.get("machineNetwork"))]


def clashes(cidr, machine=False):
    hits = []
    if not machine:
        hits += ["hub %s" % h for h in hub_cidrs if N(cidr).overlaps(N(h))]
        if deny_peer_overlap:
            hits += ["%s %s" % (t, c) for c, t in peer_cs if N(cidr).overlaps(N(c))]
    else:
        hits += ["%s machine %s" % (t, c) for c, t in peer_machine if N(cidr).overlaps(N(c))]
    return hits


def allocate(pool, plen, taken, machine=False):
    for net in N(pool).subnets(new_prefix=plen):
        c = str(net)
        if clashes(c, machine) or any(net.overlaps(N(t)) for t in taken):
            continue
        return c
    raise SystemExit("IPAM exhausted in %s for /%d" % (pool, plen))


if src == "recorded":
    cl, sv, mc = cidrs(recorded.get("clusterNetwork")), cidrs(recorded.get("serviceNetwork")), cidrs(recorded.get("machineNetwork"))
    source = recorded.get("allocationSource") or "fabric-ipam"
elif src == "explicit":
    cl, sv, mc = cidrs(explicit.get("clusterNetwork")), cidrs(explicit.get("serviceNetwork")), cidrs(explicit.get("machineNetwork"))
    source = "explicit"
elif src == "allocate":
    cl = [allocate(cluster_pool, cluster_plen, [])]
    sv = [allocate(service_pool, service_plen, cl)]
    mc = [allocate(machine_pool, machine_plen, cl + sv, machine=True)] if machine_pool else []
    source = "fabric-ipam"
else:  # allocateFromFabric false and nothing recorded: HyperShift defaults
    cl, sv, mc = ["10.132.0.0/14"], ["172.31.0.0/16"], []
    source = "legacy-default"

conflicts = []
own = cl + sv + mc
for i, a in enumerate(own):
    for b in own[i + 1:]:
        if N(a).overlaps(N(b)):
            conflicts.append("self-overlap %s vs %s" % (a, b))
for c in cl + sv:
    conflicts += ["%s overlaps %s" % (c, h) for h in clashes(c)]
for c in mc:
    conflicts += ["%s overlaps %s" % (c, h) for h in clashes(c, machine=True)]

legacy = any(not N(c).subnet_of(N(cluster_pool)) for c in cl) or any(
    not N(c).subnet_of(N(service_pool)) for c in sv)
msg = ("LegacyClusterCidrs: cluster %s / service %s are outside the fabric pools %s / %s "
       "(kept; checked against the hub and other clusters only)" % (cl, sv, cluster_pool, service_pool)
       if legacy else "cluster %s / service %s inside fabric pools %s / %s" % (cl, sv, cluster_pool, service_pool))
print(json.dumps({
    "clusterNetwork": cl, "serviceNetwork": sv, "machineNetwork": mc,
    "allocationSource": source, "legacy": legacy, "conflicts": conflicts, "message": msg,
}))
