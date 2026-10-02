# Hybrid Fabric EVPN — Live Verification Report

**Captured:** 2026-10-02T14:51Z (re-verified ~14:53Z)  
**Audience:** Network architects (underlay / overlay / BGP-EVPN control plane)  
**Lab fabric:** `acme-fabric` (ASN **65010**) — spokes HCP1 (OpenShift hosted) + OSO1 (RHOSO)  
**Overall HCP1 local EVPN:** **PASS**  
**Cross-site Type-5 (HCP1 ↔ hub RR ↔ OSO):** **BLOCKED** (BGP sessions stuck in `Connect`; `tunnelType: none`)

---

## 1. Executive summary

| Plane | What we proved | Result |
|------|----------------|--------|
| Sovereign control plane | HybridFabric / CloudGateway / TransportLink / HybridNetwork / NetworkPlacement Ready | **PASS** |
| HCP1 OVN EVPN objects | Unmanaged VTEP Allocated; CUDN NetworkCreated + TransportAccepted; RouteAdvertisements Accepted | **PASS** |
| HCP1 UDN dataplane | Primary UDN ping `10.110.0.6 → 10.110.0.5` (VNI 51001 VRF) | **PASS** |
| HCP1 local Type-5 | FRR originates `[5]:[0]:[26]:[10.110.0.0]` with `RT:65010:51001`, NH `10.255.11.11` | **PASS** (local RIB only) |
| Hub RR reflection | Hub FRR listen-range on `10.255.10.1/2` ASN 65010; **0** spoke neighbors | **FAIL** (no peering) |
| HCP1 → hub BGP | Neighbors `10.255.10.1` / `10.255.10.2` state **Connect**, 0 messages | **FAIL** (underlay) |
| OSO Neutron | Project `acme-corp`, net `acme-core-oso1` (`10.110.1.0/24`), EVPN router `evpn_vni=51001`, VM `10.110.1.63` ACTIVE | **PASS** (local OSO); geneve seg≠VNI |
| HCP1 ↔ OSO EVPN | Requires Established BGP to hub RRs + OSO dataplane Type-5 | **NOT VERIFIED** |

---

## 2. Connectivity model (architect view)

### 2.1 Address / ASN plan (Acme)

```
                    ┌─────────────────────────────────────────┐
                    │         CENTRAL (services OCP)            │
                    │  HybridFabric acme-fabric ASN 65010       │
                    │  Hub RR-A 10.255.10.1  (router-id same)   │
                    │  Hub RR-B 10.255.10.2  (router-id same)   │
                    │  FRR: bgp listen-range 0.0.0.0/0 SPOKES   │
                    │       AFI l2vpn evpn, attribute-unchanged │
                    └───────────────┬───────────────────────────┘
                                    │  intended: TCP/179 + VXLAN underlay
                                    │  actual today: NO PATH (tunnelType=none)
              ┌─────────────────────┴─────────────────────┐
              │                                           │
   ┌──────────▼──────────┐                     ┌──────────▼──────────┐
   │ HCP1 (hosted worker)│                     │ OSO1 (RHOSO)        │
   │ CloudGW ASN 65011*  │                     │ CloudGW acme-oso1-gw│
   │ VTEP IP 10.255.11.11│                     │ Tenant project      │
   │ FRR ASN 65010 live* │                     │  acme-corp          │
   │ CUDN acme-core      │                     │ Net 10.110.1.0/24   │
   │  overlay 10.110.0.0/24                    │ Router evpn_vni=51001│
   │  RT 65010:51001 VNI 51001                 │ VM 10.110.1.63      │
   └─────────────────────┘                     └─────────────────────┘

* Spec intent: spoke ASN 65011 (CloudGateway.domainAsn). Live HCP1 FRRConfiguration
  uses ASN 65010 (fabric ASN) with allowas-in toward hub. Treat as lab quirk until
  playbooks emit spoke ASN consistently.
```

### 2.2 Overlay (EVPN IP-VRF) — what “works locally”

| Role | CIDR / ID | Where |
|------|-----------|--------|
| HybridNetwork `acme-core` | VNI **51001**, RT **65010:51001** | Sovereign ledger |
| HCP1 CUDN Layer3 Primary | `10.110.0.0/24` hostSubnet `/26` | OVN IP-VRF on HCP1 |
| HCP1 UDN probe IPs | `10.110.0.3`, `.5`, `.6` (primary role) | ns `acme-core-udn` |
| OSO Neutron subnet | `10.110.1.0/24` (gateway `.1`) | Project `acme-corp` |
| OSO EVPN router | `evpn_vni: 51001` | `acme-core-oso1-evpn-rtr` |

Same HybridNetwork → same VNI/RT on both ends by design. East-west **within** HCP1 UDN does **not** need hub RR. East-west **HCP1↔OSO** needs Type-5 exchange via hub RRs (or alternate RR path).

### 2.3 Underlay / VTEP — what must exist for BGP + VXLAN

| Segment | Design | Live |
|---------|--------|------|
| Hub RR loopbacks | `10.255.10.1`, `10.255.10.2` on central hostNetwork FRR | Present; FRR Ready |
| HCP1 VTEP underlay CIDR | Unmanaged VTEP `10.255.11.0/24` (not Hypershift machineNetwork) | **Live:** VTEP CR `cidrs: [10.255.11.0/24]` |
| HCP1 node VTEP IP | On-node address in VTEP CIDR + annotation `k8s.ovn.org/vteps` | **Live:** `10.255.11.11` on dummy `evpn-vtep0`; annotation `{"acme-core-evpn-vtep":{"ips":["10.255.11.11"]}}` |
| CloudGateway landing | `status.gatewayAddress=10.255.11.1` | Logical GW address (not the FRR router-id) |
| HCP1 machineNetwork | `192.168.64.0/24` from fabric IPAM | Node/VM underlay for Hypershift — **must not** be used as VTEP CIDR |
| TransportLink | `tunnelType: none` | **No WireGuard/IPsec** — assumes L3 reachability VTEP↔RR exists; **it does not** in this lab → BGP `Connect` |

### 2.4 Control-plane wiring (CR → network object)

```
HybridFabric acme-fabric
  domainAsn=65010
  routeReflectors[] → hub-rr Deployments (hostNetwork FRR)
  vniPool 51000–51127
  ipam.* → PlatformOpenshift CIDR carve
        │
        ├─ CloudGateway acme-hcp1-gw (domainAsn=65011, transport.none)
        │     └─ TransportLink acme-hcp1-link (tunnelType=none)
        │
        └─ HybridNetwork acme-core → status.vni=51001, canonicalRt=65010:51001
              │
              ├─ NetworkPlacement acme-core-hcp1 (backend PlatformOpenshift/hcp1)
              │     EDA applies on spoke:
              │       VTEP (Unmanaged) → node IPs in cidr
              │       FRRConfiguration (neighbors = fabric RRs)
              │       ClusterUserDefinedNetwork (transport=EVPN, vni/rt)
              │       RouteAdvertisements (targetVRF=auto, select CUDN labels)
              │
              └─ NetworkPlacement acme-core-oso1 (backend CloudOSO/oso1)
                    Neutron network + subnet + EVPN router (evpn_vni) + test VM
```

### 2.5 Packet / session flows

**A. HCP1 intra-UDN (PASS)**  
`evpn-probe-ping (10.110.0.6)` → OVN primary UDN → `evpn-probe-b (10.110.0.5)`  
No BGP, no hub, no VTEP underlay required.

**B. HCP1 Type-5 origination (PASS locally)**  
OVN + RouteAdvertisements (`advertisements: PodNetwork`, `targetVRF: auto`) → FRR installs:

```
RD 10.110.0.2:2
*> [5]:[0]:[26]:[10.110.0.0]  NH 10.255.11.11  RT:65010:51001
```

**C. HCP1 → Hub RR BGP (FAIL)**  
Intended: FRR `10.255.11.11` TCP/179 → `10.255.10.1` and `10.255.10.2` (multihop).  
Observed: state `Connect`, MsgRcvd/Sent `0`. Hub shows `% No BGP neighbors found`.  
Root cause class: **no L3 underlay** from HCP1 VTEP IP to hub RR IPs while `tunnelType: none` (WireGuard/IPsec not enabled on this link).

**D. OSO local (PASS objects; EVPN to fabric unverified)**  
VM `10.110.1.63` on geneve tenant net; router carries `evpn_vni=51001`. Provider net type remains `geneve` / seg `27696` (Neutron VNI is on the **router**, not `provider:segmentation_id`).

---

## 3. Live pass/fail board

### 3.1 Sovereign CRs

| Object | Ready | Notes |
|--------|-------|-------|
| `hybridfabric/acme-fabric` | true | `hubRrReady=true`, ASN 65010 |
| `cloudgateway/acme-hcp1-gw` | true | `gatewayAddress=10.255.11.1`, peers=2 |
| `transportlink/acme-hcp1-link` | true | `tunnelType=none` |
| `cloudgateway/acme-oso1-gw` | true | OpenStack spoke |
| `transportlink/acme-oso1-link` | true | |
| `hybridnetwork/acme-core` | true | VNI 51001 |
| `networkplacement/acme-core-hcp1` | true | backendApplied (msg still cites old VTEP cidr `192.168.64.0/24` — stale status text; live VTEP is `10.255.11.0/24`) |
| `networkplacement/acme-core-oso1` | true | Neutron realized; status notes EvpnDeferred CLI gap in AAP EE |
| `cloudoso/oso1` | true | Project `acme-corp` |

### 3.2 HCP1 OVN / FRR

| Check | Result | Evidence |
|-------|--------|----------|
| VTEP Accepted | **PASS** | `True/Allocated`, cidr `10.255.11.0/24` |
| Node `k8s.ovn.org/vteps` | **PASS** | `{"acme-core-evpn-vtep":{"ips":["10.255.11.11"]}}` |
| CUDN NetworkCreated | **PASS** | NAD in `acme-core-udn` |
| CUDN TransportAccepted | **PASS** | `EVPNTransportAccepted` |
| RA Accepted | **PASS** | requires `targetVRF: auto` |
| VNI / RT | **PASS** | `51001` / `65010:51001` |
| UDN ping | **PASS** | 3/3, ~0.15–1.2 ms |
| Local Type-5 | **PASS** | prefix `10.110.0.0/26` style Type-5 in FRR |
| BGP to hub | **FAIL** | `Connect` both peers |

### 3.3 Hub RR

| Check | Result |
|-------|--------|
| Deployments `hub-rr-10-255-10-{1,2}` Available | **PASS** |
| FRR ASN 65010, listen-range SPOKES, AF l2vpn evpn | **PASS** (config) |
| Spoke BGP neighbors / EVPN prefixes | **FAIL** (empty) |

### 3.4 OSO

| Check | Result |
|-------|--------|
| Network `acme-core-oso1` ACTIVE | **PASS** (`geneve`, project acme-corp) |
| Subnet `10.110.1.0/24` | **PASS** |
| Router `acme-core-oso1-evpn-rtr` `evpn_vni=51001` ACTIVE | **PASS** |
| VM `acme-core-oso1-evpn-vm` `10.110.1.63` ACTIVE | **PASS** |

---

## 4. Command wiring (how to re-verify)

### 4.1 Access model (important)

| Target | From workstation? | How |
|--------|-------------------|-----|
| Central services OCP | Yes | `oc` default kubeconfig |
| HCP1 API | **No** (API is NodePort on hub) | Jump pod in `sovereign-cloud-jobs` mounting secret `hcp1-admin-kubeconfig-verify` (or `clusters-hcp1-hcp1/hcp1-admin-kubeconfig` rewritten to `https://10.10.10.10:32323`) |
| OSO Keystone/Neutron | Yes if clouds.yaml present | Secret `oso-clouds-oso1` in `entity-acme-corp` |

HCP1 kube-apiserver Service (hub):

```bash
oc get svc -n clusters-hcp1-hcp1 kube-apiserver -o wide
# NodePort 6443:32323/TCP — use hub node IP :32323 in kubeconfig
```

### 4.2 Central — fabric board

```bash
oc get hybridfabric,cloudgateway,transportlink -n sovereign-cloud -o wide
oc get hybridnetwork,networkplacement -A
oc get hybridfabric acme-fabric -n sovereign-cloud -o yaml
oc get cloudgateway acme-hcp1-gw -n sovereign-cloud \
  -o jsonpath='ready={.status.ready} gw={.status.gatewayAddress} peers={.status.peerCount}{"\n"}'
oc get transportlink acme-hcp1-link -n sovereign-cloud \
  -o jsonpath='tunnel={.spec.tunnelType} ready={.status.ready}{"\n"}'
oc get platformopenshift hcp1 -n entity-acme-corp \
  -o jsonpath='{.status.networking}{"\n"}'
```

### 4.3 Central — hub RR (BGP reflector)

```bash
oc get deploy,pods -n sovereign-cloud | grep hub-rr
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show running-config'
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show bgp l2vpn evpn summary'
oc -n sovereign-cloud exec deploy/hub-rr-10-255-10-1 -- vtysh -c 'show bgp l2vpn evpn'
# Expect after underlay fix: SPOKES neighbors Established + Type-5 with RT 65010:51001
```

Hub RR intent (live config excerpt):

```
router bgp 65010
 bgp router-id 10.255.10.1
 neighbor SPOKES peer-group
 neighbor SPOKES remote-as external
 neighbor SPOKES ebgp-multihop 32
 bgp listen range 0.0.0.0/0 peer-group SPOKES
 address-family l2vpn evpn
  neighbor SPOKES activate
  neighbor SPOKES attribute-unchanged as-path next-hop med
```

### 4.4 HCP1 — jump + EVPN object status

```bash
NS=sovereign-cloud-jobs
oc -n "$NS" run evpn-arch-shell --rm -it --restart=Never \
  --image=quay.io/openshift/origin-cli:4.16 \
  --overrides='{"spec":{"containers":[{"name":"shell","image":"quay.io/openshift/origin-cli:4.16","command":["bash"],"stdin":true,"tty":true,"volumeMounts":[{"name":"kube","mountPath":"/kube","readOnly":true}],"securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}}],"volumes":[{"name":"kube","secret":{"secretName":"hcp1-admin-kubeconfig-verify","items":[{"key":"kubeconfig","path":"kubeconfig"}]}}]}}'
```

Inside the jump shell:

```bash
export KUBECONFIG=/kube/kubeconfig

# Objects
oc get vtep,clusteruserdefinednetwork,routeadvertisements
oc get frrconfiguration -n openshift-frr-k8s
oc get network-attachment-definitions -A

# Pass criteria
oc get vtep acme-core-evpn-vtep -o jsonpath='{.status.conditions[?(@.type=="Accepted")]}{"\n"}'
oc get clusteruserdefinednetwork acme-core \
  -o jsonpath='{range .status.conditions[*]}{.type}={.status}/{.reason}{"\n"}{end}'
oc get routeadvertisements advertise-acme-core-evpn \
  -o jsonpath='{.status.conditions[?(@.type=="Accepted")]}{"\n"}'

# VTEP underlay binding
oc get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.metadata.annotations.k8s\.ovn\.org/vteps}{"\n"}{end}'

# BGP + Type-5
FRR=$(oc -n openshift-frr-k8s get pods -l app=frr-k8s -o jsonpath='{.items[0].metadata.name}')
oc -n openshift-frr-k8s exec "$FRR" -c frr -- vtysh -c 'show bgp summary'
oc -n openshift-frr-k8s exec "$FRR" -c frr -- vtysh -c 'show bgp l2vpn evpn summary'
oc -n openshift-frr-k8s exec "$FRR" -c frr -- vtysh -c 'show bgp l2vpn evpn'
```

### 4.5 HCP1 — UDN dataplane (overlay ping)

Requires namespace labeled for CUDN + primary UDN:

- `hybridsovereign.redhat/hybridnetwork=acme-core`
- `k8s.ovn.org/primary-user-defined-network=""`

```bash
# Primary UDN IPs are in annotation, NOT status.podIP (podIP is default cluster network)
A=$(oc -n acme-core-udn get pod evpn-probe-ping \
  -o jsonpath='{.metadata.annotations.k8s\.ovn\.org/pod-networks}' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(next(v["ip_address"].split("/")[0] for v in d.values() if v.get("role")=="primary"))')
B=$(oc -n acme-core-udn get pod evpn-probe-b \
  -o jsonpath='{.metadata.annotations.k8s\.ovn\.org/pod-networks}' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(next(v["ip_address"].split("/")[0] for v in d.values() if v.get("role")=="primary"))')
echo "A=$A B=$B"
oc -n acme-core-udn exec evpn-probe-ping -- ping -c 3 -W 2 "$B"
# ping needs CAP_NET_RAW (evpn-probe-ping); plain busybox without NET_RAW → permission denied
```

Live result: `10.110.0.6 → 10.110.0.5`, 0% loss.

### 4.6 Unmanaged VTEP bootstrap (lab prerequisite)

OVN Unmanaged mode does **not** assign VTEP IPs. Node must already have an address in the VTEP CIDR; OVN then annotates the node.

```bash
# On HCP1 worker (privileged hostNetwork pod):
ip link add evpn-vtep0 type dummy || true
ip addr replace 10.255.11.11/32 dev evpn-vtep0
ip link set evpn-vtep0 up
# Expect: oc get vtep ... Accepted=True; node annotation lists 10.255.11.11
```

Do **not** set VTEP `cidrs` to Hypershift `machineNetwork` (`192.168.64.0/24`) — that is the node CIDR, not the EVPN VTEP underlay.

### 4.7 RouteAdvertisements — required fields

```yaml
apiVersion: k8s.ovn.org/v1
kind: RouteAdvertisements
metadata:
  name: advertise-acme-core-evpn
spec:
  advertisements: ["PodNetwork"]
  targetVRF: auto          # REQUIRED for EVPN IP-VRF (empty → ConfigurationError)
  frrConfigurationSelector:
    matchLabels:
      evpn: "true"
  networkSelectors:
  - networkSelectionType: ClusterUserDefinedNetworks
    clusterUserDefinedNetworkSelector:
      networkSelector:
        matchLabels:
          hybridsovereign.redhat/network: acme-core
```

Without a namespace matching the CUDN `namespaceSelector`, RA stays `no networks selected` and CUDN `TransportAccepted=False`.

### 4.8 OSO — Neutron / EVPN router / VM

```bash
# clouds.yaml from:
#   oc get secret oso-clouds-oso1 -n entity-acme-corp -o jsonpath='{.data.clouds\.yaml}' | base64 -d
export OS_CLOUD=default

openstack network show acme-core-oso1 -c name -c status -c provider:network_type -c provider:segmentation_id -c subnets
openstack subnet list --network acme-core-oso1
openstack router show acme-core-oso1-evpn-rtr -c name -c status -c evpn_vni -c interfaces_info
openstack server show acme-core-oso1-evpn-vm -c name -c status -c addresses
```

Live:

| Object | Value |
|--------|-------|
| Network | `acme-core-oso1`, geneve, seg 27696, ACTIVE |
| Subnet | `10.110.1.0/24` |
| Router | `evpn_vni=51001`, iface `10.110.1.1` |
| VM | `acme-core-oso1-evpn-vm`, `10.110.1.63`, ACTIVE |

---

## 5. Interpreting results (architect checklist)

1. **Local OVN EVPN ready?** VTEP Allocated + CUDN TransportAccepted + RA Accepted + local Type-5 in FRR.  
   → This lab: **YES** on HCP1.

2. **Overlay dataplane inside spoke?** Primary UDN ping using annotation IPs.  
   → This lab: **YES**.

3. **Is the VTEP underlay congruent?** Node IP ∈ VTEP CIDR; CIDR ≠ machineNetwork.  
   → This lab: **YES** (`10.255.11.11` ∈ `10.255.11.0/24`).

4. **Will Type-5 leave the spoke?** BGP Established to fabric RRs + hub shows neighbor + prefixes.  
   → This lab: **NO** (`Connect`; hub has zero neighbors).

5. **Why BGP fails with Ready TransportLink?** `tunnelType: none` means “assume underlay already routes VTEP↔RR.” Without WireGuard/IPsec or real L3, CR Ready ≠ session up.

6. **OSO EVPN attached?** Router `evpn_vni` matching HybridNetwork VNI; do not expect `provider:segmentation_id == VNI` on geneve tenant nets.

7. **ASN consistency:** CloudGateway advertises spoke ASN **65011**; live HCP1 FRR uses **65010** + `allowas-in`. Hub uses `remote-as external` (accepts either). Clean-up: align FRRConfiguration ASN to `CloudGateway.spec.domainAsn`.

---

## 6. Gaps / next wiring for full fabric EVPN

| Gap | Impact | Remediation |
|-----|--------|-------------|
| No L3 path HCP1 VTEP (`10.255.11.11`) → hub RR (`10.255.10.1/2`) | BGP stays Connect; no Type-5 reflection | Set TransportLink `tunnelType: wireguard` (or ipsec) + Vault keys, **or** provide routed underlay |
| Hub RR has 0 neighbors | No inter-spoke EVPN | Follows underlay fix |
| OSO FRR/dataplane not verified to hub | No HCP1↔OSO ping | After BGP up: check OSO OVN-BGP agent / Type-5 for `10.110.1.0/24` |
| Placement status text cites `192.168.64.0/24` | Misleading ops signal | Reconcile NP after VTEP CIDR playbook fix (`10.255.11.0/24` default) |
| Spoke ASN 65011 vs FRR 65010 | Confusing design vs live | Emit `domainAsn` from CloudGateway into FRRConfiguration |

---

## 7. Verdict

**HCP1 local EVPN (OVN CUDN + VTEP + RA + UDN dataplane + local Type-5): PASS.**

**Fabric-wide EVPN (spoke ↔ hub RR ↔ remote spoke/OSO): FAIL / not ready** until VTEP underlay reachability to `10.255.10.1/2` exists (enable encrypted transport or routed underlay), then re-check:

```bash
# HCP1 FRR
show bgp l2vpn evpn summary   # expect Established
# Hub RR
show bgp l2vpn evpn summary   # expect spoke neighbor + PfxRcd
show bgp l2vpn evpn           # expect RT 65010:51001 Type-5 from 10.255.11.11 and OSO
```
