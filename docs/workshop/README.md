# Workshop — Hybrid Sovereign Cloud

A hands-on path through the whole platform, in the order the objects actually
depend on each other. You start by creating one **Entity** — a tenant — and
every later lab hangs something off it: identity, teams, secrets, clouds, a
cluster, a stretched network, config-as-code.

**Time:** ~3–5 hours end to end. Cluster installs dominate; everything up to
Lab 5 is minutes.
**Cluster:** one OpenShift hub with this repo's GitOps root synced
([getting started](../getting-started/README.md)).
**You need:** `oc` as a cluster admin, and the Admin/Tenant console for Lab 11.

---

## The one diagram to keep open

Every custom resource in this platform sits in one of three layers. Reading
down is "who owns it"; reading across is "what it produces".

```text
          PLATFORM LAYER — a platform admin owns these, one set per hub
          ───────────────────────────────────────────────────────────────
  CloudInfrastructure    a real cloud: an OpenStack site, an AWS account,
                         the hub's own OpenShift. Holds the admin credential.
  HybridFabric           the shared EVPN underlay (one per hub)
  CloudGateway           attaches one CloudInfrastructure to the fabric
  TransportLink          the tunnel between two gateways
  RbacConfig /           where identity, automation and registry live
  AAPConfig / QuayConfig (Keycloak, AAP, Quay endpoints)
                                      │
                                      ▼
          TENANT LAYER — created per customer, lives in entity-<name>
          ───────────────────────────────────────────────────────────────
  Entity ──┬─ Rbac ──── Persona            who exists, and who they are
           ├─ Team ──── Project            how work is grouped
           ├─ Vault ─── VaultKV            tenant secrets
           ├─ AAPOrg / QuayOrg             tenant automation + registry
           ├─ CloudOSO / CloudAWS /        a tenant project *on* a
           │  CloudVirt                    CloudInfrastructure
           └─ HybridNetwork ── NetworkPlacement   a tenant VRF, placed on a
                                                  cloud project
                                      │
                                      ▼
          WORKLOAD LAYER
          ───────────────────────────────────────────────────────────────
  PlatformOpenshift      a spoke OpenShift cluster built on a cloud project
  Assignment             binds a Team + its Projects onto that cluster,
                         with Rbac groups mapped to roles there
```

Two rules that explain most of the design:

1. **Everything flows from Entity.** The Entity CR creates the
   `entity-<name>` namespace and starts that tenant's operator. Nothing tenant
   -scoped can exist before it.
2. **Clusters are not fabric members.** A `PlatformOpenshift` never joins the
   hybrid fabric, whatever its type. Tenant networks are placed on *cloud
   projects*, not clusters. [Lab 0](lab-00-guardrails.md#tenants-cannot-attach-their-own-clusters-to-the-fabric)
   explains why this is a security boundary, not an omission.

Operators launch **AAP job templates** directly. There is no Kafka or EDA path
on the active route.

---

## Agenda

| Lab | You create | CRs introduced |
|-----|-----------|----------------|
| [0](lab-00-guardrails.md) | Nothing — ground rules and why they exist | — |
| [1](lab-01-verify-platform.md) | Nothing — confirm the hub is healthy | — |
| [2](lab-02-entity.md) | **Your tenant** | `Entity` |
| [3](lab-03-identity.md) | Groups and people for that tenant | `RbacConfig`, `Rbac`, `Persona` |
| [4](lab-04-team-project.md) | How the tenant organises work | `Team`, `Project` |
| [5](lab-05-plugins.md) | Tenant secrets, automation, registry | `Vault`, `VaultKV`, `AAPConfig`, `AAPOrg`, `QuayConfig`, `QuayOrg` |
| [6](lab-06-register-cloud.md) | A cloud, then a tenant project on it | `CloudInfrastructure`, `CloudOSO` / `CloudAWS` / `CloudVirt` |
| [7](lab-07-provision-platform.md) | A real spoke OpenShift cluster | `PlatformOpenshift` |
| [8](lab-08-assignment.md) | Team access on that cluster | `Assignment` |
| [9](lab-09-hybrid-fabric.md) | Hub VMs ↔ OpenStack VMs in one tenant VRF | `HybridFabric`, `CloudGateway`, `TransportLink`, `HybridNetwork`, `NetworkPlacement` |
| [10](lab-10-iaac.md) | Config-as-code export of everything above | `Iaac` |
| [11](lab-11-ui.md) | The same thing again, through the console | — |

Labs 2–5 are fast and build on each other — do them in order. Labs 6–9 are
independent tracks once you have an Entity; Lab 10 works at any point after
Lab 2.

### If you are short on time

Labs 0 → 2 → 3 → 4 → 8 using the pre-provisioned `ocp-hub-hosted` cluster
gives you the full tenancy story in about 45 minutes without waiting for a
cluster install.

---

## What ZTP already built for you

The hub syncs a working example before you touch anything, so you always have
something healthy to compare against. Most of it belongs to the `acme-corp`
entity:

| Already there | Where it came from |
|---------------|--------------------|
| `Entity/acme-corp`, `Entity/chad` | `hs-platform-smoke`, `hs-platform-fabric` |
| Core `Rbac` groups, `AAPOrg`, `QuayOrg`, `CloudVirt/local-virt` | `hs-platform-smoke` |
| `RbacConfig`, `AAPConfig`, `QuayConfig` | `hs-platform-configs` |
| `HybridFabric`, `CloudInfrastructure`, `CloudGateway`, tenant VRFs | `hs-platform-fabric` |
| `Team`, `Project`, `Persona`, `Vault`, `VaultKV`, `PlatformOpenshift/ocp-hub-hosted`, `Assignment` | `hs-samples` |
| `Iaac` + the Gitea tenancy repo | `hs-iaac` |

**Build your own entity rather than editing `acme-corp`.** The samples are
seed-once (ArgoCD will not restore them if you delete them, and will not fight
your edits), but a clean entity makes the dependency order obvious.

Three kinds are deliberately **not** provisioned: `CloudAWS`, `CloudOSO` and
`OpenStackMigration`. Each needs credentials for, or a running instance of, a
cloud outside the hub, so none of them can go healthy on a hub-only run. The
central cluster is always provisioned first and never blocks on them — see
[ZTP sample policy](../getting-started/ztp.md#sample-policy).

---

## Rules

1. **No secrets in Git.** Credentials go in a Secret or Vault; CRs reference
   them by name.
2. **Never delete `sovereign-*` namespaces.**
3. Platform objects (`CloudInfrastructure`, `HybridFabric`, `CloudGateway`)
   belong in Git. Lab tenant CRs may be `oc apply`-ed — that is the point of
   the workshop.
4. **Delete in reverse dependency order:** Assignment → PlatformOpenshift →
   NetworkPlacement → HybridNetwork → Cloud\* → CloudInfrastructure → Entity.

## After the workshop

- Per-kind field reference: [reference/crds](../reference/crds/README.md)
- Adding a real cloud for keeps: [how-to](../how-to/README.md)
- Fabric design and the live verification record:
  [fabric-design.md](../concepts/fabric-design.md) ·
  [fabric-verify.md](../concepts/fabric-verify.md)
- How the whole thing is wired: [concepts](../concepts/README.md)
