# Hybrid Fabric EVPN — Live State

**Captured:** 2026-10-07 (border gateway model, `fabric-bgw-plan.md` Phases 0-3)  
**CENTRAL (hub):** `api.cluster-ngjtm.dyn.redhatworkshops.io`  
**RHOSO management cluster:** `api.cluster-j7ljz.dyn.redhatworkshops.io` · EDPM `compute01` (ctlplane `172.22.0.100`)  
**Previous capture** (hub RR pods + WireGuard spoke pods + SSH TUN/GoBGP) is superseded and no longer describes the lab.

## Result

| Check | Acme (`acme-fabric`, AS 65010) | Chad (`chad-fabric`, AS 65020) |
|---|---|---|
| BGP to border gateway 10.255.10.10 | **Established** from hcp1 and compute01 | not migrated / not retested |
| Type-5 from hcp1 | `10.110.0.64/26` next-hop VTEP `192.168.72.60` | — |
| Type-5 from RHOSO | `10.110.1.1/32`, `10.110.1.2/32`, `10.110.1.63/32` next-hop VTEP `192.168.80.100` | — |
| Data path | hcp1 CUDN pod `10.110.0.67` -> RHOSO VM `10.110.1.63` **ping OK**, incl. 1272-byte payload | — |

## Topology (as built)

```
hcp1 worker eth1 192.168.72.60 (DHCP)          compute01 eth5 192.168.80.100 (NetConfig "fabric")
        |  hub underlay L2 192.168.64.0/18             |  site underlay L2 192.168.80.0/24
        |  NAD fabric-underlay (OVN-K layer2)          |  br-fabric on enp7s0 (NNCP), NAD openstack/fabric
  fabric-bgw-acme (sovereign-cloud)             fabric-gw-oso1 (openstack, RHOSO mgmt cluster)
   eth1 192.168.64.1/18, lo 10.255.10.10          eth1 192.168.80.1/24
   wg0 10.254.254.1/24  <== WireGuard in wstunnel ==  wg0 10.254.254.12/32
   Route fabric-bgw-acme.apps.<hub> (passthrough 443 -> 8443)
```

- Control plane: iBGP AS 65010; the BGW reflects `l2vpn evpn` and `ipv4 unicast` with next-hop unchanged, so spokes see each other's real VTEPs.
- Data plane: VXLAN 4789 between VTEPs, routed by the BGW (eth1 <-> wg0) and the site gateway (eth1 <-> wg0). MTU: hub underlay 1400, site underlay 1442, wg0 1380, CUDN and Neutron network 1300.
- HCP routes to the BGW loopback and the RHOSO site underlay arrive by DHCP option 121; compute01's come from the NetConfig `fabric` subnet routes.

## Lab-only shims (not needed on physical sites)

| Shim | Why | Where |
|---|---|---|
| `mutatevirtualmachines.kubemacpool.io=ignore` on `sovereign-cloud` and `clusters-<hcp>-<hcp>` | Hub kubemacpool webhook unavailable, blocked VM create/update | `hybridfabric_provision`, `platformopenshift_provision` |
| MAC-NAT DaemonSet `openstack/fabric-gw-macnat` (every node) | RHDP hypervisor drops frames whose source MAC is not the node NIC's; nft bridge table swaps the gateway VM MAC and the local enp7s0 MAC | `CloudGateway.spec.siteUnderlay.macNatShim` |

## Objects

| Object | State |
|---|---|
| `HybridFabric/acme-fabric` | `borderGateway` (10.255.10.10, underlay 192.168.64.0/18), no `routeReflectors` |
| `CloudGateway/acme-hcp1-gw`, `TransportLink/acme-hcp1-link` | `none` |
| `CloudGateway/acme-oso1-gw`, `TransportLink/acme-oso1-link` | `wireguard`, `siteUnderlay` enp7s0/eth5 192.168.80.0/24, MAC-NAT on |
| HCP1 | NodePool `additionalNetworks: [clusters-hcp1-hcp1/fabric-underlay]`; VTEP `cidrs: [192.168.64.0/18]`; FRRConfiguration neighbor 10.255.10.10 |
| RHOSO EDPM | NodeSet `openstack-compute01`: network `fabric`, `edpm_enable_chassis_gw: true`, FRR peer 10.255.10.10, `ovn-evpn` on eth5; services `frr`, `neutron-ovn` |
| Neutron | `acme-core-oso1` (MTU 1300 per plan §7; 1272-byte ping passes), EVPN router VNI 51001 recreated after the chassis became gateway-enabled so `evpn-hcg-<router>` is populated |

GitOps now targets a single `platform-fabric` (BGW VM `fabric-bgw`, same loopback; acme and chad as VRFs) — not applied yet; see fabric-bgw-plan §12.1 for the cut-over.

The objects above were applied by hand and then codified in the orchestrator (EDA roles + GitOps, same date). The automation has not yet been run end to end from GitOps on a fresh environment.

## Quick re-check

```bash
# BGW (hub): guest shell via virtctl console/ssh
vtysh -c 'show bgp l2vpn evpn summary'          # hcp1 192.168.72.x and 192.168.80.100 Established
vtysh -c 'show bgp l2vpn evpn route type prefix' # 10.110.0.64/26 and 10.110.1.x/32
wg show wg0 latest-handshakes

# hcp1
oc -n openshift-frr-k8s exec <frr-k8s pod> -c frr -- vtysh -c 'show bgp neighbor 10.255.10.10 json'

# RHOSO management cluster
oc -n openstack exec ovsdbserver-nb-0 -c ovsdbserver-nb -- ovn-nbctl list HA_Chassis_Group   # evpn-hcg-<router> non-empty
```
