# Hybrid Sovereign GitOps — Change Tracking Sheet

## Executive Summary

| Field | Value |
|-------|-------|
| Current phase | ZTP single-hub GitOps |
| Status | green |
| Last green checkpoint | Waves 5→60 Synced/Healthy; Argo 2 shards/8Gi; sovereign-ui Prune=false |
| Blockers | none |
| Next action | Cold-cluster soak: point new Argo root at `gitops/` and watch waves |

**Cluster-1 baseline (do not uninstall):** AAP Controller (`aap/aap`), RHBK (`keycloak/keycloak`), ODF/NooBaa, OpenShift GitOps, CNV, cert-manager.

**Argo root:** Application `field-content` → `gitops/` @ `main`.

**ZTP guide:** [`gitops/ZTP.md`](./ZTP.md)

---

## Change Log

### 2026-09-25 — Fix QuayOrg false-success (CSRF auth + org GET assert)

| Field | Value |
|-------|-------|
| Change summary | QuayOrg marked `ready=true` without creating the org: `/api/v1/signin` needs CSRF and returns no `access_token`; code fell back to password-as-Bearer (401) and `ignore_errors` on create. Fixed CSRF→apptoken Bearer obtain, removed password-as-Bearer, assert GET org 200 before ready. Quay config enables `FEATURE_USER_INITIALIZE`; cred sync seeds real admin+token (not SECRET_KEY). |
| Root cause | (1) signin without CSRF → fail → password used as Bearer → 401; (2) org/team URI tasks `ignore_errors: true`; (3) no post-create GET verification; (4) cred bootstrap stored registry SECRET_KEY as admin password |
| Paths touched | `eda/common/tasks/obtain_quay_admin_credentials.yml`, `eda/rulebooks/common/tasks/obtain_quay_admin_credentials.yml`, `eda/{rulebooks,plugin-quay}/roles/quayorg_provision/tasks/main.yml`, `gitops/infrastructure/quay/**`, `gitops/infrastructure/security/templates/plugin-cred-sync.yaml`, `gitops/apps/platform-configs/templates/ensure-plugin-creds.yaml`, this file |
| Rollback | Revert this commit; re-annotate QuayOrg after prior playbooks restore |
| Status | green (code) |
| DE rebuild | **Not required** for AAP JT path (`scm_update_on_launch` on HybridSovereign EDA). Optional `make -C eda/plugin-quay de-plugin-quay-build-push` only if EDA `run_playbook` activations bake roles from the DE image. |
| Next action | Push main; Argo sync `hs-quay` + re-run platform-configs PreSync for admin initialize; annotate QuayOrg to requeue AAP job 87 successor |

### 2026-09-25 — DEV: Vault HA uses integrated raft (not file)

| Field | Value |
|-------|-------|
| Change summary | Fix plugin-vault HA path: `spec.ha: true` was deploying 3 replicas with `storage "file"`, which is not shared — only pod-0 initializes; others stay uninitialized and route 503s. HA now uses integrated raft + `VAULT_CLUSTER_ADDR` + `retry_join`; `ha: false` keeps single-replica file storage. |
| Paths touched | `eda/plugin-vault/roles/vault_provision/tasks/deploy_resources.yml`, `eda/rulebooks/roles/vault_provision/tasks/deploy_resources.yml`, samples comments, this file |
| Rollback | Revert this commit; recreate Vault CR / wipe STS+PVCs if storage backend already flipped |
| Status | green (code) |
| Next action | Rebuild/redeploy vault EDA DE if roles are image-baked; re-provision affected Vault CRs |

### 2026-09-25 — Remove obsolete tree and Kafka/AMQ artifacts

| Field | Value |
|-------|-------|
| Change summary | Deleted `obsolete/`, `specs/archive`, `specs/016-amq-streams`, AMQ Streams + event-forwarder charts, hardening Makefile targets |
| Paths touched | `obsolete/**` (removed), `bootstrap/helm/charts/{amq-streams,event-forwarder}`, `architecture/Makefile`, docs/tests refs |
| Rollback | Restore from git history prior to this commit |


### 2026-09-20T19:00:00Z — ZTP durable Vault KV seed (pre wipe-2)

| Field | Value |
|-------|-------|
| Change summary | Extend hs-plugin-cred-sync PostSync to seed hybridsovereign KV (openshift/aap/quay/rhbk) so wipe→rollout needs no mid-process hand-seeding |
| Paths touched | `gitops/infrastructure/security/templates/plugin-cred-sync.yaml`, Chart 0.1.5, `gitops/ZTP.md` |
| Rollback | Revert chart to 0.1.4 / prior plugin-cred-sync |
| Next action | Push; full wipe; single field-content sync; monitor-only |


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
| Change summary | Moved obsolete single-hub/Kafka/EDA docs into obsolete/ |
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
| Change summary | Add ose-oauth-proxy sidecars + SA OAuth redirect + initContainer cookie secret; reencrypt Routes on :8443 so Express gets X-Forwarded-Access-Token |
| Paths touched | `gitops/apps/ui/templates/dashboards.yaml`, `Chart.yaml`, `TRACKING.md` |
| Status | complete |
| Verify | `/api/entities` + `/api/k8s/.../entities` return `acme-corp` with user token; oauth authorize redirects to RHBK |
| Next | Browser login on admin dashboard → Entities live list |

---
### 2026-09-20T13:30:00Z — Console React #306 (tenant codeRef)

| Field | Value |
|-------|-------|
| Change summary | Fix tenant `*.default` codeRefs (LazyComponent double-default → undefined); Overview error boundary + HTML table; rebuild plugins |
| Status | in-progress |
| Note | Temporarily removed `sovereign-tenant-plugin` from console.operator plugins until image rebuild |


---
### 2026-09-20T13:40:00Z — Console useHistory → useNavigate (RR v6)

| Field | Value |
|-------|-------|
| Change summary | OpenShift 4.22 console shares react-router-dom v6; plugins called useHistory (v5) → crash on Entities |
| Paths | admin/tenant console-plugin components + package.json react-router-dom ^6 |
| Status | in-progress |


---
### 2026-09-20T13:45:00Z — Keycloak sovereign-tenants backfill

| Field | Value |
|-------|-------|
| Change summary | AAP JTs were hello_world stubs — Rbacs ready with empty Group; provisioned realm `sovereign-tenants`, 14 groups under `/acme-corp/*`, 4 persona users, OIDC client; patched Rbac/Persona status |
| Status | complete (manual API backfill) |
| Where to look | Keycloak admin → switch realm to **sovereign-tenants** (not master); Groups + Users |
| Caveat | Still stub JTs — future Rbac CRs will not auto-create groups until real eda playbooks replace hello_world |
| Demo users | test-entity-admin / test-assignment-admin / test-auditor / test-identity-admin — password `AcmeDemo123!` |


---
### 2026-09-20T14:05:00Z — Real jobs + SSO realm + Vault/Quay installs

| Field | Value |
|-------|-------|
| Change summary | AAP JTs → HybridSovereign EDA real playbooks (except cloudoso/cloudaws/platformopenshift stubs); Keycloak realm **sso** (OpenShift IdP); groups+users; OAuth groups claim; OCP Groups/RoleBindings; entity Vault install; Quay admin+org |
| AAP | Project `HybridSovereign EDA` + Vault credential; seed Job updated |
| Keycloak | Realm `sso` (existing SSO); Rbac.status.realm=sso; groups under `/acme-corp/*`; OIDC client `idp-4-ocp` groups mapper (leaf names) |
| OpenShift | OAuth claims.groups=[groups]; 14 Groups + RoleBindings in entity-acme-corp |
| Vault | `vault-acme-vault` Running in entity-acme-corp; CR URL set; OIDC to sso |
| Quay | Admin initialized; org `acme-corp-acme-registry`; token in quay-admin-credentials |
| RBAC test | **14/14** PASS (SSO groups claim + OCP group + can-i) |
| Demo users | `test-entity-admin`, `test-auditor`, … / `u-acme-*` — password `AcmeDemo123!` via IdP **rhbk** |
| Code | Missing obtain_* common tasks; realm defaults→sso; ansible.cfg; seed-jobtemplates; aap_job note+realm |
| Note | Push repo so AAP scm_update_on_launch picks up obtain_* permanently; operators still skip relaunch while phase=provisioned |


---
### 2026-09-20T14:15:00Z — Use OpenShift lab `sso` realm only

| Field | Value |
|-------|-------|
| Change summary | Drop `sovereign-tenants` entirely; all Keycloak ops target OpenShift-provided realm **`sso`**; deleted leftover `sovereign-tenants` realm from Keycloak; rbacconfig will not create `sso`/`master` |
| Live | Realms = master + sso; OAuth issuer = .../realms/sso; all Rbac.status.realm = sso |
| Note | RbacConfig CR name `keycloak-sovereign-tenants-services` is historical only — not a Keycloak realm name |


---
### 2026-09-20T14:20:00Z — Fix console plugin React #306 (PerspectiveIcon)

| Field | Value |
|-------|-------|
| Root cause | Webpack MF chunk for PerspectiveIcon emitted broken `default` export (arrow FC) → `m.default` undefined → React #306 in console nav |
| Fix | Rewrite PerspectiveIcon as `export default function`; rebuild admin plugin **1.2.23**; rolled out |
| Verify | Live chunk has `t.d(e,{default:()=>o})` + `function o()`; plugins re-enabled on console.operator |
| User action | Hard-refresh OpenShift console (Ctrl+Shift+R) to drop cached plugin-entry |


---
### 2026-09-20T14:25:00Z — React #306 real fix: LazyComponent icon shape (1.2.24)

| Field | Value |
|-------|-------|
| Root cause | OCP 4.22 NavHeader does `icon().then(m => m.default)`. CodeRef must resolve to `{ default: Component }` (LazyComponent), not a bare component. Prior `PerspectiveIcon` default-export module left `m.default` undefined after codeRef unwrap → #306 even with cache disabled |
| Fix | Match MCE: `export const icon = { default: PerspectiveIcon }` + `"$codeRef": "perspective.icon"`; admin plugin **1.2.24** |
| Live | IS `sovereign-admin-plugin:latest` → 1.2.24; console.operator plugins include sovereign-admin/tenant + acm/mce |
| User action | Hard-refresh console once (Disable cache OK) |


---
### 2026-09-20T14:45:00Z — Fix raw i18n keys in perspective switcher

| Field | Value |
|-------|-------|
| Symptom | Perspective switcher / nav showed `console-app~Core platform`, `plugin__mce~Fleet management`, etc. Sovereign Cloud Entities page itself worked |
| Root cause | Console shares `react-i18next` with plugins; our `initI18n()` called `initReactI18next` and replaced the host i18n singleton |
| Fix | Console host path uses isolated `createInstance()` and never calls `initReactI18next`; removed eager `initI18n()` from plugin.ts; admin **1.2.25** + tenant **1.3.19** |
| User action | Hard-refresh once — labels should read Core platform / Fleet management / etc. |


---
### 2026-09-20T14:55:00Z — Fix standalone dashboard OAuth `scope denied: user:full`

| Field | Value |
|-------|-------|
| Symptom | tenancy-dashboard `/oauth/callback?error=access_denied&error_description=scope+denied:+user:full` |
| Root cause | ose-oauth-proxy used SA-as-OAuth-client (`-openshift-service-account=…`) which **cannot** request `user:full` (only user:info / user:check-access / role:…:ns) |
| Fix | Create real `OAuthClient`s (`tenancy-dashboard`, `sovereign-cloud-dashboard`) + secrets; proxy uses `-client-id` / `-client-secret-file`; gitops Job `dashboard-oauth-bootstrap` + chart 0.1.10 |
| User action | Re-open tenancy dashboard URL and log in via rhbk |


---
### 2026-09-20T15:00:00Z — Console plugin CSS: migrate to PatternFly 6

| Field | Value |
|-------|-------|
| Symptom | Entities page data OK but layout/CSS broken (overlapping filters, unstyled table) |
| Root cause | OCP 4.22 console ships **PF6 only**; plugins still rendered `pf-v5-*` classes with no matching host CSS |
| Fix | Upgrade `@patternfly/*` to ^6.4; migrate `openshift.css` to pf-v6 / pf-t tokens; PF6 Modal/Label APIs; admin **1.2.26** + tenant **1.3.21** |
| User action | Hard-refresh console; toggle light/dark — plugin should match console chrome |


---
### 2026-09-20T15:10:00Z — ZTP follow-up: NS prune + AAPOrg schema

| Field | Value |
|-------|-------|
| Incident | `hs-ui` prune deleted `sovereign-ui` (tracking-id still hs-ui) → Terminating; UI recreated via field-content sync |
| Fix | `Prune=false` on parent Namespaces; remove invalid `AAPOrg.spec.description` (not in CRD OpenAPI → SSA ComparisonError) |
| Chart | 0.1.3 |
| Status | recovering |


---
### 2026-09-20T15:15:00Z — Clear residual OutOfSync (CRDs + PushSecrets)

| Field | Value |
|-------|-------|
| Fix | Remove null `metadata.labels` from AAP/Quay CRDs; align PushSecret API defaults; ignoreDifferences for CRD conversion/status + PushSecret status |
| Chart | 0.1.4 |
| Status | pushed |


---
### 2026-09-20T15:20:00Z — Fix hs-aap-config Helm ComparisonError

| Field | Value |
|-------|-------|
| Root cause | `seed-jobtemplates.yaml` used AAP injector `{{ token }}` / `{{ addr }}` — Helm treated as template functions |
| Fix | Escape as raw strings for AAP Credential Type injectors |
| Chart | 0.1.5 |
| Status | green pending refresh |


### 2026-09-21T01:05:00Z — ZTP-001/002/003 fix (cluster-fbwcv stuck)

| Field | Value |
|-------|-------|
| Change summary | Unstick hs-operators CRD health wait (disable SSA on CRDs/app); dynamic apps-domain for AAP/Vault/UIHealth; remove shared external-secrets NS from ESO chart; add issues.md |
| Paths touched | `gitops/custom-operators/crds/*`, `gitops/templates/applications.yaml`, `gitops/infrastructure/aap/*`, `gitops/infrastructure/security/*`, `gitops/apps/samples/*`, `gitops/operators/eso`, `gitops/issues.md`, Chart bumps |
| Next action | Push; full wipe; single field-content sync; monitor-only |
| Status | in-progress |


### 2026-09-21T01:25:00Z — ZTP-004 safe wipe script (cluster-fbwcv destroyed)

| Field | Value |
|-------|-------|
| Incident | Ad-hoc wipe used bare CRD plural `projects` → deleted OpenShift Projects; OAuth/:443 died |
| Change summary | Add `scripts/ztp-wipe.sh` with FQ-only HS deletes + Project API refuse; document ZTP-004 |
| Paths touched | `scripts/ztp-wipe.sh`, `gitops/issues.md`, `gitops/ZTP.md` |
| Next action | Rebuild cluster; use only `./scripts/ztp-wipe.sh` for future wipes |
| Status | halted pending new cluster |


### 2026-09-21T03:30:00Z — ZTP-005/006 fix (cluster-l9mxc)

| Field | Value |
|-------|-------|
| Change summary | plugin-cred-sync: no PyYAML/curl; aap-cred-sync RBAC for ingresses+routes; seed aap-admin for PushSecret |
| Paths touched | `gitops/infrastructure/security/*`, `gitops/infrastructure/aap/*`, `gitops/issues.md` |
| Next action | Push; `./scripts/ztp-wipe.sh`; monitor-only |
| Status | in-progress |


### 2026-09-21T03:45:00Z — ZTP-001 HALT + stronger tracking fix (l9mxc)

| Field | Value |
|-------|-------|
| Incident | ZTP-001 recurred after SSA=false fix: CRDs still lack tracking-id; hs-operators stuck |
| Change summary | Embed tracking-id + instance label on all CRDs; ArgoCD annotation+label tracking via capacity tune |
| Note | ZTP-005/006 verified (aap-cred-sync + PushSecrets green). No further wipe for ZTP-001 until this lands and is retested |
| Status | halted |


### 2026-09-21T03:50:00Z — ZTP-007 quay OLM orphan CSV

| Field | Value |
|-------|-------|
| Change summary | Wipe clears quay Subscription/IP/CSV; ZTP-001 tracking-id embed already unblocked operators via selfHeal |
| Next action | Push wipe fix; `./scripts/ztp-wipe.sh`; monitor |
| Status | in-progress |


### 2026-09-21T04:20:00Z — ZTP-008 wipe auth preservation

Wipe preserves dockercfg/builder SAs; skips emptying external-secrets; refreshes builder SA in sovereign-cloud.


| DEV-004 | 2026-09-25 | AAPOrg teardown marks deletionComplete while org remains | Teardown looked up Route `sovereign-aap` (missing); DNS fail ignored; still patched deletionComplete | Resolve URL from admin secret.url or Route `aap`; assert org gone before deletionComplete | 1 (fixing) |

| DEV-005 | 2026-09-25 | QuayOrg teardown marks deletionComplete while org remains | Teardown used unset `quay_url` (relative path), ignored DELETE failure; Argo autosync recreated CR | Use obtain_quay_admin_credentials; assert GET 404 before deletionComplete; re-disable Argo autosync live | 1 (fixing) |

| DEV-006 | 2026-09-25 | Vault HA raft followers stay sealed (1/3 Ready) | Followers retry_join but wait for unseal keys; only leader voter in raft config | Need auto-unseal or join-token unseal path for non-leader pods after raft migrate | 1 (open) |

| DEV-007 | 2026-09-25 | Assignment ACM Policy NonCompliant: Argo/Istio CRDs missing on spoke | Policy enforces AppProject/ArgoCD/SMCP but hosted spoke has no GitOps/Maistra operators | Platform or Assignment must install GitOps + OpenShift Service Mesh operators before CR objects | 1 (open) |
