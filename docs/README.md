# Hybrid Sovereign Cloud — Documentation

Simple flow for the platform. Read this first.

## One-picture flow

```text
You (Git / UI / oc)
        │
        ▼
┌───────────────────────────────┐
│  Hub (one OpenShift)          │  ArgoCD + operators + AAP
└───────────────┬───────────────┘
          │ watches CRs
          ▼
┌───────────────────┐     launches      ┌─────────────┐
│ Ansible Operators │ ───────────────► │ AAP Jobs    │
│ Entity / Cloud* / │                  │ (Ansible)   │
│ Platform* / …     │                  └──────┬──────┘
└───────────────────┘                         │
                                              ▼
                                    Spoke clusters / AWS / RHOSO / Virt
```

**There is no Kafka / AMQ Streams path.** Operators call AAP JobTemplates directly.

## Doc map

| What you need | Document |
|---------------|----------|
| End-to-end mental model | [flow.md](flow.md) |
| Hands-on lab | [workshop/README.md](workshop/README.md) |
| Every CRD (how to use) | [usage/crds/README.md](usage/crds/README.md) |
| Dashboards (how to use) | [usage/ui/README.md](usage/ui/README.md) |
| Add a new AWS account | [how-to/add-cloudaws.md](how-to/add-cloudaws.md) |
| Add a new RHOSO cloud | [how-to/add-cloudoso.md](how-to/add-cloudoso.md) |
| Add a new Virt cluster | [how-to/add-cloudvirt.md](how-to/add-cloudvirt.md) |
| Specs (design) | [../specs/README.md](../specs/README.md) |
| C4 architecture | [../architecture/docs/c4.md](../architecture/docs/c4.md) |
| Concepts / technical / tutorials | [../architecture/docs/architecture.md](../architecture/docs/architecture.md) |
| Bootstrap / ops | [../bootstrap/README.md](../bootstrap/README.md) |

## Rules (always)

1. **No secrets in Git** — Vault + ExternalSecret / PushSecret only.
2. **Never delete `sovereign-*` namespaces.**
3. **GitOps after bootstrap** — change Git; ArgoCD syncs. `oc` is for investigation (and demo Assignment CRs when practicing).
4. **One hub** — all platform control plane lives there.

## Quick start (operators already running)

1. Put cloud credentials in a Secret (never commit them).
2. Create a **Cloud\*** CR (`CloudAWS` / `CloudOSO` / `CloudVirt`).
3. Wait until status is ready / synced.
4. Create a **PlatformOpenshift** (or PlatformAKS / PlatformEKS) that references that cloud.
5. Watch Hive / Hypershift / ACM until the spoke is **Provisioned**.
6. Create **Entity** → **Team** → **Assignment** for tenant access.

Deep detail: [workshop/README.md](workshop/README.md).
