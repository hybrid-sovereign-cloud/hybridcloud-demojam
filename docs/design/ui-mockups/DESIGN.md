# Hybrid VPC Wiring — EVPN Multi-Cloud Design

**Audience:** Ansible developers building the automation for this platform. It assumes you're
comfortable with roles, variables, idempotency, and Event-Driven Ansible (EDA), but **not** with
networking. The networking concepts are explained from scratch, with software analogies, before
any architecture is described. Read Part 1 once; it makes everything else make sense.

---

## Table of contents

1. [What we're building](#1-what-were-building)
2. [Networking primer (read this first)](#2-networking-primer-read-this-first)
3. [The architecture](#3-the-architecture)
4. [How automation drives it](#4-how-automation-drives-it)
5. [The role contract (the shared interface)](#5-the-role-contract-the-shared-interface)
6. [The roles](#6-the-roles)
7. [The two concepts that will trip you up](#7-the-two-concepts-that-will-trip-you-up)
8. [The transport / encryption piece](#8-the-transport--encryption-piece)
9. [Open questions to validate](#9-open-questions-to-validate)
10. [Glossary](#10-glossary)

---

## 1. What we're building

The platform gives users a **hybrid VPC**: a private network that can span on-premises and multiple
clouds, carved into many isolated **tenant networks**. A user assigns one of their networks to a
cloud backend, and our automation wires it up so that network exists — and is reachable — in that
location, while staying isolated from every other tenant.

Backends we target today:

- **AWS** (public cloud)
- **OpenStack** (Red Hat, on-prem/private) running `ovn-bgp-agent`
- **OpenShift on bare metal** (on-prem/private) using OVN's EVPN capability

Two hard requirements shape everything:

- **Overlapping IP addresses must work.** Tenant A and Tenant B can *both* use `10.0.0.0/8` and must
  never see each other. (Think two containers both binding `127.0.0.1` — fine, because they're
  isolated.)
- **FOSS reference implementation**, flexible per deployment. The platform emits desired-state
  **events** and runs **arbitrary Ansible via EDA** to realize them, so the automation is where all
  the per-backend logic lives.

Scale target: **100 Gbit** per cloud, up to **512 isolated networks**. Lab today: **1 Gbit**, up to
**128 networks**.

---

## 2. Networking primer (read this first)

You need exactly seven concepts. Each has a software analogy.

### 2.1 VRF — an isolated routing namespace
A **VRF** (Virtual Routing and Forwarding instance) is a private, isolated routing table on a
network device. Two VRFs on the same box can both contain `10.0.0.0/8` and never interfere.

> **Analogy:** a Linux network namespace, or a separate DB schema per tenant. Same addresses,
> different namespaces, total isolation. **One tenant network = one VRF.** This is *how* overlapping
> IP is made safe.

### 2.2 VNI — a numeric tag identifying the tenant
A **VNI** (VXLAN Network Identifier) is a 24-bit number that labels which tenant a packet belongs to.

> **Analogy:** a `tenant_id` column. Every packet for Tenant A is stamped with VNI `50001`. **One
> tenant network = one VNI = one VRF.** The VNI is the global key our numbering authority hands out.

### 2.3 VXLAN — wrapping one packet inside another
**VXLAN** is **encapsulation**: it puts a tenant's packet inside an outer UDP packet stamped with the
VNI, so it can travel across shared infrastructure and be un-wrapped at the far end into the correct
tenant.

> **Analogy:** putting a letter (the tenant packet) inside an envelope (the outer packet) labelled
> with a tenant ID (the VNI). The shared postal network only sees the envelope.

### 2.4 VTEP — the thing that wraps and unwraps
A **VTEP** (VXLAN Tunnel EndPoint) is any device that does the wrapping (encapsulation) and
unwrapping (decapsulation). Switches, and Linux boxes running FRR, can be VTEPs.

> **Analogy:** the mail room that stuffs and opens envelopes. Traffic flows **directly** between the
> two VTEPs that need to talk — they build a "tunnel" between themselves.

### 2.5 BGP — how devices advertise reachability
**BGP** (Border Gateway Protocol) is the protocol devices use to tell each other "I can reach these
addresses." It's the routing control plane.

> **Analogy:** a service-discovery / gossip protocol for network addresses. A "peering" is a session
> between two devices that exchange these advertisements.
>
> One distinction matters: **iBGP** = peering *inside* one administrative domain (one Autonomous
> System / "AS" number). **eBGP** = peering *across* a boundary (different AS numbers). eBGP boundaries
> get stricter, safer default behavior — we deliberately use them between sites/clouds for isolation.

### 2.6 EVPN — the address book that rides on BGP
**EVPN** (Ethernet VPN) is a set of BGP message types that distribute *which tenant's addresses live
at which VTEP*. It's the control plane that makes multi-tenant VXLAN work. The message type we care
about is **Type-5** (it advertises an IP prefix belonging to a VRF/VNI).

> **Analogy:** a distributed, per-tenant address book published over the BGP gossip network. "Subnet
> `10.0.0.0/24` for tenant VNI `50001` lives at VTEP X." Other VTEPs read it and know where to send
> that tenant's traffic.

### 2.7 Route Reflector (RR) — a pub/sub hub for BGP
iBGP has an awkward rule: a device won't re-share what it learned from one iBGP peer to another. The
naive fix is to peer *everyone with everyone* (an N² mesh). A **Route Reflector** is a designated hub
that re-distributes advertisements, so each device only peers with the hub.

> **Analogy:** a message broker / pub-sub hub instead of every service opening a socket to every other
> service. **Important:** the RR only moves *advertisements* (control plane). Actual tenant traffic
> still flows **directly** VTEP-to-VTEP, never through the RR.

### 2.8 RT and RD — the two tags on every EVPN advertisement
This pair causes the most confusion, so slow down here.

- **RT (Route-Target):** a label controlling **import/export**. A VRF *exports* its routes tagged
  with an RT, and *imports* routes carrying RTs it subscribes to.
  > **Analogy:** a **pub/sub topic name.** You publish to a topic and subscribe to topics. **The
  > publisher and subscriber must use the *exact same* topic string**, or the message is ignored. The
  > whole "RT reconciliation" problem in §7 is just *two systems disagreeing on the topic name.*

- **RD (Route-Distinguisher):** a uniqueness prefix that keeps overlapping addresses distinct *inside
  BGP's database*.
  > **Analogy:** a namespace prefix on a key so `tenantA/10.0.0.0` and `tenantB/10.0.0.0` don't
  > collide in the same store. **RDs are allowed to differ everywhere; only RTs have to match.** Don't
  > let RD mismatches worry you.

That's the whole vocabulary. Everything below is built from these eight ideas.

---

## 3. The architecture

### 3.1 The big picture

```
        ┌──────────────────────────────────────────────────────────┐
        │  HYBRID VPC PLATFORM                                      │
        │  user desired-state ─► EDA ─► Ansible roles (this repo)   │
        │  Numbering Authority:  VNI · VRF · RT · per-domain ASN    │
        └───────────────────────────┬──────────────────────────────┘
                                     │ configures everything below
 ════════════════════════════════════════════════════════════════════
  ON-PREM   AS 65000  (one administrative domain; Nexus switches = the hub/RR)
  ┌──────────────────────────────────────────────────────────────────┐
  │            Nexus-A ═══ vPC ═══ Nexus-B   (VTEP + RR pair)         │
  │             ▲    ▲               ▲                                │
  │   eBGP EVPN │    │ eBGP EVPN     │ iBGP EVPN (hub/spoke)          │
  │   (local)   │    │ (local)       │                               │
  │        ┌────┘    └────┐      ┌───┘                                │
  │   OpenStack      OpenShift   Border-BGW (FRR)                     │
  │   ovn-bgp-agent  OVN-K EVPN  the on-prem "gateway" to the cloud   │
  │   node = VTEP    node = VTEP        │                             │
  └─────────────────────────────────────┼────────────────────────────┘
                                         │  encrypted tunnel + VXLAN
                          lab: WireGuard │  prod: MACsec / DirectConnect
  ═══════════════════════════════════════▼════════════════════════════
  AWS       AS 65001  (separate administrative domain)
  ┌──────────────────────────────────────────────────────────────────┐
  │       Cloud-BGW / Cloud-RR (FRR)   (cloud-side gateway + hub)     │
  │         ▲          ▲          ▲     iBGP EVPN (hub/spoke)         │
  │      NVA-1      NVA-2  ...  NVA-N    (one small router per tenant)│
  │     VRF tA     VRF tB      VRF tN                                  │
  │      │          │           │                                     │
  │    VPC-A      VPC-B       VPC-N     native AWS VPCs (overlap OK)   │
  └──────────────────────────────────────────────────────────────────┘
  Legend:  RR = control-plane hub only   BGW = gateway, sits in the traffic path
```

### 3.2 The one idea that makes it all uniform

**Two of our three backends already speak EVPN natively.** OpenStack's `ovn-bgp-agent` and
OpenShift's OVN both run **FRR** (a FOSS router) under the hood and already advertise tenant networks
as EVPN Type-5 routes. So they plug straight into the on-prem fabric as EVPN peers.

**AWS is the only outlier** — it has no concept of VRFs or EVPN. So for AWS we run our own small FRR
router (a "**micro-NVA**", one per tenant VPC) that speaks EVPN on the on-prem side and plain AWS
networking on the VPC side. It's the translator.

> **The mental model:** every backend attaches to the on-prem fabric as an **EVPN peer**. The only
> differences are *where* it peers and *what software* originates the routes. That sameness is what
> lets one set of Ansible roles cover all three.

### 3.3 What "a tenant network" looks like end-to-end

```
  VNI 50001  /  VRF tenantA  /  canonical RT 65000:50001
  ┌──── one logical isolated network, overlapping-IP-safe ────┐
   on-prem  ──Type-5──►  reflected/peered to:
        ├─ OpenStack tenantA   (VRF → VNI 50001)
        ├─ OpenShift  tenantA   (VRF → VNI 50001)
        └─ AWS VPC-A            (micro-NVA VRF → VNI 50001)
   Each location advertises only its own subnets. No layer-2 stretching.
```

A tenant can live in one backend or several at once. The VNI/VRF/RT identity is the same everywhere;
that's how the pieces recognize they belong to the same tenant.

---

## 4. How automation drives it

The platform emits a **desired-state event** — e.g. *"network N belongs to tenant T; place it in
backend X; state = present"* — and EDA runs our roles to make reality match.

```
  desired-state event  (place network N in backend X, state=present)
        │
        ▼
   allocate ──► resolves (vni, vrf, canonical_rt, backend_rt, rt_strategy)
        │
        ├─► [guard] transport / cloud_landing_zone   (only first time we use cloud X)
        ├─► fabric_vni            (ALWAYS — make sure the on-prem VRF/VNI exists)
        └─► backend_X             (ONLY the backend being targeted)
        │
        ▼
   validate ──► confirm it actually works, report realized state back to platform
```

Two lifecycle classes of roles:

- **Day-0 roles** build the fixed infrastructure (the fabric, the gateways, the tunnels). They run
  rarely, are idempotent, and are *prerequisites*. Per-network events trigger them only the first
  time a given cloud/site is used (a "guard").
- **Day-2 roles** run on **every** desired-state event. They are idempotent keyed on `network_id` and
  implement both `present` and `absent` (so de-assigning a network cleanly withdraws it).

Everything is idempotent. Re-running an event is a no-op. That's the core contract.

---

## 5. The role contract (the shared interface)

Every backend role consumes the **same variable set**, produced by the `allocate` role from the
numbering authority. This shared contract is what makes the backends interchangeable.

```yaml
# Identity ---------------------------------------------------------------
tenant_id:        "t-1234"
network_id:       "net-abcd"          # idempotency key for day-2 roles
target_backend:   "aws"               # aws | openstack | openshift
state:            "present"           # present | absent

# Network numbering (from the Numbering Authority) -----------------------
vni:              50001               # the global tenant tag
vrf_name:         "tenantA"
prefixes:                             # subnets THIS location originates
  - "10.0.0.0/24"
rd_scheme:        "auto"              # RDs may differ everywhere; don't worry about them

# Route-Target reconciliation (see §7.2 — this is the subtle part) --------
canonical_rt:     "65000:50001"       # the platform's standard label for this tenant
backend_rt:       "65000:50001"       # the label THIS backend actually uses on the wire
rt_strategy:      "native"            # native | adopt | rewrite

# Domain info ------------------------------------------------------------
domain_asn:       65001               # the AS number of the backend's domain
```

If you're writing a new backend role, **you implement against these variables and nothing else.**
The platform-facing behavior stays identical; only the leaf-level "how" differs per backend.

---

## 6. The roles

### 6.1 Day-0 roles (infrastructure; run-once; idempotent)

| Role | Acts on | What it must do (high level) |
|---|---|---|
| `fabric_base` | Cisco Nexus pair | Bring up the underlay and the VTEP function; configure the switches as the EVPN **hub (Route Reflector)**. Networking-specific knobs it must set are documented inline in the role; treat them as required constants. |
| `border_bgw` | FRR border router | Stand up the on-prem **gateway to the clouds**: peer the Nexus hub on the inside, peer each cloud on the outside, and translate between the two domains. |
| `cloud_landing_zone` | each cloud (e.g. AWS) | Create the per-cloud landing area: a transit network, the cloud-side gateway/hub instance (FRR), and base routing. |
| `transport` | border ↔ cloud | Build the **encrypted tunnel** between on-prem and the cloud and make the gateways reachable across it. Tunnel type is pluggable (see §8). |

### 6.2 Day-2 roles (per-network; run on every event; idempotent on `network_id`; present/absent)

| Role | What it must do (high level) |
|---|---|
| `allocate` | Ask the **Numbering Authority** for this network's `vni`, `vrf`, and route-targets (or look up the existing allocation). Emits the full variable contract from §5. This is pure data resolution — no device config. |
| `fabric_vni` | On the Nexus pair, **ensure the tenant's VRF + VNI exist** and that route-targets are configured, *applying the RT reconciliation* for the targeted backend (§7.2). Runs on every event because the on-prem VRF must exist regardless of which backend the network lands in. Idempotent: if the VRF already exists (tenant already spans another backend), it's a no-op. |
| `backend_aws` | Provision the tenant's **VPC + micro-NVA** (Terraform/cloud modules), then configure the micro-NVA's FRR: create the VRF/VNI, originate the VPC's subnets as EVPN routes, set the route-target, and peer the cloud-side hub. |
| `backend_openstack` | Map the tenant's Neutron network to a VRF/VNI via `ovn-bgp-agent`, reconcile the route-target, and ensure the node peers the on-prem fabric. |
| `backend_openshift` | Apply the OVN user-defined-network + EVPN custom resources mapping the tenant network to a VRF/VNI, and reconcile the route-target. |
| `validate` | Prove it works: confirm the tenant's routes appear on **both** ends, that route-targets actually resolve (imports match exports), and that there's real reachability. **This role gates success** — the platform only marks the desired state realized after `validate` passes. Report the realized route-targets back. |

### 6.3 Decommission (`state: absent`)

Every day-2 role implements the reverse. De-assigning a network withdraws its routes and removes its
VRF/VNI **for that backend only**, without touching other tenants or other backends the same tenant
still uses. `validate` then confirms the routes are gone.

---

## 7. The two concepts that will trip you up

### 7.1 The on-prem switches are simultaneously a "leaf" and the "hub"

In a big network there are separate tiers (spine/leaf). Our lab has just **one pair of Nexus
switches**, so that pair plays *both* roles at once: it's where tenants attach (leaf) **and** it's the
Route Reflector hub. Functionally, with only a handful of peers, the hub isn't strictly necessary —
but `fabric_base` configures it as a hub anyway so the design lifts cleanly onto a bigger fabric later
with zero changes to the other roles. You don't need to reason about this; just know the Nexus config
looks like it's doing two jobs because it is.

### 7.2 RT reconciliation — "two systems disagreeing on the pub/sub topic name"

Recall from §2.8: an RT is a **topic name**, and the publisher and subscriber must use the *exact same
string* or the advertisement is ignored.

Our platform has a **canonical** topic name per tenant: `canonical_rt = 65000:<vni>`. The problem:
some backends **auto-generate their own topic name from their own AS number** and won't let us
override it. So a backend might publish on `65010:50001` while the fabric is subscribed to
`65000:50001` — and nothing connects. (It gets worse: some backends use large AS numbers that can't
even encode the VNI in the normal way, so you can't predict their topic name — you must *observe* it.)

`rt_strategy` tells the backend role how to bridge the gap:

- **`native`** — we control the RT directly (e.g. our AWS micro-NVA). Just set it to `canonical_rt`.
  `backend_rt == canonical_rt`. Nothing to reconcile.
- **`adopt`** — the fabric side **also subscribes/publishes the backend's RT** in addition to the
  canonical one (a VRF can carry multiple RTs). Simplest fix: the `fabric_vni` role adds
  `backend_rt` to the VRF's import/export list. No translation needed.
- **`rewrite`** — the gateway **translates** the topic name as advertisements cross the boundary
  (`backend_rt` ↔ `canonical_rt`). Keeps each domain internally "pure" at the cost of a translation
  rule per VNI.

**What this means for you as an automation author:** the Numbering Authority must track, *per
backend*, both `canonical_rt` and `backend_rt` and the `rt_strategy`. Do **not** assume one global RT
works everywhere. Your `allocate` role resolves these three values; `fabric_vni` and the backend roles
act on them. Treat "reconcile the route-target at the edge" as a first-class, required step, not an
afterthought — it's the single most common reason a freshly-wired tenant has no connectivity.

---

## 8. The transport / encryption piece

The `transport` role builds the encrypted tunnel between the on-prem border gateway and a cloud
gateway. It carries the cross-site EVPN traffic. Key facts for whoever automates it:

- **Default to WireGuard** for the lab and for per-tenant AWS micro-NVAs: it's in-kernel, fast enough,
  and trivial to template idempotently (a peer is just `{public key, endpoint, allowed-ips}` — no
  IKE/SA/PKI state machine to manage).
- **Make the tunnel type a variable**, not a hardcoded assumption. Some deployments will need
  **IPsec** instead (required if terminating on a cloud-native VPN gateway, or under FIPS/compliance
  rules, or to use NIC hardware crypto offload), and some will use **MACsec on a dedicated link** (or
  no software encryption at all on trusted local links — the OpenStack/OpenShift backends are local
  and usually need no tunnel). The role should expose the same outputs (a routed encrypted link +
  gateway reachability + failure detection) regardless of mechanism.
- **100 Gbit is not a single-tunnel problem.** No single software tunnel (WireGuard *or* IPsec) hits
  100G — encryption collapses all traffic onto one CPU core. The design reaches 100G by either
  **MACsec on a dedicated interconnect** (line-rate hardware crypto) or by **sharding across the
  per-tenant micro-NVAs** (each does a few Gbit; hundreds aggregate past 100G). The automation
  consequence: scale-out is achieved by *more tenants/tunnels*, not a bigger single tunnel — which the
  per-network model already produces naturally.
- **MTU gotcha worth a comment in the role:** wrapping adds overhead (VXLAN ~50 bytes + WireGuard
  ~60 bytes). Either enable jumbo frames on links you control, or clamp the inner MTU/MSS. Get it
  wrong and small pings succeed while large transfers hang — a confusing failure mode.

---

## 9. Open questions to validate

These are unresolved and affect the automation; flag them before building the corresponding role:

- **`ovn-bgp-agent` version/mode** — does it allow setting an explicit route-target, or does it force
  its own (driving `rt_strategy` to `adopt`/`rewrite`)? Confirm the EVPN driver is GA in the target
  OpenStack release.
- **OpenShift OVN EVPN maturity** — confirm the EVPN/route-advertisement feature is supported (not
  tech-preview) in the target OpenShift version.
- **AWS micro-NVA density** — at 512 tenants, validate the per-VPC micro-NVA cost/scale, or whether a
  consolidation model (shared gateway with per-tenant route tables) is needed; note the relevant cloud
  quota limits.
- **Nexus next-hop handling for the local OVN peers** — there's a switch-side knob the `fabric_base`
  role must set so direct tenant traffic paths form correctly; confirm the exact setting for the
  switch OS version.

---

## 10. Glossary

| Term | One-line meaning | Software analogy |
|---|---|---|
| **VRF** | Isolated routing table on a device | Network namespace / per-tenant schema |
| **VNI** | 24-bit tenant tag | `tenant_id` |
| **VXLAN** | Wrapping a packet inside another | Envelope / tunneling |
| **VTEP** | Device that wraps/unwraps VXLAN | Mail room |
| **BGP** | Protocol to advertise reachable addresses | Service-discovery gossip |
| **iBGP / eBGP** | Peering inside / across an admin domain | Intra-org vs cross-org API call |
| **EVPN** | BGP messages distributing tenant addresses | Distributed address book |
| **Type-5** | EVPN message advertising an IP prefix in a VRF | "Subnet X lives at VTEP Y" record |
| **Route Reflector (RR)** | Hub that re-distributes BGP advertisements | Pub/sub broker (control plane only) |
| **RT (Route-Target)** | Import/export label on advertisements | Pub/sub **topic name** (must match!) |
| **RD (Route-Distinguisher)** | Uniqueness prefix in BGP's database | Namespace prefix on a key (may differ) |
| **AS / ASN** | An administrative routing domain's ID number | A service/org identity |
| **VTEP loopback** | The address a VTEP is reached at | A service's stable endpoint |
| **BGW (Border Gateway)** | Gateway that bridges two domains, sits in traffic path | API gateway between two systems |
| **NVA** | A software router instance we run in a cloud | A self-hosted router VM |
| **FRR** | The FOSS router software used throughout | nginx-of-routing (the common engine) |

---

*This document summarizes design decisions reached collaboratively. The networking rationale behind
each choice (why EVPN, why per-tenant micro-NVAs on AWS, why eBGP at boundaries, why route reflectors)
is available on request if you want the deeper "why" behind any section.*
