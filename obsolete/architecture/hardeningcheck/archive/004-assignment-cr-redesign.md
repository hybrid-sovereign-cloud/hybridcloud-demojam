# Hardening Checklist: 004-assignment-cr-redesign

**Feature**: Assignment CR Redesign — ACM Policy Model  
**Date**: 2026-05-23

---

## SA Least-Privilege

- [x] `assignment-acm-creator` Role is **namespaced** (not ClusterRole) scoped to `sovereign-cloud-helpers`
- [x] Role verbs cover only Policy/PlacementBinding (policy.open-cluster-management.io) and Placement/ManagedClusterSetBinding (cluster.open-cluster-management.io)
- [x] No wildcard (`*`) verbs or resources in the Role
- [x] SA token delivered exclusively via PushSecret → Vault → ExternalSecret (never in Git)
- [x] `kubernetes.io/service-account-token` long-lived token is acceptable: stored only in Vault, never in Git

## No Secrets in Git

- [x] No credentials, tokens, or CA certificates committed to any repository
- [x] SA token path in Vault: `central/assignment-acm-creator` (token + ca.crt)
- [x] All `no_log: true` applied to tasks handling `acm_central_token` and `acm_central_ca`
- [x] Temp CA file written to `/tmp/` with `mode: '0600'` and cleaned up after use

## Ansible Hardening

- [x] `no_log: true` on all tasks that decode SA token or CA cert
- [x] Temp files (`/tmp/assignment-acm-central-ca.crt`) removed in cleanup tasks
- [x] `ignore_errors: true` on cleanup tasks only (not provisioning tasks)
- [x] ACM REST calls use `validate_certs: true` and `ca_path`
- [x] `assignment_delete` reads token from ExternalSecret (not from status)

## ArgoCD and GitOps

- [x] `assignment-central-rbac` chart deployed via ArgoCD to central cluster (central ArgoCD project)
- [x] No `oc apply` or direct resource creation — all changes via Git → ArgoCD
- [x] `assignmentOperator` ArgoCD Application updated to `chartVersion: 0.5.0`

## sovereign-assignment Chart Hardening

- [x] ArgoCD instance is **namespace-scoped** (not cluster-scoped) — restricted to team namespaces
- [x] ArgoCD AppProject `spec.destinations` restricts deployments to project namespaces only
- [x] ArgoCD SA RoleBindings only cover declared project namespaces
- [x] `ServiceMeshControlPlane` deployed in a dedicated `<entity>-<team>-istio` namespace (tenant isolation)
- [x] RBAC RoleBindings use `kind: Group` (not User) — Keycloak group membership controls access
- [x] All RBAC templates are conditional — missing toolRbac group leaves namespace without binding

## ACM Policy Delete Flow

- [x] Delete is two-phase: mustnothave patch (wait 60s) → delete Policy/Placement/PlacementBinding
- [x] `status.acmPolicyName` drives delete — no orphaned policies if CR is re-created
- [x] PlacementBinding deleted before Placement (correct teardown order)
- [x] All delete HTTP calls use `status_code: [200, 202, 404]` — idempotent on 404

## Deviations from Best Practice

| Deviation | Why | Where | Remediation / Production Target |
|-----------|-----|-------|----------------------------------|
| Long-lived SA token (`kubernetes.io/service-account-token`) | ESO PushSecret requires a stable readable Secret; pod-bound tokens are not suitable | `assignment-central-rbac/templates/sa-token-secret.yaml` | Consider rotating via re-creation of the token Secret when ESO supports bound token push natively |
| `helm pull` inside operator pod at reconcile time | `sovereign-assignment` chart must be templated at runtime with dynamic values (entity, team, projects) | `provision_acm.yml` | Pre-cache chart in operator image if OCI registry connectivity becomes a concern |
| 60s hardcoded wait in delete flow | ACM enforcement latency is environment-dependent | `assignment_delete/tasks/main.yml` | Add readiness polling loop checking Policy compliance status before deleting |
