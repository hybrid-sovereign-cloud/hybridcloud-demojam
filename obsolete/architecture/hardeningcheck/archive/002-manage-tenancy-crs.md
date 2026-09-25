# Hardening Check: 002-manage-tenancy-crs

## Summary

Feature: Manage Tenancy CRs — standardized status lifecycle, per-CR RBAC, metrics, Gitea sync, delete flows.

| Check | Status | Notes |
|-------|--------|-------|
| Per-CR RBAC isolation verified | PASS | Team, Project, PlatformOpenshift create isolated Role+RoleBinding per CR |
| Vault OIDC client cleanup verified | PASS | vault_finalizer deletes Keycloak OIDC client on Vault CR deletion |
| No secrets in logs | PASS | Credential decode tasks have `no_log: true`; uri basic-auth not logged by Ansible |
| All credential tasks have no_log | PASS | vault_finalizer:75-76, aaporg:48+54, quayorg secret decode task |
| Delete flows tested | PASS | Team, Project, VaultKV, AAPOrg, QuayOrg, PlatformOpenshift(OSO), CloudOSO all clean |
| CloudAWS/PlatformOpenshift(AWS) delete deferred | DEFERRED | See DEV-001 in deviations.md |
| No secrets committed to git | PASS | `git log` audit found no credentials in committed files |
| ExternalSecret for all secret delivery | PASS | No direct K8s Secret creation in any chart |
| Least-privilege RBAC | PASS | ClusterRoles grant only necessary verbs; per-CR Roles scoped to single resource |
| Idempotent cloud/DNS mutations | PASS | All operators use `state: present` k8s module and API PUT/upsert patterns |
| `no_log` on cloud credential tasks | PASS | cloudoso/cloudaws use `no_log: true` on OpenStack/AWS token decode tasks |
| CR status fields in CRD schema | PASS | All operators have status/lastReconciledAt/message in openAPIV3Schema |
| Prometheus metrics for all operators | PASS | ServiceMonitor and PrometheusRule templates in all operator Helm charts |
| Gitea sync (plugin_iaac) | PASS | All CR YAMLs synced to tenancy_repo; verified clean repo with all CR types |
| Owner reference cleanup (Project) | PASS | Project per-CR Roles/RoleBindings cleaned via GC within 30s of CR deletion |
| Finalizer-based cleanup (Team) | PASS | Label-selector deletion in team_delete cleans all per-group RoleBindings |

## Remaining Gaps

1. **CloudAWS/PlatformOpenshift(AWS) delete not tested** — See DEV-001. Remediation:
   test in a maintenance window; AWS resource cleanup via Hive is longer cycle.

2. **Project operator lacks formal finalizer** — Uses owner reference GC (DEV-002).
   Sufficient for current resource scope. Add `project_delete` role if cross-namespace
   resources are introduced in future phases.

3. **AAP org deletion not verified against AAP API** — `acme-test-aap` CR was deleted
   and the CR is gone (finalizer ran), but AAP API state for the deleted org was not
   explicitly queried. The `aaporg_finalizer` role calls the AAP DELETE endpoint; a future
   hardening pass should query the AAP API to confirm org absence.

## Test Evidence

- `test-delete-team` deleted → `test-delete-team-team-viewer` Role+RoleBinding absent within 30s
- `test-delete-project` deleted → `project-test-delete-project-viewer` Role+RoleBinding absent within 30s
- `ocp-ses8` deleted → OSOHelper `ocp-ses8` absent from central cluster (ProvisionStopped cleanup)
- `ocp-ses9` deleted → OSOHelper `ocp-ses9` absent from central cluster (running cluster decommission)
- `ses8-env` CloudOSO deleted → OSOHelper `ses8-env` absent from central cluster after 60s
- `acme-test-kv` VaultKV deleted → CR gone, finalizer ran (changed=3 in pre-delete reconcile)
- `acme-test-aap` AAPOrg deleted → CR gone, finalizer ran
- `acme-test-quay` QuayOrg deleted → CR gone, finalizer ran
