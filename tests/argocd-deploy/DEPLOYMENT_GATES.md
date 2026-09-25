# ArgoCD Deployment Gates

**Scope**: Per-phase verification gates for Hybrid Sovereign bootstrap rollout  
**Reference**: Spec 034 (Bootstrap Deployment), `specs/README.md` Mega-Phase mapping  
**Rule**: No phase is complete until its gate passes and changes are committed + pushed

---

## Global Pre-Conditions (Every Phase)

| Gate | Command / Check | Pass Criteria |
|------|-----------------|---------------|
| G-00 | `make check-env` in `bootstrap/` | All required env vars present |
| G-01 | `./tests/argocd-deploy/verify-sync.sh --context hub-admin` | All non-excluded Apps Synced/Healthy |
| G-02 | `./tests/run-tests.sh` | helm lint + YAML validation PASS |
| G-03 | No secrets in diff | `git diff` free of credential literals |

---

## Mega-Phase A — Foundation

**Specs**: 022 (Vault), 023 (Keycloak), 028 (Postgres), 030 (ODF), 031 (CNV), 024 (RHACM)

### Phase A1: GitOps Bootstrap

| Step | Verification | Gate |
|------|--------------|------|
| `make init-central-argo` | ArgoCD instance Running in `openshift-gitops` | App-of-apps Application exists |
| Init chart sync | `oc get applications -n openshift-gitops` | `central`, `init` Synced |

### Phase A2: Crunchy Postgres (PGO)

| Step | Verification | Gate |
|------|--------------|------|
| PGO subscription | `oc get csv -n openshift-operators \| grep crunchy` | Succeeded |
| PostgresCluster | `oc get postgrescluster -A` | Ready on the hub + services |

### Phase A3: ODF Storage

| Step | Verification | Gate |
|------|--------------|------|
| StorageCluster | `oc get storagecluster -n openshift-storage` | Ready |
| PVC provisioning | Test PVC Bound in `sovereign-cloud-jobs` | Bound |

### Phase A3b: CNV Virtualization

| Step | Verification | Gate |
|------|--------------|------|
| HyperConverged | `oc get hyperconverged -n openshift-cnv -o jsonpath='{.items[0].status.conditions[?(@.type=="Available")].status}'` | True |
| PDBs | `oc get pdb -n openshift-cnv` | virt-api-pdb, virt-controller-pdb |

### Phase A4: RHACM

| Step | Verification | Gate |
|------|--------------|------|
| ManagedCluster import | `oc get managedcluster` | Hub Available |
| GitOpsCluster | ACM console shows Imported | True |

### Phase A5–A6: Vault

| Step | Verification | Gate |
|------|--------------|------|
| Vault pods | `oc get pods -n sovereign-cloud -l app.kubernetes.io/name=vault` | Running (HA) |
| vault-init Job | `oc get job vault-init -n sovereign-cloud-jobs` | Complete |
| vault-k8s-auth Job | Completed | ClusterSecretStore `vault-backend` Ready |
| ClusterSecretStore | `oc get clustersecretstore vault-backend` | Ready=True |

### Phase A7–A8: RHBK / Keycloak

| Step | Verification | Gate |
|------|--------------|------|
| RHBK pods | `oc get pods -n <rhbk-ns>` | Running |
| keycloak-realms Job | Completed | Realm exists |
| keycloak-oauth Job | Completed | OCP OAuth client configured |
| vault-oidc-auth Job | Completed | Vault OIDC login works |

**Mega-Phase A Gate**: G-01 PASS + Vault Ready + RHBK OIDC + RHACM import + ODF Ready

---

## Mega-Phase B — Platform Services

**Specs**: 025 (ACS), 026 (AAP), 027 (Quay), 029 (Gitea), 016 (AMQ), 032 (MTV)

### Phase B1: ACS

| Step | Verification | Gate |
|------|--------------|------|
| Central deployed | ACS Central pod Running | Console accessible |
| acs-config Job | Completed | SecuredCluster on the hub |

### Phase B2: AAP Instance

| Step | Verification | Gate |
|------|--------------|------|
| AAP instance | `oc get aap -n <aap-ns>` | Successful |
| Admin API | ExternalSecret synced | API reachable |

### Phase B3: Quay

| Step | Verification | Gate |
|------|--------------|------|
| Quay app | Route accessible | TLS valid |
| quay-config Job | Completed | Org created |

### Phase B4: Gitea

| Step | Verification | Gate |
|------|--------------|------|
| Gitea pod | Running | Web UI 200 |
| gitea-init Job | Completed | Repos seeded |

### Phase B5: AMQ Streams

| Step | Verification | Gate |
|------|--------------|------|
| Topics | `hybridsovereign-events`, `hybridsovereign-audit` | Created |

### Phase B6: MTV

| Step | Verification | Gate |
|------|--------------|------|
| vmwareInit Job | Completed | Vault path `central/vmware-credentials` |
| MTV Provider | `oc get provider vmware-vcenter -n openshift-mtv` | Ready=True |
| VM inventory | Provider status | VMs listed |

**Mega-Phase B Gate**: G-01 PASS + Kafka Ready + Quay pull works + MTV Provider Ready

---

## Mega-Phase C — Operator + IAAC

**Specs**: 001–014, 033 (Unified Operator), 014 (IAAC)

### Phase C1–C2: Operator Images

| Step | Verification | Gate |
|------|--------------|------|
| Image push | Quay tags exist | primary + namespace operator |
| CRDs installed | `oc get crd \| grep hybridsovereign` | All 13+ kinds |

### Phase C3: Primary Operator

| Step | Verification | Gate |
|------|--------------|------|
| Deployment | `oc get deploy -n sovereign-cloud` | primary operator Running |
| Watches | Operator logs | Entity, RbacConfig watches active |

### Phase C4: IAAC StatefulSet

| Step | Verification | Gate |
|------|--------------|------|
| iaac pod | Running in hub | Gitea sync active |

### Phase C5–C6: Entity E2E

| Step | Verification | Gate |
|------|--------------|------|
| Entity create | `tests/functional/README.md` TC-F001 | PASS |
| Namespace operator | Spawned in entity namespace | Running |

**Mega-Phase C Gate**: G-01 PASS + TC-F001–F004 PASS + IAAC syncing

---

## Mega-Phase D — Event System


| Step | Verification | Gate |
|------|--------------|------|
| TC-F007 | Entity event on topic | PASS |
| EDA activations | Running | rulebooks consume Kafka |

**Mega-Phase D Gate**: G-01 PASS + TC-F007–F009 PASS

---

## Mega-Phase E — UI

**Specs**: 018–021

| Step | Verification | Gate |
|------|--------------|------|
| Admin dashboard | Route 200; login via OIDC | Entity list loads |
| Tenant dashboard | Scoped entity view | Cross-entity denied |
| Console plugins | Enabled in OCP console | Navigation renders |

**Mega-Phase E Gate**: G-01 PASS + dashboard smoke tests

---

## Mega-Phase F — ACM GitOps

**Spec**: 024

| Step | Verification | Gate |
|------|--------------|------|
| Policies | `oc get policy -n sovereign-cloud` | Compliant on the hub |
| Placement | Policies target hub | Applied |

**Mega-Phase F Gate**: PolicyReport compliance ≥ baseline

---

## Mega-Phase G — VM Migration

**Specs**: 009, 017, 032

| Step | Verification | Gate |
|------|--------------|------|
| Phase 1–2 | `tests/e2e/README.md` TC-E2E-001–009 | PASS |
| Phase 3 (VDDK) | TC-E2E-010–014 | **DEFERRED** |

**Mega-Phase G Gate**: Phase 1–2 PASS; Phase 3 documented deferral

---

## Mega-Phase H — AAP Config as Code

**Specs**: 026, 010

| Step | Verification | Gate |
|------|--------------|------|
| aapConfigAsCode Job | Completed | Projects/job templates seeded |
| AAPOrg CR | Reconciled | Org matches spec |

**Mega-Phase H Gate**: AAP API objects match Git-defined config

---

## Mega-Phase I — Specs + Samples

| Step | Verification | Gate |
|------|--------------|------|
| Samples | `oc apply -k samples/ --dry-run=client` | No errors |
| Specs index | 34 specs present | `specs/README.md` complete |

**Mega-Phase I Gate**: 120 samples dry-run clean

---

## Mega-Phase J — Security + Tests

| Step | Verification | Gate |
|------|--------------|------|
| Security review | `tests/security/SECURITY_REVIEW.md` | All sections PASS |
| Gap analysis | P0 gaps closed or ADR filed | GAP-001 tracked |
| Full test suite | All `tests/*/README.md` suites | Documented results |

**Mega-Phase J Gate**: Security sign-off + `./tests/run-tests.sh` PASS + G-01 PASS

---

## Rollout Commands Reference

```bash
# After each phase commit+push:
./tests/argocd-deploy/verify-sync.sh --context hub-admin

# Hard refresh stale app:
oc annotate application <app> -n openshift-gitops \
  argocd.argoproj.io/refresh=hard --overwrite

# Full automated pre-merge check:
./tests/run-tests.sh
```

## Gate Escalation

| Severity | Condition | Action |
|----------|-----------|--------|
| P0 | Secret in Git, ArgoCD OutOfSync >30 min | Stop rollout; rotate creds |
| P1 | Application Degraded | Check pod logs; delete failed Job for recreate |
| P2 | Manual test SKIP | Document in test report; schedule remediation |
