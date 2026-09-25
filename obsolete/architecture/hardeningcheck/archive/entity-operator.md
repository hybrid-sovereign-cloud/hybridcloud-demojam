# Hardening Check — Entity Operator

**Chart:** `Entity/helm`
**Cluster:** Services (deployed by central ArgoCD)
**Namespace:** `sovereign-cloud`
**Last reviewed:** 2026-05-22 (refactorrbac v1.0)

## Checks

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application uses `servicesCluster.server` |
| Runs in sovereign-cloud namespace | PASS | `destinationNamespace: sovereign-cloud` |
| Uses ClusterRole (not cluster-admin) | PASS | Scoped to namespaces, events, entities, roles, rolebindings, configmaps, leases |
| Image pull secret uses shared robot | PASS | `quay-pull-secret` (not operator-specific) |
| Non-root container | PASS | `runAsNonRoot: true`, `seccompProfile: RuntimeDefault` |
| No privilege escalation | PASS | `allowPrivilegeEscalation: false`, all capabilities dropped |
| Health probes configured | PASS | Liveness + readiness on port 6789 |
| Resource limits set | PASS | Defined in values.yaml |
| Leader election enabled | PASS | `--leader-elect` flag |
| Finalizer for cleanup | PASS | Deletes provisioned namespace on Entity CR deletion |
| Kubernetes Events emitted | PASS | Create, Update, Delete events via events.k8s.io/v1 |
| No oc exec used | PASS | All operations via Kubernetes API |
| API group placement rule | PASS | `hybridsovereign.redhat` → services cluster |
| **14-role RBAC matrix** | **PASS** | `namespace_roles.yml` creates K8s Roles + RoleBindings for all 14 named roles |
| **No secrets handled** | **PASS** | Entity operator never touches secrets — no `no_log` needed |
| **Async Rbac lookups** | **PASS** | `async`/`poll:0` dispatch for all Rbac CR group-path lookups — scales to 10k+ CRs/entity |

## Scale Recommendations

> **Target scale**: 40+ entities, 10,000+ Rbac CRs per entity namespace

| Recommendation | Detail |
|---|---|
| Operator replicas | Set `replicas: 2` in production (active/standby via leader election) |
| CPU/memory headroom | `cpu: 1000m, memory: 2Gi` limits for large tenants |
| Async Rbac resolution | All Rbac CR name → group-path lookups dispatched with `async: 30, poll: 0` concurrently; collected with single `async_status` pass — O(1) blocking time regardless of CR count |
| K8s API cache | `k8s_info` reads hit kube-apiserver cache; recommend setting `--max-concurrent-reconciles 8` on the operator pod for parallel entity processing |
| Role creation | Idempotent `kubernetes.core.k8s state: present` calls — safe to re-run; server-side apply minimizes diff traffic |
| Bulk entity bootstrap | Pre-create entity namespaces with labels before applying Entity CRs to reduce reconcile backlog |
| watchdog | Enable `--watches-file` reconcile period of 5m to catch Rbac status updates without blocking |

## Known Deviations

| ID | Description | Severity | Remediation / Target |
|---|---|---|---|
| D-04 | Old `namespace_rbac.yml` used `creators`/`viewers` flat model — no named roles | **FIXED** | Replaced with `namespace_roles.yml` + 14-role var matrix (refactorrbac) |
| D-05 | Old sample CRs used old `creators`/`viewers` schema | **FIXED** | All three sample CRs updated to 14-role schema (refactorrbac) |
