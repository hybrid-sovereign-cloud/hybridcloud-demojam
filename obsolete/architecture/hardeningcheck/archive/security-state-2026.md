# Security State Assessment — Hybrid Sovereign Cloud

**Date:** 2026-06-16  
**Assessor:** Security Analyst (automated + cluster read-only review)  
**Scope:** Central + Services clusters, platform operators, EDA, Vault/ESO, dashboards, Keycloak  
**Baseline:** 23 files in `architecture/hardeningcheck/` (prior assessment v0.11.0, 2026-05-14)

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| **Overall risk rating** | **Medium** |
| **Clusters reviewed** | Central (`central-admin`), Services (`services-admin`) |
| **Operators reviewed** | Entity, Team, Assignment, Persona, plugin-rbac, plugin-vault, plugin-aap, plugin-quay |
| **ExternalSecrets (services)** | 22 resources — all `SecretSynced` / `Ready=True` |
| **PushSecrets (services)** | 4 resources — all `Synced` |
| **Critical findings** | 0 |
| **High findings** | 4 |
| **Medium findings** | 9 |
| **Low findings** | 6 |

The platform demonstrates strong GitOps discipline, Vault-centric secret delivery, and scoped operator ClusterRoles. Residual risk concentrates in **cluster-admin bindings** (`sovereign-admin`, `argocd-manager`), **EDA cross-cluster writes via ArgoCD cluster-admin token**, **missing NetworkPolicies in sovereign workload namespaces**, and **Vault operational gaps** (root token storage, no audit device, HTTP inter-pod comms).

---

## 2. RBAC Analysis Table

| Component | Namespace | ClusterRole Scope | cluster-admin? | Least-Privilege Gaps |
|---|---|---|---|---|
| entity-operator | sovereign-cloud | ClusterRole: entities, namespaces (RO), events, configmaps, leases, SAR | No | No roles/rolebindings verbs — namespace RBAC now delegated to EDA (see SEC-008). Hardening doc outdated. |
| team-operator | sovereign-cloud | ClusterRole: teams CRUD, namespaces (RO), events, configmaps, leases | No | None significant |
| assignment-operator | sovereign-cloud | ClusterRole: assignments patch/update, namespaces (RO), events, leases | No | None significant |
| persona-operator | sovereign-cloud | ClusterRole: personas CRUD, rbacs (RO), events, configmaps, leases | No | None significant |
| plugin-rbac | sovereign-cloud-plugins | ClusterRole: rbacconfigs/rbacs CRUD, namespaces (RO), events, configmaps, leases | No | Hardening doc references externalsecrets — not in deployed ClusterRole (secrets via Vault API, not k8s) |
| plugin-vault | sovereign-cloud-plugins | ClusterRole: vaults/vaultkvs CRUD, namespaces (RO), events, configmaps, leases | No | None significant |
| plugin-aap | sovereign-cloud-plugins | ClusterRole: aapconfigs/aaporgs CRUD, rbacs/rbacconfigs (RO), namespaces (RO) | No | None significant |
| plugin-quay | sovereign-cloud-plugins | ClusterRole: quayconfigs/quayorgs CRUD, rbacs/rbacconfigs (RO), namespaces (RO) | No | None significant |
| sovereign-cloud-dashboard | sovereign-cloud | ClusterRole: entities create/delete cluster-wide; impersonate users/groups/SAs | No | SA can create/delete Entity CRs cluster-wide; mitigated by oauth-proxy user-token passthrough for API calls |
| tenancy-dashboard | sovereign-cloud | ClusterRole: rbacs/rbacconfigs/teams/etc. create/delete; impersonate | No | Same pattern as user dashboard — user token required for mutations |
| event-forwarder | sovereign-cloud-plugins | ClusterRole: events (RO), namespaces (RO) | No | No NetworkPolicy (SEC-005) |
| argocd-manager (SA) | kube-system | **cluster-admin** binding | **Yes** | Required for central ArgoCD remote management; long-lived token |
| sovereign-admin (Group) | cluster-wide | **cluster-admin** binding | **Yes** | Platform admin group — must be replaced with granular roles before production |
| EDA provision roles | central AAP EE | Uses `argocd-cluster-services` bearer token | **Effective cluster-admin** | Cross-cluster namespace/role creation, CR status patches (SEC-003) |

**Operator RBAC audit result:** No wildcard (`*`) verbs on sensitive resources in operator Helm ClusterRoles. No missing `resourceNames` on cluster-scoped secrets access — operators do not read k8s Secrets directly (Vault/ESO pattern). All `hybridsovereign.redhat` operators correctly deployed on services cluster.

---

## 3. Secrets Flow Status

### Working paths (Vault → ESO → Pod)

| Path | Cluster | ExternalSecret | Status |
|---|---|---|---|
| `central/data/oci-credentials` → quay-pull-secret | Both | Multiple namespaces | SecretSynced |
| `central/data/rhbk-services-admin` → rhbk-services-admin | Services | sovereign-cloud-plugins | SecretSynced |
| `central/data/aap-admin` → aap-admin-credentials | Services | sovereign-cloud-plugins | SecretSynced |
| `central/data/quay-admin` → quay-admin-credentials | Services | sovereign-cloud-plugins | SecretSynced |
| `central/data/event-forwarder` → event-forwarder-token | Services | sovereign-cloud-plugins | SecretSynced |
| `central/data/gitea-admin` → gitea-admin-token | Services | sovereign-cloud-plugins | SecretSynced |
| Dashboard OAuth clients | Services | sovereign-cloud | SecretSynced |
| AWS creds (entity) | Services | sovereign-cloud (eda-cloudaws-ses10-env-aws-creds) | SecretSynced (1m refresh) |

### PushSecret paths (working)

| PushSecret | Namespace | Status |
|---|---|---|
| push-keycloak-admin-rhbk-services | services-rhbk | Synced |
| push-vault-services-init-secrets | services-vault | Synced |
| push-eda-s3-logs-creds | openshift-storage | Synced |

### ClusterSecretStore

| Cluster | Store | Auth | Ready |
|---|---|---|---|
| Central | vault-backend | Kubernetes auth | Valid / ReadWrite |
| Services | vault-backend | Kubernetes auth (cross-cluster to vault-central) | Valid / ReadWrite |

### Gaps

| Gap | Severity | Notes |
|---|---|---|
| Root token in `vault-init-secrets` K8s Secret | High | vault-central namespace; used for init only but persistent |
| No Vault audit device | Medium | Required for compliance (SEC-006) |
| EDA reads `argocd-cluster-services` from central openshift-gitops | High | Token grants cluster-admin on services (SEC-003) |
| `entity_provision` k8s_info for ArgoCD secret lacks `no_log` | Low | Register may appear in verbose Ansible output (SEC-009) |
| `patch_cr_status.yml` runs with `no_log: false` | Medium | CR_TOKEN in process environment may leak in AAP job output (SEC-010) |

---

## 4. Network Policy Coverage

### Namespaces WITH policies (selected)

| Namespace | Cluster | Policy |
|---|---|---|
| services-rhbk | Services | rhbk-services-network-policy |
| services-vault | Services | vault-services-agent-injector |
| central-vault | Central | vault-agent-injector |
| central-rhbk | Central | rhbk-central-network-policy |
| gitea | Central | gitea-valkey-cluster |
| openshift-gitops | Both | ArgoCD component policies |

### Sovereign workload namespaces WITHOUT NetworkPolicy

| Namespace | Cluster | Risk |
|---|---|---|
| sovereign-cloud | Services | **Medium** — all operator pods + dashboards; no egress/ingress restriction |
| sovereign-cloud-plugins | Services | **Medium** — plugin operators + event-forwarder |
| sovereign-cloud-jobs | Services | Medium |
| sovereign-cloud-helpers | Services | Low |
| services-quay | Services | Medium |

OpenShift platform namespaces have default-deny baselines; sovereign workload namespaces rely on OpenShift SDN defaults (permissive within project).

---

## 5. TLS Coverage

| Endpoint | Host | Termination | Notes |
|---|---|---|---|
| sovereign-cloud-dashboard | `sovereign-cloud-dashboard-sovereign-cloud.apps.services.lab.example.com` | reencrypt | PASS |
| tenancy-dashboard | `tenancy-dashboard-sovereign-cloud.apps.services.lab.example.com` | reencrypt | PASS |
| rhbk-services (Keycloak) | `rhbk-services.apps.services.lab.example.com` | edge | External TLS; internal pod-to-pod HTTP |
| rhbk-central (Keycloak) | `rhbk-central.apps.central.lab.example.com` | edge | Same pattern |
| vault-central route | edge TLS | PASS for external |
| Vault inter-pod (Raft) | HTTP | REVIEW — network policy partially mitigates |
| Gitea route | HTTP only (per prior assessment) | WARN |
| EDA cross-cluster API calls | `validate_certs: false` | Medium — MITM within cluster boundary |

---

## 6. Token / ServiceAccount Exposure

| SA / Token | Namespace | Privilege | Scope | Notes |
|---|---|---|---|---|
| argocd-manager | kube-system (services) | cluster-admin | Entire services cluster | ArgoCD remote cluster registration |
| openshift-gitops-argocd-application-controller | openshift-gitops (central) | cluster-admin | Central cluster | Standard GitOps pattern |
| argocd-cluster-services (Secret) | openshift-gitops (central) | cluster-admin bearer | Services cluster API | Read by EDA decision environments at runtime |
| entity-operator | sovereign-cloud | Scoped ClusterRole | CR + events | Cannot create roles (EDA handles) |
| sovereign-cloud-dashboard | sovereign-cloud | ClusterRole + auth-delegator | Impersonation + entity CRUD | OAuth proxy enforces user identity |
| event-forwarder | sovereign-cloud-plugins | events/namespaces RO | Watch-only | Appropriate scope |
| sovereign-admin (OIDC group) | cluster-wide | cluster-admin | Human platform admins | Production must narrow |

---

## 7. Keycloak RBAC Validation Test

**Date:** 2026-06-16  
**Realm:** sovereign-tenants  
**Endpoint:** `https://rhbk-services.apps.services.lab.example.com`

| Step | Result |
|---|---|
| Admin token (master realm, admin-cli) | PASS — obtained via ExternalSecret-sourced credentials |
| Create user `security-test-user` | HTTP 201 |
| Verify user exists | PASS |
| Delete user `security-test-user` | HTTP 204 |
| Post-delete verification | 0 users matching username |

**Conclusion:** Keycloak Admin REST API is reachable and functional. Admin credentials flow (Vault → PushSecret → ExternalSecret → operator) is operational. No test users remain in the realm.

---

## 8. Findings Table

| ID | Severity | Component | Description | Remediation |
|---|---|---|---|---|
| SEC-001 | High | RBAC / Keycloak-OIDC | `sovereign-admin` Keycloak group bound to `cluster-admin` via `sovereign-admin-cluster-admin` ClusterRoleBinding | Create granular ClusterRoles per platform function; bind sovereign-admin to aggregated admin role with explicit resource scope |
| SEC-002 | High | ArgoCD / Services cluster | `argocd-manager` SA has cluster-admin on services cluster | Accept for lab; production: evaluate ArgoCD custom cluster roles with namespace-scoped permissions where possible |
| SEC-003 | High | EDA / Cross-cluster | EDA roles read `argocd-cluster-services` bearer token (cluster-admin) to mutate services cluster | Scope ArgoCD cluster registration to a dedicated SA with custom ClusterRole (namespaces, roles, rolebindings, hybridsovereign CRs status only) |
| SEC-004 | High | Vault | Root token persisted in `vault-init-secrets` K8s Secret in central-vault | Revoke root after init; use periodic tokens; enable auto-unseal |
| SEC-005 | Medium | NetworkPolicy | No NetworkPolicy in sovereign-cloud, sovereign-cloud-plugins, sovereign-cloud-jobs | Add deny-all baseline + explicit allow for ingress from router, egress to API server, Vault, Keycloak, Quay |
| SEC-006 | Medium | Vault | Audit logging device not enabled | Enable file or syslog audit device on vault-central |
| SEC-007 | Medium | Vault | HTTP between Raft peers (TLS termination at route only) | Enable Vault listener TLS; restrict with NetworkPolicy until mTLS configured |
| SEC-008 | Medium | Documentation / Entity operator | Hardening doc claims entity-operator creates namespace Roles; deployed ClusterRole lacks rbac.authorization.k8s.io rules; EDA `entity_provision` performs this via cluster-admin token | Update hardening docs; reduce EDA token scope (see SEC-003) |
| SEC-009 | Low | EDA / entity_provision | `Read services cluster API secret` task missing `no_log: true` | Add `no_log: true` to k8s_info task reading argocd-cluster-services |
| SEC-010 | Medium | EDA / patch_cr_status | `patch_cr_status.yml` sets `no_log: false`; CR_TOKEN passed as environment variable to python3 subprocess | Set `no_log: true` on command task; redact token from debug output |
| SEC-011 | Medium | EDA / Cross-cluster TLS | All EDA cross-cluster `kubernetes.core.k8s_*` calls use `validate_certs: false` | Store CA bundle in argocd-cluster-services or dedicated Secret; enable cert validation |
| SEC-012 | Medium | event-forwarder | No NetworkPolicy; deployment lacks explicit `securityContext` (runAsNonRoot, seccompProfile) | Add chart templates per hardeningcheck/006-platform-eda-rebuild.md deviations |
| SEC-013 | Low | Supply chain | No Cosign chart signing or SBOM generation | Implement in `make upload-*` targets |
| SEC-014 | Low | Keycloak | Dev-mode HTTP internal comms; embedded DB on lab clusters | Production: PostgreSQL backend + strict TLS |
| SEC-015 | Low | Gitea | HTTP route without TLS termination | Configure edge/reencrypt route |
| SEC-016 | Low | CIS | Pod Security Admission not enforced `restricted` in sovereign namespaces | Apply PSA labels to sovereign-* namespaces |
| SEC-017 | Info | Operator health | cloudoso-operator and persona-operator pods in ContainerStatusUnknown state | Investigate node/eviction issues — availability, not direct security flaw |

---

## 9. Cluster Snapshot (2026-06-16)

### Services cluster — sovereign-cloud pods (selected)

| Pod | Status |
|---|---|
| entity-operator-controller-manager | Running |
| team/assignment/project/platformopenshift operators | Running |
| sovereign-cloud-dashboard | Running (2/2) |
| tenancy-dashboard | Running (2/2) |
| cloudoso-operator | Mixed (1 Running, 5 ContainerStatusUnknown) |
| persona-operator | Mixed (1 Running, 4 ContainerStatusUnknown) |

### Services cluster — sovereign-cloud-plugins pods

All plugin operators + event-forwarder: Running.

### Central cluster

| Component | Status |
|---|---|
| openshift-gitops (all controllers) | Running |
| vault-0/1/2 (central-vault) | Running |
| sovereign-aap namespace | No pods listed (may be disabled or empty) |

---

## 10. References

- Prior assessment: `architecture/hardeningcheck/security-assessment.md` (v0.11.0)
- Secrets flow: `architecture/docs/technical/18-secrets-flow.md`
- Security interaction diagrams: `architecture/docs/technical/50-security-interaction-diagrams.md`
- EDA hardening: `architecture/hardeningcheck/006-platform-eda-rebuild.md`

## 2026-06-16 OAuth Fix

### Finding: External RHBK dependency (CRITICAL — resolved)
- **Before**: Both clusters used `https://login.home.example.com/realms/Signal9-RHT` (external Signal9 RHBK)
- **After**:
  - Central cluster → `rhbk-central.apps.central.lab.example.com/realms/sovereign-central` (client: `openshift-central`)
  - Services cluster → `rhbk-services.apps.services.lab.example.com/realms/sso` (client: `openshift-services`)
- **Remediation**: 
  1. `job-keycloak-oauth` (ArgoCD Sync hook) updated both OAuth cluster CRs via `keycloak-oauth.yml` playbook
  2. Added `oauth.yaml` template to `sovereign-namespaces` chart v0.2.7 to manage `OAuth cluster` CR as a self-healing ArgoCD resource
  3. This prevents `base-config-chart` (external repo) from reverting to the Signal9 IDP on future syncs
