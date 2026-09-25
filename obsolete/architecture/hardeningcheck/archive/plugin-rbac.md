# Hardening Check — Plugin RBAC Operator

**Chart:** `plugin_rbac/helm`
**Cluster:** Services (deployed by central ArgoCD)
**Namespace:** `sovereign-cloud-plugins`
**Last reviewed:** 2026-05-22 (refactorrbac v1.0)

## Checks

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application uses `servicesCluster.server` |
| Runs in sovereign-cloud-plugins namespace | PASS | `destinationNamespace: sovereign-cloud-plugins` |
| Uses ClusterRole (not cluster-admin) | PASS | Scoped to namespaces, events, rbacconfigs, rbacs, externalsecrets, leases |
| Image pull secret uses shared robot | PASS | `quay-pull-secret` (not operator-specific) |
| Non-root container | PASS | `runAsNonRoot: true`, `seccompProfile: RuntimeDefault` |
| No privilege escalation | PASS | `allowPrivilegeEscalation: false`, all capabilities dropped |
| Health probes configured | PASS | Liveness + readiness on port 6789 |
| Resource limits set | PASS | Defined in values.yaml |
| Leader election enabled | PASS | `--leader-elect` flag |
| Finalizer for cleanup | PASS | RbacConfig and Rbac finalizers registered |
| Kubernetes Events emitted | PASS | Reconciliation events via events.k8s.io/v1 |
| No oc exec used | PASS | All operations via Kubernetes API + Keycloak REST |
| API group placement rule | PASS | `hybridsovereign.redhat` on services cluster |
| Keycloak admin creds from Vault | PASS | ExternalSecret delivers `rhbk-services-admin` from Vault |
| No hardcoded secrets | PASS | All secrets via Vault/ESO |
| Keycloak client confidential | PASS | Creates confidential OIDC clients (not public) |
| Service account roles scoped | PASS | Only `manage-users`, `manage-clients`, `manage-realm`, `view-users` assigned |
| Group attributes populated | PASS | Entity, billing-id, creator, config, namespace set as group attributes |
| Creator tracking | PASS | `hybridsovereign.redhat/creator` annotation captured and stored |
| validate_certs: false for internal | NOTE | Keycloak internal URL uses HTTP (in-cluster); no TLS needed for pod-to-pod |
| **no_log on all b64decode / token tasks** | **PASS** | Added `no_log: true` to rbac, rbac_finalizer credential decode + token obtain tasks |
| **Keycloak client secret in Vault** | **PASS** | rbacconfig now writes to `central/plugin-rbac/<name>` via direct Vault API write + ExternalSecret |
| **No direct K8s Secret creation** | **PASS** | Replaced direct `kind: Secret` create with ExternalSecret in rbacconfig role |
| **Vault KV cleanup on delete** | **PASS** | rbacconfig_finalizer now deletes `central/metadata/plugin-rbac/<name>` on CR deletion |
| **Parent Keycloak group cleanup** | **PASS** | rbac_finalizer deletes parent entity group when last sibling Rbac CR is removed |

## Scale Recommendations

> **Target scale**: 10,000+ Rbac CRs per entity, 40+ entities concurrently

| Recommendation | Detail |
|---|---|
| Operator replicas | Set `replicas: 2` in production (active/standby via leader election) |
| CPU/memory headroom | Increase limits to `cpu: 2000m, memory: 4Gi` for large entities |
| Async reconciliation | Ansible roles use `async`/`poll:0` dispatch for Keycloak lookups — O(n) concurrency |
| Keycloak group cache | K8s API calls cached by kube-apiserver; operator-level cache via `k8s_info` reduces Keycloak API pressure |
| RbacConfig token reuse | Token obtained once per reconcile cycle, not per-Rbac-CR — reduces Keycloak token endpoint load |
| Stagger entity onboarding | For initial bulk import (40+ entities × 10k CRs), stagger entity creation 30s apart to avoid Keycloak rate limits |
| Keycloak group query | Use `group-by-path` endpoint (O(1)) rather than full group list scan (O(n)) — already implemented |
| Parent group check | `k8s_info` for sibling count uses API server cache — single call per delete, not per-sibling scan |

## Known Deviations

| ID | Description | Severity | Remediation / Target |
|---|---|---|---|
| D-01 | `rbacconfig/tasks/main.yml` previously created direct K8s Secret for client credentials | **FIXED** | Replaced with Vault write + ExternalSecret (refactorrbac) |
| D-02 | rbacconfig_finalizer did not clean up Vault KV on CR deletion | **FIXED** | Added Vault metadata DELETE in rbacconfig_finalizer (refactorrbac) |
| D-03 | Missing `no_log` on token obtain + b64decode in rbac and rbac_finalizer roles | **FIXED** | Added `no_log: true` to all credential and token tasks (refactorrbac) |
