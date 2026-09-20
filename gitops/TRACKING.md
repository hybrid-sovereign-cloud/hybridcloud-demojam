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


### 2026-09-20T04:10:00Z — Platform mostly green

| Component | Status |
|-----------|--------|
| Gitea | Synced Healthy Running |
| Vault | Init+unsealed; CSS Ready |
| Quay | Available |
| Operators | 8/8 Running v1alpha1 |
| Samples | Entity/AAP/Quay/Rbac/UIHealth live; Entity pending JT |
| UI dashboards | Running + Routes |
| Console plugins | Images built |
| ESO | Operand + CSS Ready; PushSecrets syncing |
| ACM | Still Installing |
| AAP JTs | Not seeded yet (blocker for full Entity provision) |
| Phase 9 | Deferred until JT seed + ACM Running |


### 2026-09-20T04:15:00Z — Console plugins + AAP JT seed

| Field | Value |
|-------|-------|
| Change summary | Deploy ConsolePlugins from local IS; seed stub AAP JobTemplates via Job |
| Status | in-progress |
| Next | Enable plugins in Console CR; verify Entity launches JT; ACM Running; Phase 9 |


### 2026-09-20T04:20:00Z — Execution checkpoint (Phases 0–8 largely green)

**Healthy / Synced:** hs-gitea, hs-vault, hs-quay, hs-eso, hs-builds, hs-operators, hs-samples, hs-security (PushSecrets), hs-ui (dashboards+plugins), hs-aap-config

**Live:**
- Vault initialized/unsealed; ClusterSecretStore Ready; PushSecrets Synced
- Entity `acme-corp` launched AAP job `entity-provision` → AAP job successful
- UI: sovereign-cloud-dashboard + tenancy-dashboard Running; console plugins Running + enabled
- 39 AAP JobTemplates seeded (stub hello_world)

**Still open:**
- ACM MulticlusterHub Installing
- field-content OutOfSync (cosmetic Application drift)
- Entity status flip to `provisioned` on next reconcile
- Phase 9 zero-touch wipe deferred until ACM Running


### 2026-09-20T04:25:00Z — Entity provisioned

Entity `acme-corp` phase=provisioned ready=true after AAP `entity-provision` job succeeded.
Anti-loop fix pushed (no relaunch when job already successful). ACM still Installing — Phase 9 wipe deferred.


### 2026-09-20T04:35:00Z — Resume: ACM OG + Overview 404 + tenant samples

| Field | Value |
|-------|-------|
| Change summary | Fix MCE OperatorGroup OwnNamespace (ACM stuck UnsupportedOperatorGroup); Overview CR fetch via raw K8s lists (no /api/overview/crs); add entity-acme-corp tenant + Hybrid VPC sample CRs |
| Status | in-progress |
| Next | Push; recreate MCE OG; rebuild admin plugin; verify MCH Running + Overview + samples |


### 2026-09-20T04:50:00Z — ACM Running + samples + Overview fix deployed

| Field | Value |
|-------|-------|
| Change summary | MCE CSV Succeeded after OwnNamespace OG recreate; MulticlusterHub Running; entity-acme-corp tenant samples + Hybrid VPC CRs synced; admin plugin rebuilt on e09f479 |
| Status | complete (Phase 9 still deferred) |
| Next | Hard-refresh console Overview; Phase 9 zero-touch wipe when ready |


### 2026-09-20T04:55:00Z — Tenant operators + full ACME samples + plugin creds

| Field | Value |
|-------|-------|
| Change summary | Deploy missing tenant-kind operators (Rbac/Team/Project/Persona/Vault/…); expand samples (Vault/VaultKV/AAPOrg/QuayOrg/tool Rbacs/UI health); sync RHBK/AAP/Quay secrets into sovereign-cloud-plugins |
| Status | in-progress |
| Next | Sync Argo; force-reconcile configs; monitor all CRs to provisioned |


### 2026-09-20T05:20:00Z — Fix operator AAP reconcile loop

| Field | Value |
|-------|-------|
| Change summary | Stop relaunching successful AAP jobs; mark provisioned/ready; set observedGeneration on launch; end_play after launch/ready |
| Status | in-progress |
| Next | Rebuild ansible-operator image; restart operators; CRs → provisioned |


### 2026-09-20T05:55:00Z — Full CR checklist checkpoint

| Field | Value |
|-------|-------|
| Change summary | 19 operators live (tenant+platform); all non-parked sample CRs present incl Vault/VaultKV/AAPOrg/QuayOrg/14 Rbacs; plugin secrets synced; standalone dashboards HTTP 200; operator memory/reconcile fixes |
| Status | majority CRs provisioned; remaining rbacs/personas catching up on mark-ready |
| UI | https://sovereign-cloud-dashboard-sovereign-ui.apps.cluster-qvhzm.dyn.redhatworkshops.io/ and tenancy-dashboard route |
| Note | AAP JTs are hello_world stubs — Keycloak group creation is stub-success until real playbooks attached |
| Next | Confirm remaining rbacs/personas → provisioned; Phase 9 optional |


### 2026-09-20T06:01:00Z — All non-parked HS CRs provisioned

| Field | Value |
|-------|-------|
| Change summary | 38/38 sample CRs provisioned (incl 14 Rbacs, Vault/VaultKV, AAPOrg/QuayOrg, Personas); standalone dashboards HTTP 200; 19 operators Running |
| Status | complete |
| Standalone UI | Admin + Tenancy dashboard routes live |
| Caveat | AAP JobTemplates still hello_world stubs — RHBK group creation is stub-success until real eda playbooks are wired |
| Phase 9 | Still deferred |

---
### 2026-09-20T13:05:00Z — Dashboard OAuth proxy (fix Entities 401)

| Field | Value |
|-------|-------|
| Change summary | Add ose-oauth-proxy sidecars + SA OAuth redirect + cookie-secret bootstrap Job; reencrypt Routes on :8443 so Express gets X-Forwarded-Access-Token |
| Paths touched | `gitops/apps/ui/templates/dashboards.yaml`, `oauth-bootstrap.yaml`, `Chart.yaml`, `TRACKING.md` |
| Status | in-progress |
| Next | Push; Argo sync hs-ui; login via OpenShift OAuth; verify Entities list loads |

