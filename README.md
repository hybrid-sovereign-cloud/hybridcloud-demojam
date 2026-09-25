# Hybrid Sovereign Cloud

Single-cluster Hybrid Sovereign platform delivered **only** via ArgoCD sync of this repository’s [`gitops/`](gitops/) folder.

## Documentation (start here)

| Doc | Purpose |
|-----|---------|
| **[docs/README.md](docs/README.md)** | Index + one-picture flow |
| [docs/flow.md](docs/flow.md) | Layers: Cloud → Platform → Entity → Assignment |
| [docs/workshop/](docs/workshop/) | Hands-on workshop |
| [docs/usage/crds/](docs/usage/crds/) | CRD usage |
| [docs/usage/ui/](docs/usage/ui/) | Admin / Tenant UI |
| [docs/how-to/add-cloudaws.md](docs/how-to/add-cloudaws.md) | New AWS account |
| [docs/how-to/add-cloudoso.md](docs/how-to/add-cloudoso.md) | New RHOSO cloud |
| [docs/how-to/add-cloudvirt.md](docs/how-to/add-cloudvirt.md) | New virt cluster |

## Multi-cluster install (50+ clusters)

Every OpenShift cluster must be a **mirror replica**:

1. **Day 0 (manual):** Secrets in `sovereign-secrets` ([workshop Day 0](architecture/docs/workshop-tutorials.md)).
2. **Baseline** (same on all clusters; never uninstall via this repo): AAP Controller, RHBK/Keycloak, ODF/NooBaa, OpenShift GitOps, CNV, cert-manager.
3. Point ArgoCD at:
   - **repo:** `https://github.com/hybrid-sovereign-cloud/hybridcloud-demojam`
   - **path:** `gitops`
   - **revision:** `main`
4. Sync once (root app). After that: **Git only** — no mid-rollout Argo syncs, no workload `oc apply` for platform.

**Non-negotiable:** Zero hardcoded cluster URLs/IPs in Git. Credentials only via Vault. Guardrails: [architecture/docs/workshop-tutorials.md).

## Architecture (current)

```text
Git → ArgoCD → Operators → AAP JobTemplates → AWS / RHOSO / Virt spokes
```

- **Entity operator:** singleton in `sovereign-cloud`; per-entity namespace operators for tenant kinds.
- **Operators → AAP:** each kind launches JobTemplates (no Kafka / AMQ / EDA in the active path).
- **Secrets:** `sovereign-secrets` + PushSecret → Vault.
- **Clouds:** CloudAWS, CloudOSO, CloudVirt + PlatformOpenshift `openstack` \| `aws` \| `hosted`.

## Tracking

- ZTP: [`gitops/ZTP.md`](gitops/ZTP.md)
- Specs: [`specs/README.md`](specs/README.md)
- Obsolete: [`obsolete/`](obsolete/)

## Local development

Source under `operator/`, `ui/`, `eda/`, `samples/` for builds. **Runtime deploy path is only `gitops/`.**
