# Hybrid Sovereign Cloud

Single-cluster Hybrid Sovereign platform delivered **only** via ArgoCD sync of this repository’s [`gitops/`](gitops/) folder.

## Multi-cluster install (50+ clusters)

Every OpenShift cluster must be a **mirror replica**:

1. **Baseline** (same on all clusters; never uninstall via this repo): AAP Controller, RHBK/Keycloak, ODF/NooBaa, OpenShift GitOps, CNV, cert-manager.
2. Point ArgoCD at:
   - **repo:** `https://github.com/hybrid-sovereign-cloud/hybridcloud-demojam`
   - **path:** `gitops`
   - **revision:** `main`
3. Sync. The `gitops/` Helm chart creates namespaces, AppProject, and child Applications that install Quay, Vault, ESO, Gitea, ACM/MCE, operators, UI, samples, and AAP JobTemplates.

**Non-negotiable:** No workload `oc apply`. All installs come from the `gitops/` sync.

## Architecture (current)

- **Entity operator:** singleton in `sovereign-cloud` only; spawns per-kind tenant operators in each `entity-*` namespace.
- **Operators → AAP:** each kind operator launches AAP JobTemplates; on fail or job not completed in 3h → cancel and relaunch. Status updates must not create infinite reconcile loops.
- **No EDA / Kafka / AMQ / MTC / MTV** in the active path.
- **Images:** OpenShift BuildConfigs → ImageStreams (no `quay.signal9.gg`).
- **Quay:** provisioned on ODF S3 for `QuayConfig` / `QuayOrg`.
- **Secrets:** `sovereign-secrets` + PushSecret → Vault.
- **Parked samples (not applied):** CloudAWS, CloudOSO, PlatformOpenshift, OpenStackMigration.

## Tracking & docs

- Live change log / resume sheet: [`gitops/TRACKING.md`](gitops/TRACKING.md)
- Install notes: [`docs/gitops-install.md`](docs/gitops-install.md)
- Obsolete material: [`obsolete/`](obsolete/)

## Local development

Source remains under `operator/`, `ui/`, `eda/`, `samples/` for reference and builds. **Runtime deploy path is only `gitops/`.**
