# Security Assessment — Sovereign Cloud Bootstrap

**Version:** 0.11.0  
**Date:** 2026-05-14  
**Scope:** `bootstrap/` repository — Makefile, Helm charts, Ansible roles, container images, platform operators

---

## 1. Threat Model Summary

| Asset | Threat | Mitigation |
|---|---|---|
| Cluster API credentials | Exfiltration via logs | Env vars only; never written to files |
| Git token | Repo takeover | Short-lived PAT; passed via `--set` |
| OCI robot password | Chart supply-chain attack | Robot has read-only access; admin token for push |
| ArgoCD git secret | Credential leakage | Labeled secret; encrypted at rest via etcd |
| RHACM MultiClusterHub | Privilege escalation | SingleNamespace OperatorGroup; console+search+lifecycle only |
| Keycloak client secrets | Token theft | Stored in Vault KV `central/keycloak-clients` |
| Vault unseal keys | Full compromise | Kubernetes Secret `vault-init-secrets` in `vault` ns |
| Gitea admin token | Repo manipulation | Generated per-session; stored in Vault |
| Ansible runner image | Supply-chain compromise | Base from registry.redhat.io; pinned tag |
| Services cluster SA token | Lateral movement | Dedicated SA (`argocd-manager`); long-lived but scoped |

---

## 2. Hardening Checks

### 2.1 Secret Handling

| Check | Status | Notes |
|---|---|---|
| No secrets hardcoded in charts | PASS | All credential fields default to `""` |
| No secrets committed in Git | PASS | `.gitignore` excludes `.env` |
| `make check-env` validates vars + logins | PASS | Tests OCP, OCI, and image registry auth |
| OCI robot account is read-only | PASS | Robot has `read` role; admin token used for push |
| Keycloak secrets via env vars | PASS | Ansible role reads from env, not files |

### 2.2 ArgoCD Hardening

| Check | Status | Notes |
|---|---|---|
| ApplicationSet in `openshift-gitops` namespace | PASS | Restricted namespace |
| `selfHeal: true` on all Applications | PASS | Prevents drift |
| `prune: true` on all Applications | PASS | Removes orphaned resources |
| Services cluster uses SA token | PASS | Dedicated `argocd-manager` SA |
| ArgoCD RBAC: project isolation | RECOMMENDED | Move to named AppProjects |
| Dynamic plugins enabled | RECOMMENDED | Enable when available |

### 2.3 RHACM Hardening

| Check | Status | Notes |
|---|---|---|
| SingleNamespace OperatorGroup | PASS | ACM requires this mode |
| Minimal components enabled | PASS | Only console, search, cluster-lifecycle |
| Sourced from `redhat-operators` catalog | PASS | Certified operator |
| `installPlanApproval: Automatic` | REVIEW | Change to `Manual` for air-gapped |

### 2.4 Keycloak (RHBK) Hardening

| Check | Status | Notes |
|---|---|---|
| HA mode (2 instances) | PASS | Both clusters |
| Dedicated namespace (`rhbk`) | PASS | Isolated from workloads |
| Operator v26.4 from `redhat-operators` | PASS | Certified RHBK operator |
| Client secrets are K8s Secrets | PASS | Not in Git; created by Ansible |
| Realm creation via REST API | PASS | Bearer token auth, not stored |
| Admin token short-lived (60s) | PASS | Obtained per operation batch |
| Ansible job uses cluster-admin SA | REVIEW | Scope down to namespace-admin |
| Secrets stored in Vault KV | PASS | Delivered via External Secrets |
| Dev mode (HTTP, embedded DB) | REVIEW | Switch to TLS + PostgreSQL for production |

### 2.5 Cluster Hardening

| Check | Status | Notes |
|---|---|---|
| TLS verification on `oc login` | REVIEW | `--insecure-skip-tls-verify=true` for self-signed certs |
| Services cluster auth | PASS | Uses ServiceAccount token (non-expiring) |
| Namespace isolation | PASS | Keycloak in `rhbk`, ACM in `open-cluster-management` |
| Image registry trusted | PASS | `make add-docker-repo` configures pull secrets |

### 2.6 OCI / Supply Chain

| Check | Status | Notes |
|---|---|---|
| Private OCI repositories | PASS | All repos set to `private` |
| Chart versions pinned | PASS | `targetRevision` in all Applications |
| Robot read-only default | PASS | Org prototype enforces read-only |
| ansible-runner base pinned | PASS | Uses exact tag `2.0-1777391447` |
| Cosign signing | TODO | Sign charts with `cosign` |
| SBOM generation | TODO | Generate SBOM on chart push |

---

## 3. CIS Benchmark Gaps (OpenShift 4.x)

| Control | Area | Action Required |
|---|---|---|
| CIS 1.2.1 | API server audit logging | Verify on both clusters |
| CIS 4.2.6 | Kubelet protect kernel defaults | Confirm in KubeletConfig |
| CIS 5.2.1 | Pod Security Admission | Enforce `restricted` in workload namespaces |
| CIS 5.4.1 | Secrets encryption at rest | Confirm etcd encryption |

---

## 4. Remediation Priority

| Priority | Finding | Action |
|---|---|---|
| HIGH | TLS verification skipped | Add CA bundle or use `--certificate-authority` |
| HIGH | ArgoCD in `default` project | Create named AppProject |
| HIGH | sovereign-admin = cluster-admin | Add granular roles before production |
| MEDIUM | No Cosign signing | Implement in all `make upload-*` targets |
| MEDIUM | `installPlanApproval: Automatic` | Change to `Manual` for sovereign deployments |
| MEDIUM | Keycloak secrets in Vault | RESOLVED - secrets stored in `central/keycloak-clients` |
| LOW | No NetworkPolicy baseline | Add deny-all + allow ArgoCD |
| LOW | No image scanning | Add Trivy/ACS scan in `make ansible-runner` |

---

## 5. Platform Component Hardening

### 5.1 Vault (Central Cluster)

| Check | Status | Notes |
|---|---|---|
| HA mode with Raft (3 replicas) | PASS | Active + 2 standby |
| Images from allowed registry | PASS | Mirrored to quay.example.com |
| Auto-unseal | TODO | Configure KMS/Transit auto-unseal |
| Audit logging | TODO | Enable Vault audit device |
| TLS on internal comms | REVIEW | Currently HTTP internal, route TLS |

### 5.2 ACS (Both Clusters)

| Check | Status | Notes |
|---|---|---|
| ACS disabled | INFO | `enabled: false` in app-of-apps for both clusters |

### 5.3 AAP (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Deployed only on services cluster | PASS | Central ArgoCD manages |
| Controller + EDA enabled, Hub disabled | PASS | Hub removed (not needed) |
| Operator from redhat-operators | PASS | Certified, channel stable-2.6 |

### 5.4 ODF / Noobaa (Both Clusters)

| Check | Status | Notes |
|---|---|---|
| Noobaa-only deployment | PASS | Minimal footprint |
| S3 endpoints active | PASS | Bucket storage for Quay |
| Operator from redhat-operators | PASS | channel stable-4.21 |

### 5.5 Quay (Both Clusters)

| Check | Status | Notes |
|---|---|---|
| Clair scanning enabled | PASS | Managed component |
| TLS via managed route | PASS | Operator-managed TLS |
| Object storage via Noobaa | PASS | External backend |

### 5.6 Crunchy Postgres for Kubernetes (Both Clusters)

| Check | Status | Notes |
|---|---|---|
| Operator from certified-operators | PASS | Package `crunchy-postgres-operator`, channel v5 |
| Cluster-scoped installation | PASS | Manages PG in any namespace |
| HA PostgresCluster instances | TODO | Dedicated instances per service |

### 5.7 Gitea (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Images mirrored to allowed registry | PASS | All from quay.example.com |
| PostgreSQL backend (not SQLite) | PASS | Bitnami PostgreSQL subchart |
| Valkey cluster for session/cache | PASS | In-cluster Valkey (Redis-compatible) |
| Keycloak OIDC integration | PASS | Client `gitea` in sovereign-central realm |
| Route-based access | WARN | HTTP route only — TLS termination not configured on route |
| Admin credentials from Vault | PASS | ExternalSecret `gitea-admin-credentials` in gitea ns |
| OCI pull secret from Vault | PASS | ExternalSecret `quay-pull-secret-es` in gitea ns |
| Admin token stored in Vault | PASS | `central/gitea-admin.admin_token` |

### 5.8 Entity Operator (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application targets `servicesCluster.server` |
| Scoped ClusterRole (not cluster-admin) | PASS | Namespaces, events, entities, configmaps, leases |
| Non-root, no privilege escalation | PASS | SecurityContext enforced |
| Shared pull secret | PASS | `quay-pull-secret` (OCI robot) |
| API group rule followed | PASS | `hybridsovereign.redhat` → services |

### 5.9 Sovereign Dashboard (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application targets `servicesCluster.server` |
| OAuth proxy with secure cookies | PASS | httponly, secure, samesite=Strict |
| TLS reencrypt route | PASS | Serving cert auto-provisioned |
| Rate limiting + input validation | PASS | express-rate-limit, server-side validation |
| Shared pull secret | PASS | `quay-pull-secret` (OCI robot) |
| User token passthrough | PASS | Uses `X-Forwarded-Access-Token`, not SA token |

### 5.10.1 Plugin RBAC Operator (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | `hybridsovereign.redhat` API group rule |
| Keycloak admin creds from Vault | PASS | ExternalSecret for `rhbk-services-admin` |
| Confidential OIDC clients | PASS | Creates `clientAuthenticatorType: client-secret` |
| Non-root, no privilege escalation | PASS | SecurityContext enforced |
| Shared pull secret | PASS | `quay-pull-secret` (OCI robot) |
| Service account roles scoped | PASS | Only `manage-users`, `manage-clients`, `manage-realm`, `view-users` |
| Group attributes populated | PASS | entity, billing-id, creator, config, namespace |
| Creator tracking | PASS | Annotation-based creator capture |

### 5.10.2 Tenancy Dashboard (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application targets `servicesCluster.server` |
| User token passthrough | PASS | Uses `X-Forwarded-Access-Token`, not SA token |
| RBAC scoping via user token | PASS | User sees only accessible namespaces/resources |
| OAuth proxy with secure cookies | PASS | httponly, secure, samesite=lax |
| TLS reencrypt route | PASS | Serving cert auto-provisioned |
| Rate limiting + input validation | PASS | express-rate-limit, server-side validation |
| RbacConfig dropdown filtered | PASS | Only shows `ready=true` configs |
| Creator annotation on create | PASS | `hybridsovereign.redhat/creator` from `X-Forwarded-User` |

### 5.10 Vault Initialization Security

| Check | Status | Notes |
|---|---|---|
| Unseal keys stored as K8s Secret | REVIEW | Consider moving to HSM/KMS |
| Root token in K8s Secret | REVIEW | Revoke after initial setup |
| KV v2 for versioning/audit | PASS | `central/` engine |
| Initialization via Ansible | PASS | Idempotent, no local storage |

### 5.11 Plugin Vault Operator (Services Cluster)

| Check | Status | Notes |
|---|---|---|
| Non-root, no privilege escalation | PASS | SecurityContext enforced |
| Per-entity Vault instances | PASS | Each entity gets a dedicated Vault |
| OIDC client isolation | PASS | Per-entity Keycloak clients with scoped redirect URIs |
| KV policy isolation | PASS | Admin/reader policies per VaultKV engine |
| Cross-entity access prevention | PASS | Separate Vault instances + OIDC clients |
| Unseal key storage | WARN | Single share in K8s Secret; increase for production |
| Finalizer cleanup | PASS | Resources removed on CR deletion |
| ExternalSecret for Keycloak creds | PASS | Vault-backed via ClusterSecretStore |

### 5.12 Chart Deduplication

| Check | Status | Notes |
|---|---|---|
| sovereign-jobs chart removed | PASS | Unused chart deleted; only sovereign-job remains |
| No orphaned OCI references | PASS | Init chart and Makefile updated |
| Central OAuth CA cert | PASS | x509 error resolved with ingress CA ConfigMap |

---

## 2026 Assessment Update

**Date:** 2026-06-16  
**Full report:** [security-state-2026.md](./security-state-2026.md)  
**Diagrams:** [50-security-interaction-diagrams.md](../docs/technical/50-security-interaction-diagrams.md)

### Components Reviewed

- All 23 hardeningcheck baseline files
- Services cluster: sovereign-cloud, sovereign-cloud-plugins, services-rhbk, services-vault, services-quay
- Central cluster: openshift-gitops, central-vault, central-rhbk, gitea
- Operator Helm ClusterRoles: Entity, Team, Assignment, Persona, plugin-rbac, plugin-vault, plugin-aap, plugin-quay
- EDA rulebooks roles (no_log coverage, cross-cluster token usage)
- Dashboard RBAC (sovereign-cloud-dashboard, tenancy-dashboard)
- Keycloak Admin API validation (create/delete test user in sovereign-tenants)

### Key Improvements Since Last Assessment (v0.11.0)

| Area | Improvement |
|---|---|
| Plugin RBAC | Vault KV writes replace direct K8s Secret creation; `no_log` on credential tasks; Vault cleanup on CR delete |
| Entity operator RBAC | Scoped ClusterRole — no cluster-admin; external provisioning moved to EDA |
| Secrets flow | All 22 services ExternalSecrets `SecretSynced`; ClusterSecretStore uses k8s auth (not root token) |
| Dashboard security | reencrypt TLS routes; oauth-proxy secure cookies; user-token passthrough confirmed |
| EDA rebuild | Event forwarder with watch-only RBAC; per-operator DE images; dedup + bounded retry |
| Operator placement | All `hybridsovereign.redhat` operators confirmed on services cluster |

### Remaining Gaps

| Priority | Gap | Status |
|---|---|---|
| HIGH | sovereign-admin group → cluster-admin | Open |
| HIGH | argocd-manager + EDA argocd-cluster-services token → cluster-admin on services | Open |
| HIGH | Vault root token in k8s Secret; no auto-unseal | Open |
| MEDIUM | No NetworkPolicy in sovereign-cloud / sovereign-cloud-plugins | Open |
| MEDIUM | Vault audit logging not enabled | Open |
| MEDIUM | EDA cross-cluster `validate_certs: false` | Open |
| MEDIUM | event-forwarder missing NetworkPolicy + explicit securityContext | Open |
| LOW | Cosign/SBOM not implemented | Open |
| LOW | Gitea HTTP route; Keycloak dev-mode internal HTTP | Open |

### Priority Remediation Items

1. **SEC-003** — Scope ArgoCD services-cluster registration token to a custom ClusterRole (EDA write-only permissions).
2. **SEC-001** — Replace sovereign-admin cluster-admin binding with granular platform admin roles.
3. **SEC-005** — Deploy deny-all + allow NetworkPolicy baseline to sovereign workload namespaces.
4. **SEC-004/SEC-006** — Vault root token rotation and audit device enablement.
5. **SEC-010/SEC-011** — Harden EDA roles: `no_log` on patch_cr_status; enable TLS verification for cross-cluster API.
