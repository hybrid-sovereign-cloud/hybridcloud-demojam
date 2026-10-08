# Plan / validate PlatformOpenshift pod and service CIDRs (design/fabric.md §16).
# Run by common/tasks/platformopenshift_fabric_ipam.yml (hosted-cluster CIDR planner;
# the 'fabric' in the file names is historical, nothing here touches the fabric).
# Inputs (env, JSON): SOURCE (recorded|explicit|allocate|legacy-default), RECORDED,
#   EXPLICIT, POOLS {clusterNetworkPool, serviceNetworkPool}, HUB_NETWORK, PEERS,
#   DENY_PEER_OVERLAP, SELF_NAME, SELF_NAMESPACE.
# Output: JSON {clusterNetwork, serviceNetwork, machineNetwork, allocationSource,
#   legacy, conflicts[], message}.
#
# Cluster CIDR selection is not a fabric concern: pod/service CIDRs are never
# advertised into the fabric. Rules:
#   * pod + service CIDRs must not overlap the hub's own pod/service CIDRs
#     (HyperShift on KubeVirt);
#   * pod + service CIDRs must not overlap other PlatformOpenshift pod/service
#     CIDRs (DENY_PEER_OVERLAP, role var, default true);
#   * the cluster's own CIDRs must not overlap each other;
#   * no check against overlay (HybridNetwork) prefixes: overlay uniqueness is per
#     HybridNetwork and is enforced by NetworkPlacement;
#   * CIDRs outside the default ranges => legacy=True (LegacyClusterCidrs); kept.
# No node/machine blocks are allocated (KubeVirt workers use the hub pod network).
import ipaddress
import json
import os

src = os.environ["SOURCE"]
recorded = json.loads(os.environ.get("RECORDED") or "{}")
explicit = json.loads(os.environ.get("EXPLICIT") or "{}")
pools = json.loads(os.environ.get("POOLS") or "{}")
hub = json.loads(os.environ.get("HUB_NETWORK") or "{}")
peers = json.loads(os.environ.get("PEERS") or "[]")
deny_peer_overlap = (os.environ.get("DENY_PEER_OVERLAP") or "true").lower() in ("1", "true", "yes")
me = (os.environ["SELF_NAMESPACE"], os.environ["SELF_NAME"])

# Greenfield defaults: CG-NAT 100.64.0.0/10 for pod and service ranges.
cluster_pool = (pools.get("clusterNetworkPool") or {}).get("cidr") or "100.64.0.0/11"
cluster_plen = int((pools.get("clusterNetworkPool") or {}).get("blockPrefixLength") or 14)
service_pool = (pools.get("serviceNetworkPool") or {}).get("cidr") or "100.96.0.0/11"
service_plen = int((pools.get("serviceNetworkPool") or {}).get("blockPrefixLength") or 16)


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

peer_cs = []
for p in peers:
    md = p.get("metadata") or {}
    if (md.get("namespace"), md.get("name")) == me:
        continue
    net = (p.get("status") or {}).get("networking") or {}
    tag = "%s/%s" % (md.get("namespace"), md.get("name"))
    peer_cs += [(c, tag) for c in cidrs(net.get("clusterNetwork")) + cidrs(net.get("serviceNetwork"))]


def clashes(cidr):
    hits = ["hub %s" % h for h in hub_cidrs if N(cidr).overlaps(N(h))]
    if deny_peer_overlap:
        hits += ["%s %s" % (t, c) for c, t in peer_cs if N(cidr).overlaps(N(c))]
    return hits


def allocate(pool, plen, taken):
    for net in N(pool).subnets(new_prefix=plen):
        c = str(net)
        if clashes(c) or any(net.overlaps(N(t)) for t in taken):
            continue
        return c
    raise SystemExit("no free /%d left in %s" % (plen, pool))


mc = []
if src == "recorded":
    cl, sv = cidrs(recorded.get("clusterNetwork")), cidrs(recorded.get("serviceNetwork"))
    mc = cidrs(recorded.get("machineNetwork"))  # pre-underlay clusters only; not checked
    source = recorded.get("allocationSource") or "fabric-ipam"
elif src == "explicit":
    cl, sv = cidrs(explicit.get("clusterNetwork")), cidrs(explicit.get("serviceNetwork"))
    source = "explicit"
elif src == "allocate":
    cl = [allocate(cluster_pool, cluster_plen, [])]
    sv = [allocate(service_pool, service_plen, cl)]
    source = "fabric-ipam"
else:  # allocateFromFabric false and nothing recorded: HyperShift defaults
    cl, sv = ["10.132.0.0/14"], ["172.31.0.0/16"]
    source = "legacy-default"

conflicts = []
own = cl + sv
for i, a in enumerate(own):
    for b in own[i + 1:]:
        if N(a).overlaps(N(b)):
            conflicts.append("self-overlap %s vs %s" % (a, b))
for c in own:
    conflicts += ["%s overlaps %s" % (c, h) for h in clashes(c)]

legacy = any(not N(c).subnet_of(N(cluster_pool)) for c in cl) or any(
    not N(c).subnet_of(N(service_pool)) for c in sv)
msg = ("LegacyClusterCidrs: cluster %s / service %s are outside the default ranges %s / %s "
       "(kept; checked against the hub and other clusters only)" % (cl, sv, cluster_pool, service_pool)
       if legacy else "cluster %s / service %s inside the default ranges %s / %s" % (cl, sv, cluster_pool, service_pool))
print(json.dumps({
    "clusterNetwork": cl, "serviceNetwork": sv, "machineNetwork": mc,
    "allocationSource": source, "legacy": legacy, "conflicts": conflicts, "message": msg,
}))
