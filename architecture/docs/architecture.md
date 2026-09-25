# Hybrid Sovereign Cloud — Architecture Index

**Last reviewed:** 2026-09-25

> **Day-2 usage:** [`../../docs/README.md`](../../docs/README.md)

## Core documents (one each)

| Document | Contents |
|----------|----------|
| **[c4.md](c4.md)** | C4 model — context, hub containers, operators, clouds, secrets, UI, Entity & provision flows |
| **[concepts.md](concepts.md)** | Stakeholder concepts — overview, security, RBAC, components, virtualization |
| **[technical.md](technical.md)** | Technical reference — Vault, AAP, plugins, RBAC, CNV, cleanup, QA |
| **[workshop-tutorials.md](workshop-tutorials.md)** | Day-0 / ZTP workshop + day-2 tutorials |

UI design mocks (unchanged): [`../mocks/`](../mocks/).

## Quick topology

| Role | Runs |
|------|------|
| **Hub** | ArgoCD (`gitops/`), RHACM/MCE, Vault, Keycloak, AAP, operators, dashboards, CNV, `entity-*` |
| **Spokes** | PlatformOpenshift (`openstack` \| `aws` \| `hosted`) |

**Never delete** `sovereign-*` namespaces. No secrets in Git.
