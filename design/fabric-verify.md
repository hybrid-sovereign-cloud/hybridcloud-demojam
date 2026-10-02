# Hybrid Fabric EVPN — Live Verification Report

**Captured:** 2026-10-02T14:51Z · **WireGuard retest:** 2026-10-02T15:12Z  
**Audience:** Network architects (underlay / overlay / BGP-EVPN control plane)  
**Lab fabric:** `acme-fabric` (ASN **65010**) — spokes HCP1 (OpenShift hosted) + OSO1 (RHOSO)

| Scope | Result |
|-------|--------|
| HCP1 local EVPN (CUDN / VTEP / RA / UDN ping) | **PASS** |
| HCP1 ↔ hub RR underlay (WireGuard) | **PASS** |
| HCP1 ↔ hub RR-A BGP + Type-5 reflection | **PASS** |
| HCP1 ↔ hub RR-B | **FAIL** (RR-B on different node; no WG path yet) |
| HCP1 ↔ OSO Type-5 / dataplane | **NOT DONE** (OSO WG + BGP still TODO) |

---

## 1. Executive summary

WireGuard VTEP underlay was brought up between CENTRAL (`10.10.10.10:51820`) and HCP1 worker. With hub RR pinned to the same node as the WG hub and hub FRR using **iBGP** `remote-as 65010` (OVN-generated spoke FRR is locked to ASN 65010), BGP **Established** and the hub received HCP1’s EVPN Type-5 for `10.110.0.0/26` / RT `65010:51001`.

OSO remains local-only (Neutron EVPN router + VM). Chad links unchanged (`tunnelType: none`).

---

## 2. Connectivity model (architect view)

### 2.1 Planes

```
                    ┌──────────────────────────────────────────────────┐
                    │ CENTRAL services OCP                               │
                    │  node control-plane-…-1 (10.10.10.10)             │
                    │    lo: 10.255.10.1/32   ← hub-rr-A (hostNetwork) │
                    │    wg0: 10.254.254.1/24 ← fabric-wg-hub :51820/UDP│
                    │         route 10.255.11.0/24 dev wg0               │
                    │  node worker-…-2 (10.10.10.31)                     │
                    │    lo: 10.255.10.2/32   ← hub-rr-B (no WG yet)    │
                    └────────────────────▲─────────────────────────────┘
                                         │ WireGuard UDP/51820
                                         │ AllowedIPs: VTEP↔RR CIDRs
                    ┌────────────────────┴─────────────────────────────┐
                    │ HCP1 worker hcp1-workers-… (10.232.0.42)           │
                    │  evpn-vtep0: 10.255.11.11/32                       │
                    │  wg0: 10.254.254.11/32 → Endpoint 10.10.10.10:51820│
                    │       route 10.255.10.0/24 dev wg0                 │
                    │  FRR ASN 65010, update-source 10.255.11.11         │
                    │  peers 10.255.10.1 (Established), .2 (Connect)     │
                    │  CUDN acme-core VNI 51001 RT 65010:51001           │
                    │  UDN 10.110.0.0/24 (probes .5/.6)                  │
                    └──────────────────────────────────────────────────┘
```

### 2.2 Address / ASN table

| Role | Address / ID | Notes |
|------|----------------|-------|
| Fabric ASN | 65010 | HybridFabric + hub RR + live HCP1 FRR (OVN-locked) |
| CloudGateway spoke ASN (spec) | 65011 | Intent; MetalLB merge forces FRR ASN 65010 with OVN RA |
| Hub RR-A / RR-B | `10.255.10.1`, `10.255.10.2` | `/32` on node `lo`; pin Deployments to owning nodes |
| HCP1 VTEP | `10.255.11.11` | Unmanaged VTEP CIDR `10.255.11.0/24` |
| WG hub / spoke | `10.254.254.1/24`, `10.254.254.11/32` | Transport only; EVPN NH stays VTEP |
| Overlay HCP1 | `10.110.0.0/24` | CUDN Layer3 Primary |
| Overlay OSO | `10.110.1.0/24` | Neutron; router `evpn_vni=51001` |
| VNI / RT | 51001 / `65010:51001` | HybridNetwork `acme-core` |

### 2.3 Why `tunnelType: none` failed

TransportLink Ready with `none` only records RR peer **intent**. HCP1 had a blackhole-ish route `10.255.10.0/24 via 10.232.0.1` (CNV default GW) — ICMP/TCP to RRs never reached hub FRR. WireGuard replaces that path with `dev wg0`.

### 2.4 WireGuard policy (critical)

| Side | Routes on wg0 | Must NOT route into wg0 |
|------|----------------|-------------------------|
| Hub | `10.255.11.0/24` (spoke VTEPs) | `10.255.10.0/24` (own RR loopbacks) |
| Spoke | `10.255.10.0/24` (hub RRs) | own VTEP / machineNetwork |

Default playbook `hubRoutes: 10.255.0.0/16` would steal RR loopbacks — **fixed** to `10.255.11.0/24`.

### 2.5 BGP mode that works with OVN

OVN RouteAdvertisements generates `FRRConfiguration` with **ASN 65010** and neighbors ASN 65010. Hub `remote-as external` rejects same-ASN peers → Idle/Notifications.

**Fix:** hub RR `neighbor SPOKES remote-as 65010` (iBGP RR + `bgp listen range` + `attribute-unchanged`). Spoke `update-source 10.255.11.11` so the dynamic neighbor is the VTEP IP (EVPN NH).

---

## 3. Live pass/fail board (post-WireGuard)

### 3.1 Control plane CRs

| Object | Ready | Notes |
|--------|-------|-------|
| `hybridfabric/acme-fabric` | true | `hubRrReady=true` |
| `cloudgateway/acme-hcp1-gw` | true | GitOps → `transport.type: wireguard` |
| `transportlink/acme-hcp1-link` | true → wireguard | GitOps: `tunnelType: wireguard`, `vaultConfigRef: fabric/wireguard/hub` |
| `hybridnetwork/acme-core` | true | VNI 51001 |
| `networkplacement/acme-core-hcp1` | true | Local EVPN applied |
| `cloudoso/oso1` + `acme-core-oso1` | true | Local Neutron only |

### 3.2 WireGuard

| Check | Result |
|-------|--------|
| Vault `hybridsovereign/fabric/wireguard/hub` | Present (keys + peers; never commit) |
| Hub `fabric-wg-hub` on `control-plane-…-1` | Ready; listen UDP/51820 |
| Spoke `fabric-wg-hcp1` on HCP1 worker | Ready; handshake up |
| Ping `10.255.10.1` from spoke via wg0 | **PASS** (~1–2 ms) |
| TCP/179 to RR-A | **PASS** |
| TCP/179 to RR-B | **FAIL** (RR-B not on WG hub node) |

### 3.3 BGP / EVPN

| Check | Result | Evidence |
|-------|--------|----------|
| Hub RR-A neighbor | **PASS** | `*10.255.11.11` dynamic, Established, PfxRcd=1 |
| Hub Type-5 | **PASS** | `[5]:[0]:[26]:[10.110.0.0]` NH `10.255.11.11` RT `65010:51001` |
| HCP1 FRR ↔ 10.255.10.1 | **PASS** | Established; PfxSnt=1 |
| HCP1 FRR ↔ 10.255.10.2 | **FAIL** | Connect |
| HCP1 local CUDN / RA / UDN ping | **PASS** | unchanged from prior section |

### 3.4 OSO (unchanged)

| Object | Value |
|--------|-------|
| Network | `acme-core-oso1` geneve ACTIVE |
| Subnet | `10.110.1.0/24` |
| Router | `evpn_vni=51001` |
| VM | `acme-core-oso1-evpn-vm` `10.110.1.63` ACTIVE |

---

## 4. Command wiring

### 4.1 Access

| Target | How |
|--------|-----|
| CENTRAL | default `oc` kubeconfig |
| HCP1 | Jump pod + secret `hcp1-admin-kubeconfig-verify` (API NodePort `10.10.10.10:32323`) |
| Vault | `oc exec -n vault vault-0` + root token from `vault-init` |
| OSO | `oso-clouds-oso1` → `clouds.yaml` |

### 4.2 WireGuard status

```bash
# Hub
oc -n sovereign-cloud get pods -l app=fabric-wg-hub -o wide
oc -n sovereign-cloud exec deploy/fabric-wg-hub -- /binaries/wg show
oc -n sovereign-cloud exec deploy/fabric-wg-hub -- ip route | grep 10.255

# Spoke (inside HCP1 jump)
oc -n fabric-wg get pods -o wide
oc -n fabric-wg exec deploy/fabric-wg-hcp1 -- /binaries/wg show
oc -n fabric-wg exec deploy/fabric-wg-hcp1 -- bash -lc \
  'ping -c 2 10.255.10.1; timeout 3 bash -c "echo >/dev/tcp/10.255.10.1/179" && echo RR1_OK'
```

### 4.3 Hub RR + Type-5

```bash
oc -n sovereign-cloud get pods -o wide | grep hub-rr
# RR-A MUST be on same node as fabric-wg-hub (owns 10.255.10.1)
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show running-config'
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show bgp l2vpn evpn summary'
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show bgp l2vpn evpn'
# Expect: neighbor *10.255.11.11 Established, Type-5 10.110.0.0 RT 65010:51001
```

### 4.4 HCP1 FRR / OVN (jump)

```bash
export KUBECONFIG=/kube/kubeconfig
oc get vtep,clusteruserdefinednetwork,routeadvertisements
oc get frrconfiguration -n openshift-frr-k8s
FRR=$(oc -n openshift-frr-k8s get pods -l app=frr-k8s -o jsonpath='{.items[0].metadata.name}')
oc -n openshift-frr-k8s exec "$FRR" -c frr -- vtysh -c 'show bgp l2vpn evpn summary'
oc -n openshift-frr-k8s exec "$FRR" -c frr -- vtysh -c 'show bgp l2vpn evpn'

# UDN ping (CAP_NET_RAW)
oc -n acme-core-udn exec evpn-probe-ping -- ping -c 3 -W 2 10.110.0.5
```

### 4.5 Vault ref (no secrets in Git)

```text
vaultConfigRef: fabric/wireguard/hub
mount: hybridsovereign
fields: hubPrivateKey, hubEndpoint, hubNodeName, hubRoutes, spokeRoutes, peers[]
```

### 4.6 GitOps intent (platform-fabric)

```yaml
# TransportLink acme-hcp1-link
tunnelType: wireguard
vaultConfigRef: fabric/wireguard/hub
# CloudGateway acme-hcp1-gw
transport:
  type: wireguard
```

---

## 5. What was fixed in this pass

1. **Generated WG keys** → Vault `fabric/wireguard/hub` (not in Git).  
2. **Hub WG** Deployment in `sovereign-cloud` (hostNetwork, node `control-plane-…-1`, routes `10.255.11.0/24`).  
3. **Spoke WG** on HCP1 (`fabric-wg` ns), routes `10.255.10.0/24`, removed conflicting `via 10.232.0.1` route.  
4. **Hub RR iBGP** `remote-as 65010` (template + live ConfigMaps).  
5. **Pinned** `hub-rr-10-255-10-1` to node owning `10.255.10.1` / WG hub (RR had drifted → TCP/179 refused).  
6. **Spoke FRR** `update-source 10.255.11.11` so hub dynamic neighbor = VTEP.  
7. **GitOps** `acme-hcp1-link` / GW → wireguard + vaultConfigRef; playbook hubRoutes default corrected.

---

## 6. Remaining gaps

| Gap | Impact | Next step |
|-----|--------|-----------|
| RR-B not on WG path | Second RR stays Connect | Second WG hub endpoint, or route `10.255.10.2` via hub cluster to RR-B node |
| OSO WireGuard + BGP | No HCP1↔OSO EVPN | Peer OSO in Vault `peers[]`, deploy spoke WG, advertise `10.110.1.0/24` |
| AAP playbook spoke deploy | Hub-only in `deploy_wireguard.yml` v1 | Extend to apply `wg-spoke-deploy.yml.j2` with spoke kubeconfig |
| ASN 65011 vs 65010 | Spec vs OVN lock | Document as OVN constraint; keep hub iBGP 65010 |
| RR nodeSelector persistence | Must survive HybridFabric reconcile | Ensure `hf_rr_node_name` / `nodeName` on `routeReflectors[]` |

---

## 7. Verdict

**HCP1 → hub RR-A fabric EVPN control plane: PASS** (WireGuard underlay + iBGP + Type-5 on hub).

**Full fabric (both RRs + OSO + cross-ping): NOT complete** — enable RR-B reachability and OSO WG/BGP next.

```bash
# Golden hub check after any change:
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show bgp l2vpn evpn summary'
# Expect: *10.255.11.11 … Established … PfxRcd ≥ 1
```
