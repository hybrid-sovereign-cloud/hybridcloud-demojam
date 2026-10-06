# Hybrid Fabric EVPN — Live Verification Report

**Captured:** 2026-10-02T16:22Z · **Decay retest:** 2026-10-06T16:07Z · **Restore:** 2026-10-06T16:25Z  
**Audience:** Network architects (underlay / overlay / BGP-EVPN control plane)  
**Lab fabric:** `acme-fabric` (ASN **65010**) — spokes HCP1 (OpenShift hosted) + OSO1 (RHOSO)  
**Cluster:** `api.cluster-ngjtm.dyn.redhatworkshops.io` (CENTRAL)

| Scope | 2026-10-02 | 2026-10-06 decay | **2026-10-06 after restore** |
|-------|------------|------------------|------------------------------|
| HybridFabric / HybridNetwork / Placement CRs Ready | PASS | PASS | **PASS** |
| HCP1 local EVPN (CUDN / VTEP / Type-5 local) | PASS | PASS | **PASS** |
| HCP1 ↔ hub RR underlay (WireGuard) | PASS | DEGRADED | **PASS** (routes forced `dev wg0`) |
| HCP1 ↔ hub RR-A/B BGP | PASS | FAIL | **PASS** (Established both) |
| Hub Type-5 reflection HCP1 ↔ OSO | PASS | FAIL | **PASS** (both Type-5 on RR + spokes) |
| OSO ↔ hub underlay (SSH TUN) | PASS | FAIL | **PASS** (lab TUN restored) |
| OSO ↔ hub BGP + Type-5 | PASS | FAIL | **PASS** (GoBGP ASN 65010) |
| VTEP HCP1 ↔ OSO | PASS | FAIL | **PASS** (HCP1→OSO ICMP OK) |
| Overlay cross-ping HCP1 ↔ OSO VM | FAIL | FAIL | **FAIL** (CP only; no OVN dataplane EVPN) |

---

## 1. Executive summary (restore)

**CR Ready never meant live BGP.** On decay, every Hybrid* / NetworkPlacement / TransportLink object was still `ready=true`, while hub RRs had **zero** neighbors. Restore brought control plane back to the 10-02 shape:

- Hub RR-A/B: dynamic neighbors `10.255.11.11` (FRR) + `10.255.12.1` (GoBGP), each **PfxRcd=1**.
- Type-5 reflected both ways: `10.110.0.0/26` NH `10.255.11.11` and `10.110.1.0/24` NH `10.255.12.1`, RT `65010:51001`.
- HCP1 FRR shows both local + remote Type-5; OSO GoBGP shows HCP1 Type-5 from both RRs.
- EVPN VM `acme-core-oso1-evpn-vm` powered **ACTIVE** (`10.110.1.63`).
- Overlay UDN↔VM still **FAIL** — lab GoBGP is not Neutron/OVN dataplane.

---

## 2. Why it looked “broken” despite Ready CRs

| Layer | What Ready means | What actually failed |
|-------|------------------|----------------------|
| `HybridFabric` | RR Deployments + listen/`route-reflector-client` exist | Sessions need reachable spoke VTEPs |
| `HybridNetwork` + `NetworkPlacement` | Spoke FRRConfiguration **peers** + prefixes/CUDN/Neutron applied | Peers ≠ Established; TCP/179 needs underlay |
| `TransportLink` HCP1 `tunnelType: wireguard` | WG Deployment + Vault keys applied once | **Host routes** `10.255.10.0/24` stolen by CNV machine GW (`via 10.232.0.1`) after churn — handshake can stay up while RR CIDR leaves `wg0` |
| `TransportLink` OSO `tunnelType: none` | Explicit **no** underlay automation; status text even documents RR peer *intent* only | SSH TUN + GoBGP were **lab-only** (10-02) and vanished with pod/node restart |
| AAP `networkplacement-ready` / `transportlink-ready` | Job exit 0 at apply time | No continuous BGP/underlay probes (`validated` skipped in lab) |

**Bottom line:** Networking CRs correctly deployed FRR **peer config** toward `10.255.10.1/2`. They do **not** keep WireGuard policy routes, SSH TUN, or OSO BGP daemon alive. `tunnelType=none` on `acme-oso1-link` is why OSO BGP was never durable GitOps.

---

## 3. CR board (CENTRAL) — unchanged Ready

| Object | Ready | Notes |
|--------|-------|-------|
| `hybridfabric/acme-fabric` | true | ASN 65010; RR `10.255.10.1`, `10.255.10.2` |
| `hybridnetwork/acme-core` | true | VNI 51001 |
| `transportlink/acme-hcp1-link` | true | **`spec.tunnelType: wireguard`** |
| `transportlink/acme-oso1-link` | true | **`spec.tunnelType: none`** — underlay not owned by operator |
| `networkplacement/acme-core-hcp1` | true | FRR/VTEP/CUDN applied; probes skipped |
| `networkplacement/acme-core-oso1` | true | Neutron net/subnet; EvpnDeferred historically |

Pods: `hub-rr-10-255-10-{1,2}`, `fabric-wg-hub`, `fabric-ssh-tunnel` Running.

---

## 4. Live control / underlay (after restore)

### 4.1 Hub RR (both)

```
Neighbor        AS  Up/Down  State/PfxRcd  Desc
*10.255.11.11 65010 ~7m     1             FRRouting/10.4.3
*10.255.12.1  65010 ~4m     1             GoBGP/3.29.0

Type-5:
  [5]:[0]:[26]:[10.110.0.0]  NH 10.255.11.11  RT:65010:51001
  [5]:[0]:[24]:[10.110.1.0]  NH 10.255.12.1   RT:65010:51001
```

### 4.2 HCP1 spoke

| Check | Result |
|-------|--------|
| Worker | `hcp1-workers-…` **10.232.0.51** |
| Local Type-5 | PASS — `10.110.0.0/26` |
| Learned OSO Type-5 | **PASS** — `10.110.1.0/24` NH `10.255.12.1` |
| BGP to both RRs | **Established**, PfxRcd=1 each |
| Routes | `10.255.10.0/24`, `10.255.12.0/24`, `10.110.1.0/24` **`dev wg0` src `10.255.11.11`** (re-applied) |
| Ping RR-A/B + OSO VTEP | **PASS** from spoke |

### 4.3 OSO (RHOSO)

| Check | Result |
|-------|--------|
| SSH TUN `tun0` hub↔compute | **UP** (`10.254.253.0/30`); hub↔`10.255.12.1` ICMP OK |
| GoBGP ASN 65010 | **Established** both RRs; advertises `10.110.1.0/24` label/RT `51001` / `65010:51001` |
| Neutron `acme-core-oso1` | ACTIVE, geneve, `10.110.1.0/24` |
| VM `acme-core-oso1-evpn-vm` | **ACTIVE** `10.110.1.63` (was SHUTOFF; started) |

### 4.4 Caveats still open

- Hub→HCP1 VTEP ICMP may stay asymmetric even when BGP is up (AllowedIPs/`wg0` return quirks).
- HCP1 WG routes are **not durable** — CNV GW can steal `10.255.10.0/24` again after restart.
- OSO path is still **lab**: SSH TUN + compute GoBGP, not OVN-native EVPN gateway.
- Overlay cross-ping remains FAIL until Neutron/OVN programs the Type-5 dataplane.

---

## 5. Connectivity model (current)

```
                    ┌─ CENTRAL ─────────────────────────────────────────┐
                    │ RR-A 10.255.10.1  RR-B 10.255.10.2               │
                    │ WG hub :51820  ↔ HCP1  (BGP OK)                   │
                    │ SSH TUN tun0   ↔ OSO   (BGP OK)                   │
                    │ Type-5 both prefixes reflected                    │
                    └──────────────▲──────────────────▲─────────────────┘
                                   │ WG               │ SSH TUN
                    ┌──────────────┴──┐        ┌──────┴─────────────────┐
                    │ HCP1 VTEP       │        │ OSO VTEP 10.255.12.1   │
                    │ 10.255.11.11    │        │ GoBGP lab + Neutron    │
                    │ FRR Established │        │ VM 10.110.1.63 ACTIVE  │
                    └─────────────────┘        └────────────────────────┘
                    Overlay UDN ↔ VM: still FAIL (no OVN EVPN dataplane)
```

---

## 6. Restore actions taken (2026-10-06)

1. Started SHUTOFF VM `acme-core-oso1-evpn-vm`.
2. Re-applied HCP1 `dev wg0` routes (via in-cluster hostNetwork helper to HCP API `10.10.10.10:32323`).
3. Ensured hub RR-B host route `10.255.10.2 via 10.10.10.31`.
4. Regenerated SSH keys / brought up `fabric-ssh-tunnel` + compute `tun0`.
5. Started GoBGP on OSO compute (`172.22.0.100`), peered both RRs, advertised Type-5 `10.110.1.0/24`.

None of (2–5) are GitOps-persistent today for OSO; HCP1 WG Deploy exists but route policy needs a persistence loop or CNV coexistence fix.

---

## 7. Recommended durable fixes

1. **TransportLink OSO:** move off `tunnelType: none` to WG or managed SSH TUN (or OVN gateway BGP) so Ready tracks real underlay.
2. **HCP1 WG:** keep `10.255.10.0/24` (+ OSO VTEP CIDR) on `wg0` against CNV default route (PolicyRoute / continuous `wg-start` reconcile).
3. **OSO EVPN:** OVN-native BGP-EVPN on gateway — retire compute GoBGP for anything beyond lab CP demos.
4. **Readiness:** optional live probe (TCP/179 or `show bgp summary`) before marking NetworkPlacement/`validated` true.

---

## 8. Artifacts

| Item | Path / note |
|------|-------------|
| This report | `design/fabric-verify.md` |
| Decay capture | `/tmp/fabric-verify-20261006/` |
| HCP1 fix logs | `/tmp/hcp1-fix-out.txt` |
| CENTRAL | `api.cluster-ngjtm…` |
| OSO API | `api.cluster-j7ljz…` |
| Vault WG | `fabric/wireguard/hub` (keys not in Git) |
