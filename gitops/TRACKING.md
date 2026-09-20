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
