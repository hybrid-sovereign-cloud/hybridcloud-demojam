# Hybrid Fabric EVPN — Live Verification

**Captured:** 2026-10-06T17:45Z  
**CENTRAL:** `api.cluster-ngjtm.dyn.redhatworkshops.io`  
**Fabrics:** `acme-fabric` (ASN **65010**) · `chad-fabric` (ASN **65020**)

| Scope | Acme | Chad |
|-------|------|------|
| HybridFabric / HybridNetwork / Placement Ready | **PASS** | **PASS** |
| Spoke EVPN apply (CUDN / Neutron) | **PASS** HCP1 + OSO1 | **PASS** HCP2 + HCP3 |
| Underlay to hub | **PASS** WG + SSH TUN | **N/A** (`tunnelType: none`) |
| Hub RR BGP sessions | **PASS** HCP1 + OSO Established | **none** on hub RRs (ASN 65010 peers only) |
| Type-5 reflection cross-spoke | **PASS** HCP1 ↔ OSO | **not observed** on hub RR |
| Overlay cross-spoke ping | **FAIL** (no OVN dataplane) | **not retested** |

---

## Platform overview

```mermaid
flowchart TB
  subgraph CENTRAL["CENTRAL"]
    RRs["Hub RR pods<br/>10.255.10.1 · 10.255.10.2"]
    AF["HybridFabric acme-fabric<br/>ASN 65010"]
    CF["HybridFabric chad-fabric<br/>ASN 65020"]
  end

  subgraph ACME["entity-acme-corp"]
    HN1["HybridNetwork acme-core<br/>VNI 51001 · RT 65010:51001"]
    HCP1["HCP1 · VTEP 10.255.11.11<br/>10.110.0.0/24"]
    OSO1["OSO1 · VTEP 10.255.12.1<br/>10.110.1.0/24 · VM .63"]
  end

  subgraph CHAD["entity-chad"]
    HN2["HybridNetwork chad-app<br/>VNI 52000 · RT 65020:52000"]
    HCP2["HCP2 · 10.120.0.0/24"]
    HCP3["HCP3 · 10.120.1.0/24"]
  end

  AF --> HN1
  CF --> HN2
  AF -.-> RRs
  CF -.->|spec.routeReflectors<br/>same addrs in lab| RRs
  HN1 --> HCP1
  HN1 --> OSO1
  HN2 --> HCP2
  HN2 --> HCP3
  HCP1 <-->|EVPN Type-5 via hub| OSO1
  HCP2 <-.->|same HybridNetwork<br/>no hub BGP seen| HCP3
```

---

## Acme (`acme-fabric`)

### Connectivity

```mermaid
flowchart LR
  subgraph CENTRAL["CENTRAL · ASN 65010"]
    RRA["RR-A 10.255.10.1"]
    RRB["RR-B 10.255.10.2"]
    WGH["WG :51820"]
    SSH["SSH TUN<br/>10.254.253.0/30"]
  end

  subgraph HCP1["HCP1"]
    HV["VTEP 10.255.11.11 FRR"]
    HP["10.110.0.0/26"]
  end

  subgraph OSO1["OSO1"]
    OV["VTEP 10.255.12.1 GoBGP"]
    OP["10.110.1.0/24"]
    VM["VM 10.110.1.63"]
  end

  WGH -.->|wireguard| HV
  SSH -.->|sshtunnel| OV
  HV -->|:179| RRA & RRB
  OV -->|:179| RRA & RRB
  RRA <-.->|reflect RT 65010:51001| RRB
  HP --- HV
  OP --- OV
  VM --- OP
  HP -.->|overlay FAIL| OP
```

### CR graph

```mermaid
flowchart TB
  HF["HybridFabric acme-fabric"]
  HN["HybridNetwork acme-core<br/>VNI 51001"]
  GW1["CloudGateway acme-hcp1-gw<br/>ASN 65011 · wireguard"]
  GW2["CloudGateway acme-oso1-gw<br/>ASN 65012 · sshtunnel"]
  TL1["TransportLink acme-hcp1-link<br/>wireguard"]
  TL2["TransportLink acme-oso1-link<br/>sshtunnel"]
  NP1["NetworkPlacement acme-core-hcp1<br/>→ hcp1 · 10.110.0.0/24"]
  NP2["NetworkPlacement acme-core-oso1<br/>→ oso1 · 10.110.1.0/24"]

  HF --> GW1 & GW2 & TL1 & TL2
  GW1 --> TL1
  GW2 --> TL2
  HN --> NP1 & NP2
  TL1 -.-> NP1
  TL2 -.-> NP2
```

### Live control plane

| Peer | Role | Hub PfxRcd |
|------|------|------------|
| `10.255.11.11` | HCP1 FRR | 1 |
| `10.255.12.1` | OSO GoBGP | 1 |

Type-5: `10.110.0.0/26` NH `10.255.11.11` · `10.110.1.0/24` NH `10.255.12.1` · RT `65010:51001`

| Object | Ready | Notes |
|--------|-------|-------|
| `hybridfabric/acme-fabric` | true | RR `10.255.10.1`, `10.255.10.2` |
| `hybridnetwork/acme-core` | true | VNI 51001 |
| `hybridnetwork/payments-vpc` | true | VNI 51000 (not in this EVPN path) |
| `cloudgateway/acme-hcp1-gw` | true | spoke ASN 65011 |
| `cloudgateway/acme-oso1-gw` | true | spoke ASN 65012 |
| `transportlink/acme-hcp1-link` | true | `wireguard` · Vault `fabric/wireguard/hub` |
| `transportlink/acme-oso1-link` | true | `sshtunnel` · Vault `fabric/sshtunnel/oso1` |
| `networkplacement/acme-core-hcp1` | true | validated · PlatformOpenshift/hcp1 |
| `networkplacement/acme-core-oso1` | true | validated · CloudOSO/oso1 |

**Underlay:** HCP1 WG route loop (`wg-start.sh` 15s) · OSO `fabric-ssh-tun` + `fabric-gobgp` systemd on `172.22.0.100`

---

## Chad (`chad-fabric`)

### Connectivity

```mermaid
flowchart LR
  subgraph CENTRAL["CENTRAL · chad-fabric ASN 65020"]
    RR["spec.routeReflectors<br/>10.255.10.1 · 10.255.10.2<br/>shared addrs with Acme lab"]
  end

  subgraph HCP2["HCP2"]
    P2["CUDN EVPN<br/>10.120.0.0/24"]
  end

  subgraph HCP3["HCP3"]
    P3["CUDN EVPN<br/>10.120.1.0/24"]
  end

  HCP2 -. tunnelType none .-> RR
  HCP3 -. tunnelType none .-> RR
  P2 -.->|same VNI/RT<br/>hub BGP not seen| P3
```

### CR graph

```mermaid
flowchart TB
  HF["HybridFabric chad-fabric<br/>ASN 65020 · VNI pool 52000–52127"]
  HN["HybridNetwork chad-app<br/>VNI 52000 · RT 65020:52000"]
  GW2["CloudGateway chad-hcp2-gw<br/>ASN 65021 · none"]
  GW3["CloudGateway chad-hcp3-gw<br/>ASN 65022 · none"]
  TL2["TransportLink chad-hcp2-link<br/>none"]
  TL3["TransportLink chad-hcp3-link<br/>none"]
  NP2["NetworkPlacement chad-app-hcp2<br/>→ hcp2 · 10.120.0.0/24"]
  NP3["NetworkPlacement chad-app-hcp3<br/>→ hcp3 · 10.120.1.0/24"]

  HF --> GW2 & GW3 & TL2 & TL3
  GW2 --> TL2
  GW3 --> TL3
  HN --> NP2 & NP3
  TL2 -.-> NP2
  TL3 -.-> NP3
```

| Object | Ready | Notes |
|--------|-------|-------|
| `hybridfabric/chad-fabric` | true | ASN 65020 · RR addrs `10.255.10.1/2` (lab share) |
| `hybridnetwork/chad-app` | true | VNI 52000 · RT `65020:52000` |
| `cloudgateway/chad-hcp2-gw` | true | spoke ASN 65021 · `transport: none` |
| `cloudgateway/chad-hcp3-gw` | true | spoke ASN 65022 · `transport: none` |
| `transportlink/chad-hcp2-link` | true | `tunnelType: none` |
| `transportlink/chad-hcp3-link` | true | `tunnelType: none` |
| `networkplacement/chad-app-hcp2` | true | validated · PlatformOpenshift/hcp2 · `10.120.0.0/24` |
| `networkplacement/chad-app-hcp3` | true | validated · PlatformOpenshift/hcp3 · `10.120.1.0/24` |

**Underlay:** none (GitOps adjacent). Hub RR pods currently only show **Acme** ASN 65010 neighbors — no Chad VTEP sessions on those RRs at capture time.

---

## Artifacts

| Item | Note |
|------|------|
| Vault WG (Acme HCP1) | `hybridsovereign/fabric/wireguard/hub` |
| Vault SSH TUN (Acme OSO) | `hybridsovereign/fabric/sshtunnel/oso1` |
| OSO API | `api.cluster-j7ljz…` |
| Entities | `entity-acme-corp` · `entity-chad` |
