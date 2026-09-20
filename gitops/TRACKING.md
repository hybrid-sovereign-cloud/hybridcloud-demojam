# Hybrid Sovereign GitOps — Change Tracking Sheet

## Executive Summary

| Field | Value |
|-------|-------|
| Current phase | 0–1 (foundation) |
| Status | in-progress |
| Last green checkpoint | none yet |
| Blockers | none |
| Next action | Push `gitops/` to main; wait for Argo `field-content` path error to clear; continue Phase 2 Vault/ESO |

**Cluster-1 baseline (do not uninstall):** AAP Controller (`aap/aap`), RHBK (`keycloak/keycloak`), ODF/NooBaa, OpenShift GitOps, CNV, cert-manager.

**Argo root:** Application `field-content` → `gitops/` @ `main`.

---

## Change Log

### 2026-09-20T03:05:00Z — Phase 0/1 — Agent Alpha+Eta

| Field | Value |
|-------|-------|
| Change summary | Created sole `gitops/` Helm app-of-apps; namespaces; AppProject; child Applications; TRACKING; ban lint script; rewritten README |
| Paths touched | `gitops/**`, `README.md`, `scripts/gitops-ban-check.sh`, `obsolete/README.md`, `docs/gitops-install.md` |
| Cluster actions | None yet (awaiting push → Argo sync) |
| Rollback | `git revert` this commit; or delete Application children with label `hybridsovereign.redhat/gitops-owned=true` (never delete baseline AAP/RHBK/ODF/GitOps/CNV) |
| Status | in-progress |
| Next action | `git push origin main`; hard-refresh `field-content`; verify Synced; Phase 2 |

---
### 2026-09-20T03:10:00Z — Phase 1 docs — Agent Alpha

| Field | Value |
|-------|-------|
| Change summary | Moved obsolete two-cluster/Kafka/EDA docs into obsolete/ |
| Paths touched | `obsolete/architecture/**`, `obsolete/specs/**` |
| Cluster actions | none |
| Rollback | move files back from obsolete/ |
| Status | done |
| Next action | Push main; Argo sync |

---
### 2026-09-20T03:25:00Z — Phase 2–6 scaffold — Agents Epsilon/Beta/Gamma

| Field | Value |
|-------|-------|
| Change summary | ESO Subscription; minimal Vault STS; ACM+MCE; Quay+OBC; Gitea; BuildConfigs/IS; shared operator base + Entity/platform Deployments; AAP cred sync Job; CRDs via kustomize |
| Paths touched | `gitops/operators/eso`, `gitops/infrastructure/*`, `gitops/builds`, `gitops/custom-operators`, `src/custom-operators/base` |
| Cluster actions | Await Argo sync of child apps |
| Rollback | Disable provision.* flags or prune apps labeled hybridsovereign.redhat/gitops-owned; never delete AAP/RHBK/ODF/GitOps/CNV |
| Status | in-progress |
| Next action | Push; monitor builds, ESO CSV, Vault pod, Quay, ACM; seed samples when CRDs Ready |

---
### 2026-09-20T03:15:00Z — Remediation Beta/Epsilon/Gamma

| Field | Value |
|-------|-------|
| Change summary | Fix CRDs (strip helm leftovers); drop ansible.controller from operator image; Vault VAULT_LOCAL_CONFIG |
| Paths touched | `gitops/custom-operators/crds`, `src/custom-operators/base/requirements.yml`, `gitops/infrastructure/vault` |
| Rollback | git revert |
| Status | in-progress |
| Next action | Push; rebuild operator; vault Ready; hs-operators sync |

---
### 2026-09-20T03:20:00Z — Remediation

| Field | Value |
|-------|-------|
| Change summary | Fix duplicate CRD status.message keys; Vault entrypoint+VAULT_LOCAL_CONFIG |
| Status | in-progress |
| Next action | Sync hs-operators/vault; confirm operator build Complete |

---
### 2026-09-20T03:30:00Z — Status checkpoint
Quay Available; 24 CRDs; 8 platform operators; ESO ok; images built. Next: Vault, Gitea, UI, samples.
### 2026-09-20T03:35:00Z — Vault Ready

| Field | Value |
|-------|-------|
| Change summary | Vault 1/1 Running (emptyDir config + no entrypoint). Quay Available. ESO ok. 24 CRDs. 8 platform operators. |
| Next action | Unstick Gitea Job; UI BuildConfigs; live samples; Entity tenant-op spawn; PushSecrets; Phase 7–9 |
| Status | in-progress |

---

### 2026-09-20T03:45:00Z — Remediaton: watches v1alpha1 + Gitea rootless

| Field | Value |
|-------|-------|
| Change summary | Fix operator watches ConfigMaps `version: 1` → `v1alpha1` (operators CrashLoop); Gitea anyuid + mount `/var/lib/gitea` for rootless image; image-puller RBAC already in tree |
| Paths touched | `gitops/custom-operators/*-operator*.yaml`, `src/custom-operators/base/watches/*`, `gitops/infrastructure/gitea` |
| Cluster actions | Push → hard-refresh hs-operators, hs-gitea; restart operator pods |
| Rollback | git revert |
| Status | in-progress |
| Next action | Confirm Gitea 1/1 + operators Running; UI BuildConfigs; samples; PushSecrets |


### 2026-09-20T03:50:00Z — Phase 2–7 advance

| Field | Value |
|-------|-------|
| Change summary | Gitea Healthy; operators watching v1alpha1; Vault init Job; ClusterSecretStore+PushSecrets; live Entity+platform sample CRs; UI BuildConfigs + dashboard Deployments; Quay/Gitea ignoreDifferences |
| Paths touched | `gitops/**`, `ui/Containerfile.*.s2i`, `src/custom-operators/base/watches/*` |
| Status | in-progress |
| Next action | Sync; vault init; UI builds Complete; Entity reconcile; ACM Running; Phase 8–9 |


### 2026-09-20T04:05:00Z — Checkpoint

| Field | Value |
|-------|-------|
| Green | Gitea, Vault init/unsealed, Quay Available, 8 operators, Entity sample (pending JT), UI dashboards Running, plugins built, ESO operand Ready |
| Blockers | AAP JobTemplates not seeded; ClusterSecretStore blocked by ESO deny-all until netpol lands; ACM still Installing; Phase 9 wipe deferred |
| Next | ESO→Vault netpol; seed AAP JTs; console plugins deploy; ACM; Phase 9 |

