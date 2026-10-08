# Hybrid Fabric EVPN — Live State

Lab captures of the reference implementation in `fabric.md` §21 (cutover: §22, lab shims: Appendix A). Newest first.

**CENTRAL (hub):** `api.cluster-ngjtm.dyn.redhatworkshops.io` · 3 control-plane + 3 worker nodes, OCP 4.22, node IPs 10.10.10.{10,11,12,30,31,32} on `br-ex`
**RHOSO management cluster:** `api.cluster-j7ljz.dyn.redhatworkshops.io` · EDPM `compute01` (ctlplane `172.22.0.100`)

## 2026-10-08 — Hub CloudVirt spoke (hub VMs ↔ RHOSO VMs)

**Captured:** 2026-10-08 01:35 UTC. One platform fabric (`platform-fabric`, AS 65010, underlay 192.168.64.0/18, BGW loopback 10.255.10.10). The OpenShift side of the VRF is now the hub itself (`fabric.md` §10.2): hub nodes are VTEPs and tenant VMs/pods sit on a Layer2 primary CUDN. Hosted clusters are being taken off the fabric (`fabric.md` §15, §22) and are not part of this result.

### Result

| Check | Result |
|---|---|
| BGP hub nodes → BGW hub leg 192.168.65.1 | **Established** from all 6 hub nodes (frr-k8s, `l2vpn evpn` + `ipv4 unicast`) |
| BGP compute01 → BGW loopback 10.255.10.10 | **Established** (through the site gateway, unchanged) |
| Type-5 from the hub | `10.110.2.0/24` (whole Layer2 subnet), next hop hub node VTEPs 192.168.65.x, RT `65010:51001` |
| Type-5 from RHOSO | `10.110.1.x/32` (incl. `10.110.1.63`), next hop compute01 VTEP `192.168.80.100`, RT `65010:51001` |
| Data path | pod and VM on the hub `acme-core` UDN (10.110.2.0/24) ↔ RHOSO VM `10.110.1.63`: **ping OK** |
| MTU | DF ping with 1272-byte payload (1300 on the wire) **passes**; 1400 is refused locally with `mtu=1300` |
| Isolation (`chad-app`, 10.120.2.0/24) | **PASS** 2026-10-08 01:50Z: a pod on the hub `chad-app` CUDN reaches its gateway 10.120.2.1 but gets no reply from 10.110.1.63 or 10.110.2.4 (procedure: `docs/workshop/lab-06-hybrid-fabric.md` Step 6.3) |

### Topology (as built)

```
 hub node (x6)                                   BGW VM sovereign-cloud/fabric-bgw
  br-ex: 10.10.10.x/24 (node) + 192.168.65.x/18 (VTEP)   eth0 pod network (masquerade): wstunnel, SSH
  routes 192.168.80.0/24, 10.254.254.0/24             eth1 192.168.64.1/18 (OVN-K layer2 underlay NAD, legacy users only)
         via 192.168.65.1 dev br-ex                  eth2 "hubleg" 192.168.65.1/24, MAC 02:fa:b0:00:65:01,
  frr-k8s: neighbor 192.168.65.1 (iBGP 65010)             OVN-K localnet NAD on physnet (br-ex)
  OVN-K VTEP CR platform-fabric-vtep (Unmanaged)       lo  10.255.10.10/32 (route reflector)
  Layer2 CUDN acme-core 10.110.2.0/24, VRF 51001       wg0 10.254.254.1/24 <== WireGuard in wstunnel (TLS 443) ==>
         |                                                                        site gateway fabric-gw-oso1
         +-- hub L2 (br-ex, localnet) --- BGW eth2                                  wg0 10.254.254.12, eth1 192.168.80.1
                                                                                    |  br-fabric, site underlay 192.168.80.0/24
                                                                                  compute01 eth5 192.168.80.100 (VTEP)
                                                                                    Neutron acme-core-oso1 MTU 1300, VM 10.110.1.63
```

- Hub node VTEP = `192.168.65.<last octet of the node IP>` with the **whole underlay prefix** (/18) on `br-ex`. OVN-K's `br-ex` flows hand host-originated traffic to the local VM ports only for subnets configured on `br-ex`; with only a /24 the hub nodes could not reach BGW-routed destinations. For the same reason the hub FRRConfiguration peers with the BGW hub-leg address on-link, not with the loopback.
- Lab MAC shim on every hub node: a **netdev-family** nft table on `enp2s0` (the `br-ex` uplink) rewrites the BGW hub-leg MAC to the node NIC MAC and back, because the lab hypervisor drops frames whose source MAC is not the node NIC's. The ingress rewrite matches every destination the BGW routes (hub leg, loopback, underlay, WireGuard net) except the node's own VTEP. A `bridge`-family table (as used on the RHOSO side) is a no-op on OVS `br-ex`.
- The tenant VRF on the hub: Layer2 primary CUDN `acme-core` (`mtu: 1300`, `ipam.lifecycle: Persistent`, `transport: EVPN`, `ipVRF` 51001 / `65010:51001`, `macVRF` 151001 / `65010:151001`), RouteAdvertisements `advertise-acme-core-evpn` (`targetVRF: auto`), namespace `acme-core-vms` created with `k8s.ovn.org/primary-user-defined-network`.

### Objects

| Object | State |
|---|---|
| Hub network operator | `additionalRoutingCapabilities.providers: [FRR]`, `routeAdvertisements: Enabled`; `openshift-frr-k8s` Running on all nodes |
| `HybridFabric/platform-fabric` | Ready; ledger 51000–52127: payments-vpc 51000, acme-core 51001, chad-app 52000 |
| Localnet NAD (hub leg) | `sovereign-cloud/fabric-hub` (hand-built; GitOps names it `spec.underlay.nadName`, `fabric-localnet`), `physicalNetworkName: physnet`, no IPAM |
| BGW `fabric-bgw` | third NIC `hubleg` (bridge binding) on the localnet NAD; guest NM profile `hubleg` (eth2); nftables accept TCP 179 / UDP 4789 on eth2, forward eth2 <-> wg0 and eth2 <-> eth1 |
| Hub underlay DaemonSet (`sovereign-cloud`) | one pod per node, privileged hostNetwork: VTEP address, routes, MAC shim, re-applied every 120 s |
| VTEP `platform-fabric-vtep` | `mode: Unmanaged`, `cidrs: [192.168.64.0/18]` |
| FRRConfiguration `openshift-frr-k8s/platform-fabric-bgw` | `nodeSelector: {}`, neighbor 192.168.65.1 AS 65010, raw `ebgp-multihop 32`, `l2vpn evpn` + `ipv4 unicast` activated |
| CUDN `acme-core`, RouteAdvertisements `advertise-acme-core-evpn`, namespace `acme-core-vms` | as above |
| Test workloads | CentOS Stream 9 VM (container disk, `l2bridge` on the pod network) and a probe pod in `acme-core-vms` |
| RHOSO side | unchanged from the 2026-10-07 capture below |

These hub objects were applied by hand from the hand-over manifests and are codified in the EDA hub pass (`cloudgateway_provision` openshift path, `networkplacement_provision` `backend_cloudvirt_evpn.yml`, `hybridfabric_provision` `bgw_hub_leg.yml`); the codified names are `<fabric>-hub-underlay`, `<fabric>-vtep`, `<fabric>-bgw`. Not yet re-run end to end from GitOps.

### Re-check

```bash
# hub prerequisites
oc get network.operator cluster -o jsonpath='{.spec.additionalRoutingCapabilities}{" "}{.spec.defaultNetwork.ovnKubernetesConfig.routeAdvertisements}{"\n"}'
#   {"providers":["FRR"]} Enabled

# node legs (oc debug node is unreliable here; use the host-network ovnkube-node pods)
for p in $(oc get pod -n openshift-ovn-kubernetes -l app=ovnkube-node -o name); do
  oc exec -n openshift-ovn-kubernetes $p -c ovn-controller -- sh -c 'ip -4 -o addr show br-ex | grep 192.168.65; ip route show 192.168.80.0/24'
done
#   inet 192.168.65.<n>/18 ... br-ex
#   192.168.80.0/24 via 192.168.65.1 dev br-ex

# frr-k8s sessions
for p in $(oc get pod -n openshift-frr-k8s -o name | grep -v webhook); do
  oc exec -n openshift-frr-k8s $p -c frr -- vtysh -c 'show bgp summary' | grep -E '^192\.168\.65\.1 '
done
#   one line per node; last column a prefix count (Established), not Active/Connect

# OVN-K objects
oc get vtep platform-fabric-vtep -o jsonpath='{range .status.conditions[*]}{.type}={.status} {end}{"\n"}'
oc get clusteruserdefinednetwork acme-core -o jsonpath='{range .status.conditions[*]}{.type}={.status} {end}{"\n"}'
#   ... TransportAccepted=True NetworkCreated=True
oc get routeadvertisements advertise-acme-core-evpn -o jsonpath='{.status.status}{"\n"}'
#   Accepted

# data path from the probe pod in the UDN namespace
oc exec -n acme-core-vms probe -- ip -4 -o addr show ovn-udn1          # 10.110.2.x/24
oc exec -n acme-core-vms probe -- ping -c 3 10.110.1.63
oc exec -n acme-core-vms probe -- ping -c 3 -M do -s 1272 10.110.1.63  # replies
oc exec -n acme-core-vms probe -- ping -c 1 -M do -s 1400 10.110.1.63  # "message too long, mtu=1300"
```

BGW guest (SSH through the virt-launcher pod with the platform key from Vault `fabric/platform-fabric/bgw`, or `virtctl console`):

```bash
sudo vtysh -c 'show bgp l2vpn evpn summary'
#   192.168.65.10 .11 .12 .30 .31 .32   Established (hub nodes)
#   192.168.80.100                      Established (compute01)
sudo vtysh -c 'show bgp l2vpn evpn route type prefix'
#   *>i[5]:[0]:[24]:[10.110.2.0]    next hop 192.168.65.x      RT:65010:51001 ET:8
#   *>i[5]:[0]:[32]:[10.110.1.63]   next hop 192.168.80.100    RT:65010:51001 ET:8
ip -br addr show eth2                                    # eth2 UP 192.168.65.1/24
```

`virtctl ssh` and `oc port-forward` do not reach a tenant VM on a primary UDN (`l2bridge`); test from a pod in the UDN namespace or the VM console.

## 2026-10-07 — Hosted-cluster spoke (superseded)

**Captured:** 2026-10-07, before the restructure. The OpenShift side was hosted cluster hcp1, whose workers joined the hub underlay (NodePool `additionalNetworks`, OVN-K layer2 NAD `fabric-underlay`, DHCP from the BGW). That attachment model is retired (`fabric.md` §15); the RHOSO side below is still current.

| Check | Result |
|---|---|
| BGP to border gateway 10.255.10.10 | **Established** from hcp1 and compute01 |
| Type-5 from hcp1 | `10.110.0.64/26` next-hop VTEP `192.168.72.60` |
| Type-5 from RHOSO | `10.110.1.1/32`, `10.110.1.2/32`, `10.110.1.63/32` next-hop VTEP `192.168.80.100` |
| Data path | hcp1 CUDN pod `10.110.0.67` -> RHOSO VM `10.110.1.63` **ping OK**, incl. 1272-byte payload |

RHOSO side (current):

| Object | State |
|---|---|
| Site gateway `openstack/fabric-gw-oso1` | eth1 192.168.80.1/24 on bridge NAD `openstack/fabric` over `br-fabric`/enp7s0 (NNCPs `fabric-underlay-<node>`), wg0 10.254.254.12 to the BGW route; MAC-translation DaemonSet `openstack/fabric-gw-macnat` |
| RHOSO EDPM | NodeSet `openstack-compute01`: network `fabric`, `edpm_enable_chassis_gw: true`, FRR peer 10.255.10.10, `ovn-evpn` on eth5; services `frr`, `neutron-ovn`; one fingerprinted deployment per NodeSet |
| Neutron | `acme-core-oso1` (MTU 1300, `fabric.md` §21.5), EVPN router VNI 51001 recreated after the chassis became gateway-enabled so `evpn-hcg-<router>` is populated; test VM 10.110.1.63 |

```bash
# BGW
wg show wg0 latest-handshakes
# RHOSO management cluster
oc -n openstack exec ovsdbserver-nb-0 -c ovsdbserver-nb -- ovn-nbctl list HA_Chassis_Group   # evpn-hcg-<router> non-empty
```
