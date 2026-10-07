# Fabric border gateway plan (BGW VM + gateway VMs, no WireGuard on platforms)

Status: **Phases 0-3 DONE and verified live 2026-10-07; codified in the orchestrator (Phase 4 automation written, not yet re-run end to end from GitOps). Consolidated to a single platform fabric (§12).** Companion to `fabric.md` (design) and `fabric-verify.md` (lab state). §11 lists where the verified build deviates from the original proposal below.

## 1. Goals

- Realize `fabric.md` §5 / §10.3: HCP CUDN pods and RHOSO Neutron VMs in one EVPN IP-VRF (VNI 51001, RT 65010:51001).
- Platforms do only native peering: OpenShift via OVN-Kubernetes EVPN + FRR-k8s, RHOSO via EDPM `frr` + `neutron-ovn` (`ovn-evpn` extension). Nothing custom is installed on HCP nodes or on EDPM computes.
- Gateways are VMs that stand in for physical kit: one **border gateway (BGW)** VM on the hub, one **cloud gateway** VM per RHOSO site on the RHOSO control-plane OpenShift cluster.
- The only tunnel is WireGuard between the BGW and the cloud gateway VM, carried over the hub ingress (TLS 443) because neither lab exposes UDP.

## 2. Verified constraints (live, 2026-10-07)

| Item | Finding |
|---|---|
| Hub <-> RHOSO reachability | TCP 6443/443 on each side's public VIP only. No NodePorts, no UDP. Node networks are both 10.10.10.0/24. |
| Hub VM networking | OpenShift Virtualization only; no NMState, no bridges. OVN-K layer2 NADs are the only secondary network option. OVN-K applies MAC+IP port security on pod ports, so a VM on the pod network cannot forward transit traffic. A layer2 NAD **without** IPAM gets MAC-only port security. |
| RHOSO control-plane cluster | OpenShift Virtualization 4.20 and NMState installed. Nodes have an unused NIC `enp7s0` (carrier up, no config) on all three nodes. |
| Underlay segment | `enp7s0` (control-plane nodes) and `eth5` (compute01, unused) are on the same L2. Verified by temporary addressing and ping. |
| Lab MTU | Every RHDP segment (spare, ctlplane, tenant) passes 1442-byte frames and drops 1500. Neutron already reports 1442. |
| EDPM | `osp.edpm.edpm_frr` supports `l2vpn evpn` peers, multihop, `advertise-all-vni`; `osp.edpm.edpm_neutron_ovn` has the `ovn-evpn` agent extension (sets `ovn-evpn-local-ip`, builds `br-evpn`/`vxlan-evpn`/`vlan-<VNI>`, programs FRR per VRF). Neither is in the NodeSet today. RHOSO 18.0.22, OVN 26.03, Neutron `evpn` plugin and `--evpn-vni` router already present. |
| Hub side today | RR pods, WireGuard hub pod, WireGuard spoke pods on HCP nodes, SSH TUN and GoBGP on compute01. All to be retired. |

## 3. Target topology

```
                 hub (CENTRAL, OCP 4.22)                       RHOSO site (OCP 4.20 mgmt + EDPM)
 +-----------------------------------------+        +----------------------------------------------+
 | HCP1 worker VM            BGW VM        |        | OSO gateway VM            compute01 (EDPM)   |
 |  eth0 pod net             eth0 pod net  |  wss   |  eth0 pod net (masq)      eth5 192.168.80.100|
 |  eth1 fabric-underlay ----eth1 .64.1   -|=443===>|  eth1 br-fabric .80.1 ----- (L2 enp7s0/eth5) |
 |  192.168.64.x (DHCP)      lo 10.255.10.10        |  wg0 10.254.254.12         VTEP .80.100      |
 |  VTEP = eth1              wg0 10.254.254.1       |                            FRR + ovn-evpn    |
 +-----------------------------------------+        +----------------------------------------------+
```

Addressing:

| Role | Address | Notes |
|---|---|---|
| Hub underlay L2 | 192.168.64.0/18 | OVN-K layer2 NAD `sovereign-cloud/fabric-underlay`, no IPAM. Matches `HybridFabric.spec.ipam.machineNetworkPool`. |
| BGW eth1 | 192.168.64.1/18 | dnsmasq here serves the HCP nodes. |
| HCP node eth1 | DHCP from 192.168.64.100-192.168.127.250 | VTEP CR `cidrs: [192.168.64.0/18]`. Per-cluster /24s can be added later with dnsmasq tags. |
| BGW loopback | 10.255.10.10/32 | BGP endpoint for all spokes, `HybridFabric.spec.borderGateway.loopback`. |
| WireGuard | 10.254.254.1 (BGW), 10.254.254.12 (oso1 gw) | Inside wstunnel. |
| OSO underlay L2 | 192.168.80.0/24 | NetConfig network `fabric`; NNCP bridge `br-fabric` on `enp7s0`; bridge NAD `openstack/fabric`. |
| OSO gateway eth1 | 192.168.80.1/24 | Static via cloud-init. |
| compute01 eth5 | 192.168.80.100/24 | NodeSet `networks` entry; VTEP and FRR source (`edpm_frr_bgp_ipv4_src_network: fabric`). |
| HCP CUDN | 10.110.0.0/24 | unchanged |
| Neutron `acme-core-oso1` | 10.110.1.0/24, MTU 1300 | MTU changed from 1442 |

Control plane: iBGP AS 65010 everywhere, BGW is route reflector (listen range, `route-reflector-client`, next-hop unchanged). Spokes keep their real VTEPs as next-hop; the BGW is an IP router for the underlay, never a VXLAN re-originator (avoids FRR's refusal to re-export imported EVPN routes). The eBGP per-spoke ASNs in `fabric.md` §11 are deferred (see §10).

Data path: HCP node (VTEP 192.168.64.x) -> L2 -> BGW -> wg0 -> OSO gateway VM -> L2 -> compute01 (VTEP 192.168.80.100) -> OVN. Reverse symmetric.

## 4. Hub border gateway VM

Objects (namespace `sovereign-cloud`, rendered by `hybridfabric_provision`):

- NAD `fabric-underlay`: `ovn-k8s-cni-overlay`, `topology: layer2`, no `subnets`, `mtu: 1400` (hub cluster MTU).
- Secret `fabric-bgw-<fabric>`: WireGuard private key, peers (from Vault `borderGateway.vaultCredentialRef`).
- VirtualMachine `fabric-bgw-<fabric>`: RHEL 9 or CentOS Stream 9, 2 vCPU / 4 GiB, interfaces: `default` (masquerade) + `underlay` (bridge binding on `fabric-underlay`). cloud-init installs `frr`, `wireguard-tools`, `wstunnel`, `dnsmasq`, `nftables`.
- Service `fabric-bgw-<fabric>-wss` (TCP 443 -> VM 8443) and Route `fabric-bgw-<fabric>` with `tls.termination: passthrough`. wstunnel server terminates TLS in the VM and forwards UDP 51820 to the local WireGuard listener.

Guest configuration:

- `lo`: 10.255.10.10/32. `eth1`: 192.168.64.1/18, MTU 1400. `wg0`: 10.254.254.1/24, MTU 1380, peers = cloud gateways (AllowedIPs: gateway wg address + that site's underlay subnet).
- sysctl: `net.ipv4.ip_forward=1`, `rp_filter=2` on all, eth1, wg0.
- nftables: forward eth1<->wg0; input TCP 179 and UDP 4789 from underlay and wg0; TCP 8443 from pod net. No NAT.
- dnsmasq on eth1: range 192.168.64.100-192.168.127.250/18, option 121 classless routes: `10.255.10.10/32 via 192.168.64.1`, `192.168.80.0/24 via 192.168.64.1` (one entry per OSO site). Lease time short (10 min) so node replacement recovers quickly.
- FRR (`frr.conf`):

```
router bgp 65010
 bgp router-id 10.255.10.10
 bgp cluster-id 10.255.10.10
 no bgp ebgp-requires-policy
 no bgp default ipv4-unicast
 neighbor SPOKES peer-group
 neighbor SPOKES remote-as 65010
 neighbor SPOKES ebgp-multihop 32
 bgp listen range 192.168.64.0/18 peer-group SPOKES
 bgp listen range 192.168.80.0/24 peer-group SPOKES
 bgp listen range 10.254.254.0/24 peer-group SPOKES
 address-family l2vpn evpn
  neighbor SPOKES activate
  neighbor SPOKES route-reflector-client
  neighbor SPOKES attribute-unchanged next-hop
 exit-address-family
 address-family ipv4 unicast
  neighbor SPOKES activate
  neighbor SPOKES route-reflector-client
 exit-address-family
```

One BGW serves both fabrics (acme 65010, chad 65020) by adding a second `router bgp` instance only if the VM gets a second loopback; otherwise one BGW VM per fabric. Start with one per fabric (simpler, matches the per-fabric CR).

## 5. HCP spokes (OpenShift)

- NodePool: `spec.platform.kubevirt.additionalNetworks: [{name: sovereign-cloud/fabric-underlay}]`, `attachDefaultNetwork: true`. Rendered by `platformopenshift_provision/templates/nodepool-kubevirt.yaml.j2` when the PlatformOpenshift joins a fabric. Rolling replace of workers.
- RHCOS DHCPs eth1 by default; OVN-K's `k8s.ovn.org/host-cidrs` then includes the 192.168.64.x address.
- VTEP CR `<network>-evpn-vtep`: `mode: Unmanaged`, `cidrs: [192.168.64.0/18]` (from `HybridFabric.spec.ipam.machineNetworkPool.cidr`).
- FRRConfiguration (hand-applied by `backend_openshift_evpn.yml`): neighbor `10.255.10.10` only, `remote-as 65010`, `ebgp-multihop 32`, no `bgp router-id` and no `update-source` (both are node-specific; FRR picks eth1). OVN-K's generated per-node FRRConfiguration continues to add the VRF/VNI/RT blocks and the VTEP /32 import filter.
- CUDN, RouteAdvertisements, namespace labels: unchanged.
- Removed: `fabric-wg` namespace and spoke WireGuard deployment, NetworkManager `evpn-vtep0` dummy connection, pinned routes. `CloudGateway.spec.transport.type: none`, `TransportLink.spec.tunnelType: none` for HCP.

## 6. RHOSO spoke

### 6.1 RHOSO management cluster (objects applied by EDA with the management-cluster kubeconfig)

- NNCP `fabric-underlay-<node>` on the node chosen to host the gateway VM (and optionally all three for live migration): `linux-bridge` `br-fabric`, port `enp7s0`, no IP, `mtu: 1442` on bridge and port, STP off.
- NAD `openstack/fabric`: `type: bridge`, `bridge: br-fabric`, no IPAM, `mtu: 1442`.
- Secret `openstack/fabric-gw-<gateway>`: WireGuard private key + BGW public key + BGW ingress host.
- VirtualMachine `openstack/fabric-gw-<gateway>`: interfaces `default` (masquerade) + `fabric` (bridge binding on `openstack/fabric`). cloud-init installs `wireguard-tools`, `wstunnel`, `nftables`.

Guest configuration:

- `eth1`: 192.168.80.1/24, MTU 1442. `wg0`: 10.254.254.12/32, MTU 1380, endpoint 127.0.0.1:51820, peer BGW AllowedIPs `10.254.254.1/32, 10.255.10.10/32, 192.168.64.0/18`, keepalive 25.
- wstunnel client: `wstunnel client -L udp://127.0.0.1:51820:127.0.0.1:51820 wss://fabric-bgw-acme.apps.<hub>:443` as a systemd unit, restart always.
- sysctl: `ip_forward=1`, `rp_filter=2` (all, eth1, wg0). nftables: forward eth1<->wg0, accept UDP 4789 and TCP 179 both ways. No NAT.
- Routes: 10.255.10.10/32 and 192.168.64.0/18 via wg0; 192.168.80.0/24 connected on eth1; default via eth0 for the wss session.

### 6.2 EDPM NodeSet changes (`openstack-compute01`, all through the dataplane operator)

- NetConfig: add network `fabric` (192.168.80.0/24, allocation 192.168.80.100-150, `mtu: 1442`, no gateway).
- NodeSet `nodes.compute01.networks`: add `{name: fabric, subnetName: subnet1, fixedIP: 192.168.80.100}`.
- `edpm_network_config_template`: add
  ```
  - type: interface
    name: eth5
    mtu: {{ fabric_mtu }}
    use_dhcp: false
    addresses:
    - ip_netmask: {{ fabric_ip }}/{{ fabric_cidr }}
    routes:
    - ip_netmask: 10.255.10.10/32
      next_hop: 192.168.80.1
    - ip_netmask: 192.168.64.0/18
      next_hop: 192.168.80.1
  ```
  (rendered from `fabric_host_routes` so the role, not the template, owns the BGW and peer-site prefixes).
- `services`: insert `frr` after `install-certs` and `neutron-ovn` after `ovn`.
- ansibleVars:
  ```
  edpm_frr_bgp_asn: 65010
  edpm_frr_bgp_ipv4_src_network: fabric
  edpm_frr_bgp_ipv6: false
  edpm_frr_bfd: false
  edpm_frr_bgp_uplinks: []
  edpm_frr_bgp_peers: []
  edpm_frr_bgp_l2vpn: true
  edpm_frr_bgp_l2vpn_peers: ['10.255.10.10']
  edpm_frr_bgp_l2vpn_peers_scope: 65010
  edpm_frr_bgp_l2vpn_ebgp_multihop: 32
  edpm_frr_bgp_l2vpn_uplink_activate: false
  edpm_neutron_ovn_agent_agent_extensions: ovn-evpn
  edpm_neutron_ovn_evpn_local_ip: 192.168.80.100
  edpm_neutron_ovn_evpn_vxlan_port: 4789
  edpm_neutron_ovn_agent_ovn_evpn_bgp_as: 65010
  edpm_nftables_user_rules: [accept udp 4789 and tcp 179 from 192.168.64.0/18, 192.168.80.0/24, 10.255.10.10/32]
  ```
  Items to confirm on the first run: the `frr.conf.j2` uplink loop with empty `edpm_frr_bgp_uplinks` (expect an empty `uplink` peer-group, harmless), and that the `ovn-evpn` extension configures `router bgp 65010 vrf <vrf>` with `advertise ipv4 unicast` and the RT it derives from the VNI (must equal 65010:51001; otherwise set the RT via `edpm_frr_conf_custom_router_bgp_ovn`).
- OpenStackDataPlaneDeployment `fabric-<gateway>-<ts>` with `servicesOverride: [configure-network, frr, ovn, neutron-ovn]`.
- Neutron: `openstack network set --mtu 1300 acme-core-oso1` (new networks created with `--mtu 1300` by `backend_rhoso_ovn_evpn.yml`).

Removed from compute01: `fabric-gobgp.service`, `fabric-ssh-tun.service`, `/etc/frr/frr.conf` hand edits, `10.255.12.1` on `lo`, GoBGP binaries.

## 7. MTU budget

| Segment | MTU |
|---|---|
| RHDP physical segments (hub and RHOSO) | 1442 effective |
| Hub pod network / fabric-underlay NAD / HCP eth1 | 1400 |
| OSO underlay (br-fabric, eth5, gateway eth1) | 1442 |
| wg0 (both gateways) | 1380 (carrier is TCP, so this is a floor for VXLAN not a physical limit) |
| VXLAN payload end to end | 1330 |
| CUDN `acme-core` | 1300 (unchanged) |
| Neutron `acme-core-oso1` | 1300 (was 1442) |

MSS clamping cannot be applied at the gateways because inner TCP is inside VXLAN; the overlay MTUs above are the control.

## 8. Orchestrator changes

CRDs (`gitops/custom-operators/crds`, `operator/config/crd/bases`):

- `HybridFabric.spec.borderGateway`: add `underlay: {nadName, cidr, address, dhcpRange, mtu}`, `wireguard: {address, listenPort}`, `ingressHost`, `vmSize`. Status: `borderBgwReady` becomes real, add `bgwEndpoint`, `bgwPeerCount`. `routeReflectors` becomes optional and deprecated.
- `CloudGateway.spec` (cloud=openstack): add `siteUnderlay: {interface: enp7s0, computeInterface: eth5, cidr: 192.168.80.0/24, gatewayAddress, mtu}`, `managementClusterKubeconfigRef` (Vault path), `wireguard.address`. `transport.type` enum drops `sshtunnel`.
- `TransportLink.spec.tunnelType` enum drops `sshtunnel`.
- `CloudOSO.spec`: add `managementClusterKubeconfigRef` (shared with CloudGateway) and `dataplaneNodeSetRef`.

EDA roles (`eda/rulebooks/roles`, after consolidating with `eda/hybridvpc/roles`):

- `hybridfabric_provision`: replace `deploy_hub_rr.yml` with `deploy_border_gateway.yml` (NAD, Secret, VM, Service, Route, wait for VMI Ready and FRR up). Teardown mirrors it.
- `cloudgateway_provision` (openshift): `gatewayAddress` = nothing to allocate; landing = NodePool has the underlay NAD. (openstack): render NNCP, NAD, Secret, gateway VM; patch NetConfig and NodeSet; create OpenStackDataPlaneDeployment; wait Ready; status `gatewayAddress: 192.168.80.1`.
- `transportlink_provision`: `wireguard` = generate or read keys from Vault, write BGW peer entry and gateway VM peer entry, confirm handshake via `wg show` in both VMs (virtctl or guest agent exec). `none` = assert BGP session on the BGW. Delete `deploy_sshtunnel.yml`, `files/fabric-ssh-tun-up.sh`, `files/wg`, `wg-spoke-deploy.yml.j2`, `wg-hub-deploy.yml.j2`, `ssh-hub-deploy.yml.j2`.
- `platformopenshift_provision/hosted.yml` + `nodepool-kubevirt.yaml.j2`: add `additionalNetworks` when `spec.fabric.fabricRefs` is non-empty.
- `networkplacement_provision/backend_openshift_evpn.yml`: VTEP CIDR from fabric `machineNetworkPool.cidr`; FRR neighbor = `borderGateway.loopback`; drop `router-id`/`update-source`.
- `networkplacement_provision/backend_rhoso_ovn_evpn.yml`: `--mtu 1300` on network create; remove the `EvpnDeferred` soft path once the DE with `python-openstackclient` is attached to the job templates (`gitops/infrastructure/aap/templates/seed-jobtemplates.yaml` currently sets no execution environment).
- `validate_bgp.yml`: query the BGW VM (`vtysh -c 'show bgp l2vpn evpn route'`) for both spokes' Type-5 routes; positive probe from an `acme-core-udn` pod to the OSO VM; negative probe to a chad prefix.

GitOps (`gitops/apps/platform-fabric/templates`):

- `fabrics.yaml`: `borderGateway` block per fabric, remove `routeReflectors`, `transportDefaults.mtu: 1442`.
- `gateways-links.yaml`: `acme-hcp1-gw` / chad gateways `transport.type: none`; `acme-oso1-gw` `transport.type: wireguard` with `siteUnderlay`; `acme-oso1-link` `tunnelType: wireguard`.
- `platformopenshift-hcps.yaml`: no change (join flag already present).

Vault: `fabric/<fabric>/bgw` (WG key pair, ingress host), `fabric/wireguard/<gateway>` (gateway VM key pair), `oso/<cloud>/mgmt-kubeconfig`.

Docs: update `fabric.md` §8.1 (BGW replaces RR pods), §8.3 (wireguard = WG over wstunnel/ingress), §10.3.5 table, §11 (defer eBGP spoke ASNs), §20.3 (VTEP CIDR = machine network). Rewrite `fabric-verify.md` after Phase 4.

## 9. Phases

Phase 0, spikes: **DONE** (2026-10-07). Layer2 no-IPAM NAD works as the hub underlay (the BGW routes transit traffic for the HCP workers); hcp1 NodePool eth1 DHCPs from the BGW; enp7s0/eth5 adjacency and 1442 MTU confirmed; `br-fabric` + bridge NAD + VM reach compute01 eth5 only with the MAC-NAT shim (§11); WireGuard inside wstunnel over a passthrough Route works (it carries the RHOSO BGP session and data path below).

Phase 1, hub BGW: **DONE**. `fabric-bgw-acme` VM in `sovereign-cloud` is the route reflector on 10.255.10.10, DHCP server on 192.168.64.1/18, and wstunnel endpoint behind Route `fabric-bgw-acme.apps.<hub>` (passthrough).

Phase 2, HCP spokes: **DONE**. hcp1 worker VTEP is its eth1 address 192.168.72.60 (DHCP from the BGW, VTEP CR `cidrs: [192.168.64.0/18]`); BGP Established hcp1 -> 10.255.10.10; Type-5 10.110.0.64/26 reflected with next-hop 192.168.72.60. WireGuard spoke pods (`fabric-wg`), the `evpn-vtep0` dummy and route pinning were removed.

Phase 3, RHOSO spoke: **DONE**. `fabric-gw-oso1` VM tunnels to the BGW; compute01 FRR Established to 10.255.10.10; Type-5 10.110.1.1/32, 10.110.1.2/32 and 10.110.1.63/32 reflected with next-hop VTEP 192.168.80.100.

End to end (verified): hcp1 CUDN pod 10.110.0.67 -> RHOSO VM 10.110.1.63 ping OK, including 1272-byte payload (1300 MTU path).

Phase 4, orchestrator + docs: **code written 2026-10-07, not yet exercised from a blank environment.** CRDs, `hybridfabric_provision/deploy_border_gateway.yml`, `platformopenshift_provision/hosted_fabric_underlay.yml`, `cloudgateway_provision/openstack_{site_gateway,edpm_evpn}.yml`, `transportlink_provision/deploy_wireguard.yml`, `networkplacement_provision` (VTEP CIDR, BGW neighbor, MTU 1300, HA chassis check), GitOps `fabrics.yaml` / `gateways-links.yaml`. Remaining acceptance: a GitOps-only bring-up on a fresh RHDP pair, chad negative probe, `NetworkPlacement.status.validated` from the live spoke probe.

## 10. Open items

- eBGP per-spoke ASNs (`fabric.md` §11) would require the BGW to re-originate Type-5 routes with its own VTEP. FRR does not re-export imported EVPN routes, so this stays deferred unless the BGW becomes a two-stage VRF design.
- One BGW VM per fabric vs. one VM with two loopbacks and two BGP instances. Start per fabric.
- Live migration of the gateway VMs: NNCP on all three RHOSO nodes and the layer2 NAD on the hub make it possible; dnsmasq leases and WireGuard state survive migration.
- HA for the OSO gateway (two VMs + VRRP on 192.168.80.1) is out of scope for the demo.
- The RHOSO management cluster's `frr-k8s`/MetalLB are unrelated to this fabric and stay untouched.

## 11. Deviations found while building (verified 2026-10-07)

| Topic | Proposal | Verified / codified |
|---|---|---|
| Multus namespace isolation | NodePool references `sovereign-cloud/fabric-underlay` | An identical NAD (same `name`, `netAttachDefName` = its own namespace) must exist in each HostedCluster VM namespace `clusters-<hcp>-<hcp>`; the NodePool references that one. |
| Hub kubemacpool | n/a | Webhook was down; namespaces labelled `mutatevirtualmachines.kubemacpool.io=ignore` (lab shim, explicit MACs anyway). |
| BGW image | DataSource | Hub DataSources not populated: registry import of `quay.io/containerdisks/centos-stream:9`. |
| BGW FRR | listen ranges hub + sites | Also `bgp listen range 10.254.254.0/24` (WireGuard net). |
| HCP FRRConfiguration | neighbor only | Neighbor 10.255.10.10 AS 65010, raw `ebgp-multihop 32`, activate in `l2vpn evpn` and `ipv4 unicast`; no router-id / update-source / allowas-in. |
| RHOSO underlay | bridge VM on enp7s0 | RHDP hypervisor drops frames whose source MAC is not the node NIC's: **MAC-NAT shim** DaemonSet on every node (nft bridge table, node MAC read at runtime). Lab only; `CloudGateway.spec.siteUnderlay.macNatShim`. Gateway VM is not pinned. |
| Gateway VM sizing | default | 1 vCPU, 1Gi guest, request 256Mi with `overcommitGuestOverhead` (nodes ~99% committed). |
| EDPM routes | `fabric_host_routes` in ansibleVars | Must be NetConfig subnet `routes` (operator overwrites `<net>_host_routes`); now also 10.254.254.0/24. |
| EDPM FRR | `edpm_frr_bgp_l2vpn_peers: [BGW]` | `edpm_frr_bgp_peers: [10.255.10.10]`, `edpm_frr_bgp_uplinks_scope: internal`, `edpm_frr_bgp_l2vpn_uplink_activate: true`, `edpm_frr_bgp_l2vpn_peers: []`, `edpm_frr_bgp_neighbor_ttl_security_hops: 0`, `edpm_frr_bgp_expose_only_host: true`, `edpm_frr_bgp_learning_routes: false`. |
| EDPM chassis | n/a | `edpm_enable_chassis_gw: true` REQUIRED, else `evpn-hcg-<router>` stays empty and the EVPN router port never binds. Router must be (re)created after it. |
| EDPM neutron-ovn | as proposed | Plus `edpm_neutron_ovn_agent_ovn_evpn_bgp_local_interface: eth5`; per-node `edpm_neutron_ovn_evpn_local_ip`. Re-running `ovn` alone clears the `ovn-evpn-*` external_ids, so `neutron-ovn` always follows `ovn`. |
| EDPM deployment | `[configure-network, frr, ovn, neutron-ovn]` | `[install-certs, configure-network, frr, ovn, neutron-ovn]` with `edpm_network_config_update: true` for that run; a NodeSet cannot be patched while one of its deployments is in progress. |
| Transport enums | `sshtunnel` | Removed from CloudGateway and TransportLink. |

## 12. Consolidation to a single platform fabric (decided 2026-10-07)

Model: one `HybridFabric` per hub (`platform-fabric`, platform-owned: AS 65010, one BGW, the hub underlay, VNI pool 51000-52127, IPAM pools, `entityRefs: [acme-corp, chad]`); CloudGateway/TransportLink per site (platform-owned); HybridNetwork/NetworkPlacement per tenant VRF (VNI + RT `65010:<vni>`). Tenants share the BGW and the tunnels; isolation is by RT (spoke import + the BGW allow-list below). `acme-fabric` and `chad-fabric` are retired; there is no second BGW, no `fabric-underlay-chad`, no 10.255.20.10.

What the code now does:

- **BGW RT allow-list.** `bgw-frr.conf.j2` renders `bgp extcommunity-list standard FABRIC-RT permit rt 65010:<vni>` for every VNI in `fabric-numbering-platform-fabric`, and `route-map SPOKES-EVPN-IN` (permit 10 match FABRIC-RT, deny 100) applied `in` on peer-group `SPOKES` in `address-family l2vpn evpn` only. With an empty ledger the route-map is deny-only, so nothing is reflected. A newly allocated VNI re-renders the config from `hybridnetwork_provision` and restarts the BGW VMI (every tenant's sessions flap for ~1-2 min); `bgw_rt_filter: off` disables the filter. The FRR 8.5 behaviour of `match extcommunity` on reflected EVPN routes is not verified live.
- **Ledger migration.** `hybridfabric_provision/tasks/ledger_migrate_legacy.yml` moves `<ns>/<network>` keys from any other `fabric-numbering-*` ConfigMap into this fabric's ledger with the same VNI, when that HybridNetwork's `spec.fabricRef` is this fabric and the VNI is free and in the pool; the keys are removed from the legacy ledger so the retired fabrics' teardown (blocked while VNIs are allocated) completes. Independently, the VNI allocator prefers the HybridNetwork's previous `status.vni`, so VNIs stay stable even if a HybridNetwork reconciles before the migration.
- **Teardown guard.** Deleting a retired fabric no longer deletes a NAD that another fabric uses (both use `fabric-underlay`) or a BGW whose name another fabric claims.
- **Vault paths derived from names** (explicit refs override): `fabric/<fabric>/bgw`, `fabric/wireguard/<cloudgateway>`, `oso/<cloudoso>/mgmt-kubeconfig`; for the lab `fabric/platform-fabric/bgw`, `fabric/wireguard/acme-oso1-gw`, `oso/oso1/mgmt-kubeconfig`.
- **ASN.** Everything is iBGP in 65010. CloudGateway `domainAsn` is set to 65010 in GitOps; the role only requires a spoke ASN on legacy RR fabrics.
- **IPAM (revised, see fabric.md §16).** Only overlay prefixes are advertised, so fabric-wide uniqueness is limited to VNI/RT, the underlay (`machineNetworkPool 192.168.64.0/18 /24`) and BGW/gateway addresses. Overlay prefixes are unique per HybridNetwork only: a NetworkPlacement must not overlap sibling placements of the same network (all backends) or the target cluster's own pod/service CIDRs; there is no cross-network check, and `hybridOverlayReserved` is dropped from GitOps (CRD field kept as advisory). Cluster pod/service CIDRs must only avoid the hub's and, with `denyOverlappingClusterCidrs`, each other. `clusterNetworkPool 100.64.0.0/11 /14` and `serviceNetworkPool 100.96.0.0/11 /16` are defaults for new clusters. **Assumption:** greenfield hub and hosted-cluster pod/service ranges come from CG-NAT 100.64.0.0/10 so tenants have all of RFC1918 for overlays. This lab predates it (hub 10.232/14 + 172.231/16; HCPs 10.128-10.151/14, 172.30-172.33/16): recorded `status.networking` is kept, checked only against the hub and the other clusters, and flagged `ipamCondition: LegacyClusterCidrs`; hcp1/2/3 pass.

### 12.1 Adoption steps for the live lab

1. Seed Vault: `fabric/platform-fabric/bgw` with the live `fabric-bgw-acme` WireGuard pair (so the OSO gateway's peer key stays valid), `fabric/wireguard/acme-oso1-gw`, `oso/oso1/mgmt-kubeconfig` (`kubeconfig`). Patch CloudOSO `oso1` with `dataplaneNodeSetRef: openstack-compute01` (`samples/cloudoso/oso1-fabric-refs.yaml`); `netConfigRef` and the kubeconfig path default correctly.
2. **Right before the sync**, delete the hand-built hub objects in `sovereign-cloud`: VM `fabric-bgw-acme` (removes its VMI and root DV), Secrets `fabric-bgw-acme-cloudinit` and `fabric-bgw-acme-wg`, Service `fabric-bgw-acme-wss`, Route `fabric-bgw-acme`. Keep NAD `fabric-underlay`; the new BGW reuses it. Two VMs with 10.255.10.10 / 192.168.64.1 on one L2 must never run together. The fabric is down from here until the new BGW finishes first boot (~5-10 min).
3. Delete VM `openstack/fabric-gw-oso1` on the RHOSO management cluster. Its cloud-init points wstunnel at `fabric-bgw-acme.apps.<hub>`; the new Route is `fabric-bgw.apps.<hub>` and cloud-init only runs once, so the CloudGateway reconcile must recreate it.
4. Sync `hs-platform-fabric`. Argo creates `platform-fabric` and prunes `acme-fabric` / `chad-fabric`. Their teardowns fail (VNIs still allocated) until step 5 has moved the keys, then delete their `fabric-numbering-*` ConfigMaps; the `fabric-underlay` NAD is kept by the teardown guard.
5. The first `platform-fabric` run creates the ledger, moves acme-core 51001, payments-vpc 51000 and chad-app 52000 (once the HybridNetworks carry `fabricRef: platform-fabric`), and creates VM `fabric-bgw` (same loopback and keys, RT allow-list for the three VNIs). If the HybridNetworks were still on the old fabricRef during that run, the next reconcile moves them.
6. HybridNetworks reconcile with their old VNIs. chad-app's canonical RT changes 65020:52000 -> 65010:52000; NetworkPlacements re-render the HCP2/HCP3 CUDN, FRRConfiguration (router AS 65020 -> 65010, neighbor 10.255.10.10) and VTEP (`cidrs: [192.168.64.0/18]`). If OVN-K rejects in-place changes to the CUDN EVPN RT or the VTEP CIDR, delete and recreate those objects (CUDN pods must be recreated).
7. hcp2/hcp3 NodePools get `additionalNetworks: clusters-<hcp>-<hcp>/fabric-underlay` and roll onto the shared underlay (DHCP from `fabric-bgw`). hcp1's worker should keep its address: dnsmasq is authoritative and acks the renewal of a free address.
8. CloudGateway `acme-oso1-gw` recreates `fabric-gw-oso1` toward `fabric-bgw.apps.<hub>`; EDPM is already converged but runs one fingerprinted deployment because the NodeSet has no `fabric-deployed` annotation yet. TransportLink `acme-oso1-link` confirms the peer on `fabric-bgw`.
9. Re-run fabric-verify checks: both spokes Established to 10.255.10.10, acme Type-5 routes present, chad Type-5 present, acme -> OSO ping, acme <-> chad negative probe.

Known cosmetic leftover: existing `PlatformOpenshift.status.networking.fabricRef` keeps the old fabric name (IPAM status is reused as recorded).
