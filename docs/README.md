# Hybrid Sovereign Cloud — Documentation

Everything is in this folder. Pick the row that matches what you are trying
to do.

| I want to… | Go to |
|------------|-------|
| **Stand up a hub** | [getting-started](getting-started/README.md) |
| **Understand the model** | [concepts](concepts/README.md) — start with [flow.md](concepts/flow.md) |
| **Learn it by doing** | [workshop](workshop/README.md) — create an Entity, then everything else |
| **Look up a CR field** | [reference/crds](reference/crds/README.md) |
| **Use the dashboards** | [reference/ui.md](reference/ui.md) |
| **Onboard a real cloud** | [how-to](how-to/README.md) |
| **Debug a rollout** | [getting-started/ztp.md](getting-started/ztp.md) · [operations/tracking.md](operations/tracking.md) |
| **Read the formal specs** | [specs/](../specs/README.md) |

---

## One picture

```text
            You: Git commit, console form, or oc apply
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │  The hub — one OpenShift cluster            │
        │                                             │
        │   ArgoCD ──► hybridsovereign CRs            │
        │                      │                      │
        │                      ▼                      │
        │            Ansible operators                │
        │          (one per kind, watching)           │
        │                      │                      │
        │                      ▼                      │
        │            AAP job templates                │
        └──────────────────────┬──────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     RHOSO / OpenStack      AWS            Hub virtualization
     site                   account        (CNV) + hosted clusters
            └──────────────────┼──────────────────┘
                               ▼
                   EVPN hybrid fabric joins the
                   tenant's networks across all of them
```

Operators call AAP job templates **directly**. There is no Kafka, AMQ Streams
or EDA activation on the active path.

---

## The shape of the API

Every custom resource is in `hybridsovereign.redhat/v1alpha1` and sits in one
of three layers:

**Platform** — one set per hub, in `sovereign-cloud` / `sovereign-cloud-plugins`,
owned by a platform admin. Holds all the credentials.
`CloudInfrastructure`, `HybridFabric`, `CloudGateway`, `TransportLink`,
`RbacConfig`, `AAPConfig`, `QuayConfig`.

**Tenant** — per customer, in `entity-<name>`, created by that tenant.
Never holds a credential, only references.
`Entity`, `Rbac`, `Persona`, `Team`, `Project`, `Vault`, `VaultKV`,
`AAPOrg`, `QuayOrg`, `CloudOSO`, `CloudAWS`, `CloudVirt`,
`HybridNetwork`, `NetworkPlacement`.

**Workload** — the things that cost money.
`PlatformOpenshift`, `Assignment`.

Plus `Iaac`, which exports all of the above back to Git, and
`UIHealthChecker`, which smoke-tests the dashboards.

Dependency order, which is also the [workshop](workshop/README.md) order:

```text
Entity → Rbac → Persona → Team → Project → plugins (Vault/AAPOrg/QuayOrg)
      → Cloud* (on a CloudInfrastructure) → PlatformOpenshift → Assignment

HybridFabric → CloudGateway → TransportLink → HybridNetwork → NetworkPlacement
```

---

## Folder map

```text
docs/
├── getting-started/   installing a hub: ZTP, GitOps, lab config, disconnected
├── concepts/          the model, architecture, and the hybrid fabric design
├── workshop/          labs 0-11, Entity first
├── reference/         per-CRD field reference + UI guide
├── how-to/            onboarding a specific cloud
├── operations/        change tracking and known issues
└── design/            UI mockups
```

---

## Rules that never change

1. **No secrets in Git** — Vault plus ExternalSecret / PushSecret only.
2. **Never delete `sovereign-*` namespaces.**
3. **GitOps after bootstrap** — change Git and let ArgoCD sync. `oc` is for
   investigation, and for tenant CRs while you are learning.
4. **No lab domains in Git** — the apps domain is discovered at runtime.
5. **One hub** — the whole platform control plane lives there.
