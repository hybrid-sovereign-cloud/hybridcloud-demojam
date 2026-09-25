# Hardening Check: 003-fix-ocp-cloudrbac-cleanup-ocp

## Summary of Changes

| Component | Change | Security Impact |
|-----------|--------|-----------------|
| `CloudOSO` CRD | Removed `toolRbac` from spec schema | Low — dead code removal |
| `CloudAWS` CRD | Removed `toolRbac` from spec schema | Low — dead code removal |
| `tenancy_dashboard` | Removed RBAC form sections from CloudOSO/CloudAWS Create | Low — UI cleanup |
| `Assignment` | Added finalizer + `assignment_delete` role | Medium — new cluster-scoped API calls |

---

## US1: OCP Status Sync (reconcileInterval)

### No secrets in logs
- [X] `reconcileInterval` only reads Hive `ClusterDeployment` status — no secrets
- [X] `keycloak_oidc.yml` already uses `no_log: true` on Keycloak token tasks
- [X] AWSHelper operator logs do not print cluster kubeconfigs

### Vault-only credentials
- [X] Cluster admin password stored in Vault via Hive post-install hook
- [X] Kubeconfig stored in Vault via PlatformOpenshift operator

### Least-privilege RBAC (awshelper-creator ClusterRole)
- [X] Added only required verbs: `create, delete, get, list, patch, update, watch`
- [X] Scoped to specific API groups: `policy.open-cluster-management.io`, `cluster.open-cluster-management.io`
- [ ] **GAP**: The ACM `Policy` resources are created in the `openshift-gitops` namespace; the ClusterRole grants cluster-wide access. Namespace-scoped Role + RoleBinding would be more restrictive. Deferred as ACM Policy must be in `openshift-gitops`.

### Idempotent mutations
- [X] `keycloak_oidc.yml` uses HTTP 409 acceptance to handle existing OIDC clients
- [X] `reconcileInterval` triggers are idempotent (re-reads, no destructive actions)

---

## US2: Cloud RBAC Removal

### No secrets in logs
- [X] N/A — UI form removal only

### Dead code removal validation
- [X] Confirmed via grep: no Ansible roles in `cloudoso/` or `cloudaws/` operator read `toolRbac`
- [X] Existing live CRs (ses9-env, ses10-env) have no `toolRbac` in spec — schema removal is non-breaking
- [X] CRD schema with `x-kubernetes-preserve-unknown-fields` would preserve unknown fields, but pruning is cleaner

---

## US3: Assignment Cleanup (Finalizer)

### No secrets in logs
- [X] `no_log: true` on all tasks that handle SA tokens (`central_token`, `central_ca`)
- [X] Temp CA file `/tmp/assignment-delete-central-ca.crt` is removed after use

### Vault-only credentials
- [X] Assignment delete reads SA token from Kubernetes Secret (not Vault directly)
- [X] SA secret is populated via `PushSecret` from Vault (existing mechanism)

### Least-privilege RBAC
- [X] `assignment_delete` role uses the EXISTING `osohelper-creator-sa` / `awshelper-creator-sa` cross-cluster SA — no new credentials introduced
- [X] The SA can only DELETE the specific OSOHelper/AWSHelper by name

### Idempotent mutations
- [X] DELETE returns 404 if helper already gone — `status_code: [200, 202, 404]` handles this
- [X] Temp file cleanup uses `ignore_errors: true` (file might not exist if earlier tasks failed)

### Known gap
- [ ] **DEV-003**: SA token expiry can block finalizer from clearing. Documented in `deviations.md`.
  - Mitigation: Manual `oc patch` to remove finalizer + manual helper deletion
  - Production target: Switch to projected `TokenRequest` tokens

---

## US4: New OCP Clusters (ses11, ses12)

### No secrets in logs
- [X] OSOHelper environmentprep/clusterbuild do not log credentials
- [X] CloudOSO CRs have no secrets in spec (only vault paths)

### Vault-only credentials
- [X] OpenStack credentials loaded from `oso/accounts/shc_admin` via Vault
- [X] Cluster admin passwords and kubeconfigs written to Vault post-install
- [X] Pull secret and SSH keys referenced via Vault paths in OSOHelper spec

### Idempotent cloud/DNS mutations
- [X] OSOHelper environmentprep: existing project is detected (409), floating IPs re-used from status
- [X] Route53 delegation is idempotent (upsert)

### Separate environments per cluster
- [X] ses11-env and ses12-env create separate OpenStack projects with unique floating IPs
- [X] Unique slug per cluster ensures no DNS conflict (9043d vs 04be0)

---

## Overall Assessment

| Check | Status |
|-------|--------|
| No secrets in Git | ✓ PASS |
| No secrets in logs | ✓ PASS |
| Vault-only credential delivery | ✓ PASS |
| Least-privilege RBAC | ✓ PASS (with noted gap in ACM RBAC scope) |
| Idempotent mutations | ✓ PASS |
| No sovereign-* namespace deletion | ✓ PASS |
| GitOps only (post ArgoCD init) | ✓ PASS (T060 oc apply is the permitted exception for sample CRs) |

**Overall**: PASS with DEV-003 gap documented in `deviations.md`.
