# Hybrid Sovereign Cloud

Single-cluster Hybrid Sovereign platform delivered **only** via ArgoCD sync of this repository’s [`gitops/`](gitops/) folder.

## Multi-cluster install (50+ clusters)

Every OpenShift cluster must be a **mirror replica**:

1. **Day 0 (manual):** uncommented bashrc → Secrets in `sovereign-secrets` ([workshop Day 0](architecture/docs/workshop/00-day0-secrets.md)).
2. **Baseline** (same on all clusters; never uninstall via this repo): AAP Controller, RHBK/Keycloak, ODF/NooBaa, OpenShift GitOps, CNV, cert-manager.
3. Point ArgoCD at:
   - **repo:** `https://github.com/hybrid-sovereign-cloud/hybridcloud-demojam`
   - **path:** `gitops`
   - **revision:** `main`
4. Sync once (root app). After that: **Git only** — no mid-rollout Argo syncs, no workload `oc apply`.

**Non-negotiable:** Zero hardcoded cluster URLs/IPs in Git. Credentials only via Vault. Guardrails: [architecture/docs/workshop/01-ztp-guardrails.md](architecture/docs/workshop/01-ztp-guardrails.md).

## Architecture (current)

- **Entity operator:** singleton in `sovereign-cloud`; per-kind operators (cluster-wide watch) for tenant/platform kinds.
- **Operators → AAP:** each kind launches JobTemplates; fail or >3h → cancel+relaunch; status must not loop.
- **No EDA / Kafka / AMQ / MTC / MTV** in the active path.
- **Images:** OpenShift BuildConfigs → ImageStreams (no external Quay hardcoding).
- **Secrets:** `sovereign-secrets` + PushSecret → Vault (`hs-security`).
- **Cloud samples (unparked):** CloudAWS, CloudOSO, CloudVirt + PlatformOpenshift `openstack|aws|hosted`.
- **Still parked:** OpenStackMigration.

## Tracking & docs

- ZTP contract: [`gitops/ZTP.md`](gitops/ZTP.md)
- Issues / recurrence halt: [`gitops/issues.md`](gitops/issues.md)
- Workshop: [`architecture/docs/workshop/`](architecture/docs/workshop/)
- EVPN design (OSO+Virt): [`architecture/docs/technical/58-hybridvpc-evpn-oso-virt.md`](architecture/docs/technical/58-hybridvpc-evpn-oso-virt.md)
- Obsolete material: [`obsolete/`](obsolete/)

## Local development

Source remains under `operator/`, `ui/`, `eda/`, `samples/` for reference and builds. **Runtime deploy path is only `gitops/`.**
