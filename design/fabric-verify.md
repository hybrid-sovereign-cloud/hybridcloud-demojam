# Hybrid Fabric EVPN — Live Verification Report

**Captured:** 2026-10-02T14:51Z · **Full-fabric retest:** 2026-10-02T16:22Z  
**Audience:** Network architects (underlay / overlay / BGP-EVPN control plane)  
**Lab fabric:** `acme-fabric` (ASN **65010**) — spokes HCP1 (OpenShift hosted) + OSO1 (RHOSO)

| Scope | Result |
|-------|--------|
| HCP1 local EVPN (CUDN / VTEP / RA / UDN ping) | **PASS** |
| HCP1 ↔ hub RR underlay (WireGuard) | **PASS** |
| HCP1 ↔ hub RR-A + RR-B BGP | **PASS** (both Established) |
| Hub Type-5 reflection (HCP1 ↔ OSO) | **PASS** |
| OSO ↔ hub underlay (SSH TUN; WG blocked by UDP NAT) | **PASS** |
| OSO ↔ hub BGP + Type-5 origin | **PASS** (GoBGP ASN 65010) |
| VTEP underlay HCP1 `10.255.11.11` ↔ OSO `10.255.12.1` | **PASS** |
| Overlay cross-ping HCP1 UDN ↔ OSO VM `10.110.1.63` | **FAIL** (OVN programs BGP route; OSO Neutron dataplane not bound to manual VTEP) |

---

## 1. Executive summary

Full **EVPN control plane** across both hub route-reflectors and both spokes is up:

- Hub RR-A (`10.255.10.1`) and RR-B (`10.255.10.2`) each have **Established** sessions to HCP1 (`10.255.11.11`) and OSO (`10.255.12.1`), with **PfxRcd=1 / PfxSnt=2** (reflect both Type-5s).
- Hub EVPN RIB holds both prefixes: HCP1 `10.110.0.0/26` and OSO `10.110.1.0/24`, RT `65010:51001`.
- HCP1 FRR learns OSO’s Type-5 via RR; OVN installs `10.110.1.0/24` in the UDN table toward VTEP `10.255.12.1`.
- VTEP ICMP HCP1↔OSO works once routes use `src` = local VTEP (not WG tunnel IP).

**Overlay dataplane cross-ping still fails:** OSO’s Type-5 is originated by lab GoBGP on the compute host, which is **not** wired into RHOSO OVN/Neutron EVPN forwarding for VM `10.110.1.63`. Closing that gap needs OVN-native BGP-EVPN on the OSO gateway (not a parallel speaker on the compute).

---

## 2. Connectivity model (architect view)

```
 CENTRAL control-plane-…-1 (10.10.10.10)
   lo: 10.255.10.1  hub-rr-A
   wg0: 10.254.254.1 ←→ HCP1 WG
   tun0: 10.254.253.1 ←→ OSO SSH TUN (oc port-forward + Point-to-Point)
   routes: 10.255.11.0/24 dev wg0 ; 10.255.12.1 via tun0 ; 10.255.10.2 via 10.10.10.31

 CENTRAL worker-…-2 (10.10.10.31)
   lo: 10.255.10.2  hub-rr-B
   host routes back to OSO/HCP1 via 10.10.10.10

 HCP1 worker (10.232.0.42)
   evpn-vtep0: 10.255.11.11
   wg0 → 10.10.10.10:51820
   AllowedIPs: 10.255.10.0/24, 10.255.12.0/24, 10.254.254.0/24
   FRR ASN 65010 → both RRs Established

 OSO compute01
   evpn-vtep0: 10.255.12.1
   tun0: 10.254.253.2 → CENTRAL :2222 (via oc port-forward)
   GoBGP ASN 65010 → both RRs Established; advertises Type-5 10.110.1.0/24 label 51001
```

### Address / ASN table

| Role | Address / ID | Notes |
|------|----------------|-------|
| Fabric ASN | 65010 | Hub RR + HCP1 OVN FRR + OSO GoBGP (lab) |
| Hub RR-A / RR-B | `10.255.10.1`, `10.255.10.2` | hostNetwork `lo`; RR-B return routes via hub node |
| HCP1 VTEP | `10.255.11.11` | WG underlay to hub |
| OSO VTEP | `10.255.12.1` | SSH TUN underlay (WG UDP/51820 fails through NAT) |
| Overlay HCP1 | `10.110.0.0/26` (UDN probes `.5`/`.6`) | CUDN VNI 51001 |
| Overlay OSO | `10.110.1.0/24` (VM `.63`) | Neutron `evpn_vni=51001` |
| VNI / RT | 51001 / `65010:51001` | HybridNetwork `acme-core` |

---

## 3. Live pass/fail board (2026-10-02T16:22Z)

### 3.1 BGP / EVPN (hub RR-A)

```
Neighbor        AS   State/PfxRcd  PfxSnt  Desc
*10.255.11.11 65010  1             2       FRRouting/10.4.3
*10.255.12.1  65010  1             2       GoBGP/3.29.0

[5]:[0]:[26]:[10.110.0.0]  NH 10.255.11.11  RT:65010:51001
[5]:[0]:[24]:[10.110.1.0]  NH 10.255.12.1   RT:65010:51001
```

RR-B mirrors the same two neighbors / two Type-5s.

### 3.2 Hub FRR config that stays stable

`soft-reconfiguration inbound` + heavy `attribute-unchanged` on the dynamic `SPOKES` group **crashed** hub `bgpd` (FRR 10.2.2) under multi-spoke load. Working ConfigMap shape:

```
router bgp 65010
 bgp router-id <rr-ip>
 bgp cluster-id <rr-ip>
 neighbor SPOKES peer-group
 neighbor SPOKES remote-as 65010
 bgp listen range 0.0.0.0/0 peer-group SPOKES
 address-family l2vpn evpn
  neighbor SPOKES activate
  neighbor SPOKES route-reflector-client
  neighbor SPOKES attribute-unchanged next-hop
```

Templates updated: `eda/*/roles/hybridfabric_provision/templates/frr.conf.j2`.

### 3.3 Underlay notes

| Path | Mechanism | Result |
|------|-----------|--------|
| HCP1 ↔ RR-A/B | WireGuard UDP/51820 | PASS |
| OSO ↔ RR-A/B | SSH TUN `10.254.253.0/30` over `oc port-forward` to `fabric-ssh-tunnel:2222` | PASS (WG handshake never completes through public NAT) |
| HCP1 VTEP ↔ OSO VTEP | WG ↔ hub ↔ TUN, routes with `src` = VTEP | PASS (~8–12 ms) |
| RR-B reachability | Host route `10.255.10.2 via 10.10.10.31` on hub; return routes on worker for `10.255.11/12` | PASS |

### 3.4 Overlay cross-ping

- HCP1 OVN table `1055`: `10.110.1.0/24 … dst 10.255.12.1 … proto bgp` — **programmed**.
- `ping 10.110.1.63` from UDN pod `10.110.0.15` — **100% loss**.
- Root cause: OSO advertisement is **lab GoBGP** on compute01; Neutron EVPN router / OVN gateway is not the BGP speaker/VTEP dataplane for that Type-5. Need OVN-native FRR on the RHOSO gateway peered to the hub (same ASN/RT), not a second speaker.

---

## 4. Lab artifacts (not in Git)

| Item | Location |
|------|----------|
| WG / SSH keys | `/tmp/fabric-wg`, `/tmp/fabric-ssh` |
| Vault | `hybridsovereign/fabric/wireguard/hub` |
| OSO GoBGP | `/tmp/gobgpd.yml` on compute01 |
| CENTRAL kubeconfig | `/tmp/fabric-ssh/central.kubeconfig` |

---

## 5. Remaining work

1. **OSO OVN-native EVPN** — peer gateway FRR to hub RRs; withdraw compute GoBGP; confirm VNI label + RMAC match OVN expectations.
2. **Persist** RR-B host routes, SSH TUN, and HCP1 WG `AllowedIPs` (`10.255.12.0/24`) in TransportLink / hub playbooks (today: live lab).
3. **GitOps** `acme-oso1-link` still `tunnelType: none` — promote SSH-TUN or future WG once NAT path exists.
4. Re-run UDN → `10.110.1.63` cross-ping after (1).
