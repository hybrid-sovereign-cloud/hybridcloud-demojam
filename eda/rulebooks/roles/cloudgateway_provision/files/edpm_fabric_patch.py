#!/usr/bin/env python3
"""Compute NetConfig / OpenStackDataPlaneNodeSet merge patches that put EDPM
computes on the fabric site underlay with FRR + ovn-evpn (design/fabric-bgw-plan.md §6.2).

Inputs (environment, JSON): NETCONFIG, NODESET, PARAMS. Output dir: argv[1].
Writes <out>/netconfig-patch.json and <out>/nodeset-patch.json (only when a
change is needed) and prints a JSON summary on stdout.

Kept in Python on purpose: edpm_network_config_template is itself a Jinja
template ({{ fabric_ip }} ...); building it here and handing the file to the
k8s module via `src` means Ansible never tries to render it.
"""
import copy
import hashlib
import ipaddress
import json
import os
import re
import sys

netconfig = json.loads(os.environ["NETCONFIG"])
nodeset = json.loads(os.environ["NODESET"])
p = json.loads(os.environ["PARAMS"])
out_dir = sys.argv[1]

net_name = p["network"]                      # NetConfig network name, e.g. fabric
subnet_name = p.get("subnetName", "subnet1")
cidr = ipaddress.ip_network(p["cidr"], strict=False)
mtu = int(p["mtu"])
gw = p["gatewayAddress"]
iface = p["computeInterface"]
asn = int(p["asn"])
bgw_lb = p["bgwLoopback"]
route_dests = p["routeDestinations"]          # [bgw loopback/32, hub underlay, wg net]
nft_sources = p["nftSources"]
alloc_start = cidr.network_address + int(p.get("allocStartOffset", 100))
alloc_end = min(cidr.network_address + int(p.get("allocEndOffset", 150)), cidr.broadcast_address - 1)

# ---------------------------------------------------------------- NetConfig
networks = copy.deepcopy(netconfig.get("spec", {}).get("networks", []))
base_domain = ""
for n in networks:
    dd = n.get("dnsDomain") or ""
    if "." in dd:
        base_domain = dd.split(".", 1)[1]
        break
desired_net = {
    "name": net_name,
    "dnsDomain": "%s.%s" % (net_name, base_domain) if base_domain else net_name,
    "mtu": mtu,
    "serviceNetwork": net_name,
    "subnets": [{
        "name": subnet_name,
        "cidr": str(cidr),
        "allocationRanges": [{"start": str(alloc_start), "end": str(alloc_end)}],
        # Routes MUST live here: the dataplane operator derives
        # <net>_host_routes from NetConfig and overwrites ansibleVars copies.
        "routes": [{"destination": d, "nexthop": gw} for d in route_dests],
    }],
}
existing = [n for n in networks if n.get("name", "").lower() == net_name.lower()]
netconfig_changed = True
if existing:
    cur = existing[0]
    cmp_keys = ("dnsDomain", "mtu", "subnets")
    netconfig_changed = any(cur.get(k) != desired_net[k] for k in cmp_keys)
    networks = [desired_net if n is cur else n for n in networks]
else:
    networks.append(desired_net)

# ---------------------------------------------------------------- NodeSet
spec = nodeset.get("spec", {})
nodes = spec.get("nodes", {}) or {}
tmpl_vars = (((spec.get("nodeTemplate") or {}).get("ansible") or {}).get("ansibleVars") or {})

used = set()
for n in nodes.values():
    for net in n.get("networks", []) or []:
        if net.get("name", "").lower() == net_name.lower() and net.get("fixedIP"):
            used.add(net["fixedIP"])

node_patch = {}
node_ips = {}
nodes_changed = False
cursor = int(alloc_start)
for name in sorted(nodes):
    n = nodes[name]
    nets = copy.deepcopy(n.get("networks") or [])
    mine = [x for x in nets if x.get("name", "").lower() == net_name.lower()]
    if mine and mine[0].get("fixedIP"):
        ip = mine[0]["fixedIP"]
    else:
        while str(ipaddress.ip_address(cursor)) in used:
            cursor += 1
        if cursor > int(alloc_end):
            raise SystemExit("fabric allocation range exhausted")
        ip = str(ipaddress.ip_address(cursor))
        used.add(ip)
        cursor += 1
        nets.append({"name": net_name, "subnetName": subnet_name, "fixedIP": ip})
        nodes_changed = True
    node_ips[name] = ip
    node_vars = ((n.get("ansible") or {}).get("ansibleVars") or {})
    entry = {}
    if not (mine and mine[0].get("fixedIP")):
        entry["networks"] = nets
    # A single-node NodeSet may carry the VTEP IP at nodeTemplate level (lab).
    if (node_vars.get("edpm_neutron_ovn_evpn_local_ip")
            or tmpl_vars.get("edpm_neutron_ovn_evpn_local_ip")) != ip:
        entry.setdefault("ansible", {})["ansibleVars"] = {"edpm_neutron_ovn_evpn_local_ip": ip}
        nodes_changed = True
    if entry:
        node_patch[name] = entry

src = "{ " + ", ".join(nft_sources) + " }"
desired_vars = {
    "%s_cidr" % net_name: str(cidr.prefixlen),
    "%s_mtu" % net_name: mtu,
    # REQUIRED: without it Neutron leaves the EVPN router's HA chassis group
    # empty and the EVPN router port never binds.
    "edpm_enable_chassis_gw": True,
    "edpm_frr_bgp_asn": asn,
    "edpm_frr_bgp_ipv4_src_network": net_name,
    "edpm_frr_bgp_ipv6": False,
    "edpm_frr_bfd": False,
    "edpm_frr_bgp_peers": [bgw_lb],
    "edpm_frr_bgp_uplinks": [],
    "edpm_frr_bgp_uplinks_scope": "internal",
    "edpm_frr_bgp_neighbor_ttl_security_hops": 0,
    "edpm_frr_bgp_l2vpn": True,
    "edpm_frr_bgp_l2vpn_uplink_activate": True,
    "edpm_frr_bgp_l2vpn_peers": [],
    "edpm_frr_bgp_expose_only_host": True,
    "edpm_frr_bgp_learning_routes": False,
    "edpm_neutron_ovn_agent_agent_extensions": "ovn-evpn",
    "edpm_neutron_ovn_evpn_vxlan_port": 4789,
    "edpm_neutron_ovn_agent_ovn_evpn_bgp_as": str(asn),
    "edpm_neutron_ovn_agent_ovn_evpn_bgp_local_interface": iface,
}
rules = [r for r in (tmpl_vars.get("edpm_nftables_user_rules") or [])
         if r.get("rule_name") not in ("150 fabric evpn vxlan", "151 fabric bgp")]
rules += [
    {"rule_name": "150 fabric evpn vxlan", "rule": {"proto": "udp", "dport": [4789], "source": src}},
    {"rule_name": "151 fabric bgp", "rule": {"proto": "tcp", "dport": [179], "source": src}},
]
desired_vars["edpm_nftables_user_rules"] = rules

template = tmpl_vars.get("edpm_network_config_template") or ""
block = (
    "- type: interface\n"
    "  name: %s\n"
    "  mtu: {{ %s_mtu }}\n"
    "  use_dhcp: false\n"
    "  addresses:\n"
    "  - ip_netmask: {{ %s_ip }}/{{ %s_cidr }}\n"
    "  routes: {{ %s_host_routes }}\n"
) % (iface, net_name, net_name, net_name, net_name)
if not template:
    raise SystemExit("NodeSet has no edpm_network_config_template to extend")
if not re.search(r"name:\s*%s\s*$" % re.escape(iface), template, re.M):
    m = re.search(r"^- type: ovs_bridge", template, re.M)
    if m:
        template = template[:m.start()] + block + template[m.start():]
    else:
        template = template.rstrip("\n") + "\n" + block
    desired_vars["edpm_network_config_template"] = template

vars_patch = {k: v for k, v in desired_vars.items() if tmpl_vars.get(k) != v}

services = list(spec.get("services") or [])
svc_changed = False
def insert_after(svcs, new, after):
    if new in svcs:
        return False
    idx = svcs.index(after) + 1 if after in svcs else len(svcs)
    svcs.insert(idx, new)
    return True
svc_changed |= insert_after(services, "frr", "install-certs")
svc_changed |= insert_after(services, "neutron-ovn", "ovn")

nodeset_changed = bool(vars_patch) or nodes_changed or svc_changed

# Stable across runs (independent of whether the template block already exists).
fp_vars = {k: v for k, v in desired_vars.items() if k != "edpm_network_config_template"}
fingerprint = hashlib.sha256(json.dumps({
    "net": desired_net, "vars": fp_vars, "ips": node_ips, "iface": iface,
}, sort_keys=True).encode()).hexdigest()[:8]

meta = lambda obj: {"name": obj["metadata"]["name"], "namespace": obj["metadata"]["namespace"]}
if netconfig_changed:
    with open(os.path.join(out_dir, "netconfig-patch.json"), "w") as f:
        json.dump({"apiVersion": netconfig["apiVersion"], "kind": netconfig["kind"],
                   "metadata": meta(netconfig), "spec": {"networks": networks}}, f)
if nodeset_changed:
    patch_spec = {}
    if vars_patch:
        patch_spec["nodeTemplate"] = {"ansible": {"ansibleVars": vars_patch}}
    if node_patch:
        patch_spec["nodes"] = node_patch
    if svc_changed:
        patch_spec["services"] = services
    with open(os.path.join(out_dir, "nodeset-patch.json"), "w") as f:
        json.dump({"apiVersion": nodeset["apiVersion"], "kind": nodeset["kind"],
                   "metadata": meta(nodeset), "spec": patch_spec}, f)

print(json.dumps({
    "netconfig_changed": netconfig_changed,
    "nodeset_changed": nodeset_changed,
    "changed_vars": sorted(vars_patch),
    "services_changed": svc_changed,
    "node_ips": node_ips,
    "fingerprint": fingerprint,
    "network_config_update": tmpl_vars.get("edpm_network_config_update", False),
}))
