# NIST SP 800-53 Rev. 5 — Control Mapping

**Platform**: Hybrid Sovereign Cloud (`hybridcloud/`)  
**Framework**: NIST SP 800-53 Rev. 5 (Moderate baseline, selected controls)  
**Purpose**: Map platform components to security controls for migration acceptance

---

## Access Control (AC)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| AC-2 | Account Management | Keycloak RHBK realms; test users via `keycloakTestUsers` Job | RHBK + Ansible Jobs | ☐ |
| AC-3 | Access Enforcement | K8s RBAC + Keycloak group bindings via Rbac/RbacConfig CRs | Entity namespaceRbac matrix | ☐ |
| AC-5 | Separation of Duties | 14 named entity roles; admin vs tenant console plugins | Persona + RBAC specs | ☐ |
| AC-6 | Least Privilege | Namespace-scoped operator Roles; per-CR viewer Roles | Operator Helm templates | ☐ |
| AC-17 | Remote Access | OpenShift OAuth via Keycloak; Vault OIDC | keycloak-oauth, vault-oidc-auth Jobs | ☐ |

## Audit and Accountability (AU)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| AU-2 | Event Logging | OCP audit logs + K8s events → Kafka `hybridsovereign-audit` | event-forwarder DaemonSet | ☐ |
| AU-3 | Content of Audit Records | Structured K8s audit; EDA rulebook event payloads | event-forwarder filter rules | ☐ |
| AU-6 | Audit Review | ACS Central; admin dashboard audit views | ACS + admin-dashboard | ☐ |
| AU-9 | Protection of Audit Info | Kafka topic ACLs; Vault audit device | AMQ Streams + Vault config | ☐ |
| AU-12 | Audit Generation | Operator reconcile events published to Kafka | EDA entity-create rulebooks | ☐ |

## Identification and Authentication (IA)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| IA-2 | Identification and Authentication | Keycloak SSO for UI and Vault OIDC | Specs 022, 023 | ☐ |
| IA-5 | Authenticator Management | Credentials in Vault only; ESO sync | ExternalSecret templates | ☐ |
| IA-8 | Identification and Authentication (Non-Org Users) | Tenant users via entity-scoped Keycloak groups | Rbac CR members | ☐ |

## System and Communications Protection (SC)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| SC-8 | Transmission Confidentiality | TLS on Routes, Kafka (target 9093), Vault API | Ingress + AMQ Streams | ☐ |
| SC-12 | Cryptographic Key Establishment | OCP service CA; Vault PKI for internal certs | Cluster cert review | ☐ |
| SC-13 | Cryptographic Protection | etcd encryption; Vault transit (if enabled) | Cluster + Vault config | ☐ |
| SC-28 | Protection of Information at Rest | ODF encryption; Vault KV v2 | ODF + Vault specs | ☐ |

## System and Information Integrity (SI)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| SI-2 | Flaw Remediation | ACS vulnerability scanning; OCP CVE advisories | ACS Central | ☐ |
| SI-3 | Malicious Code Protection | ACS runtime policies; OCP SCC defaults | ACS + SCC review | ☐ |
| SI-4 | System Monitoring | Prometheus/OCP monitoring; EDA health checks | Cluster monitoring stack | ☐ |
| SI-7 | Software Integrity | Image pull from Quay with signed tags (target) | Quay + image policies | ☐ |

## Configuration Management (CM)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| CM-2 | Baseline Configuration | GitOps via ArgoCD; `bootstrap/helm/central/values.yaml` | ArgoCD app-of-apps | ☐ |
| CM-3 | Configuration Change Control | PR + ArgoCD sync; no direct `oc apply` | Constitution gate II | ☐ |
| CM-6 | Configuration Settings | Helm values per environment; sync-wave ordering | central values.yaml | ☐ |
| CM-8 | System Component Inventory | Specs index (034 features); architecture docs | `specs/README.md` | ☐ |

## Contingency Planning (CP)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| CP-9 | System Backup | ODF snapshots; Vault raft snapshots; Crunchy Postgres backups | ODF + Vault + PGO | ☐ |
| CP-10 | System Recovery | ArgoCD self-heal; operator finalizer cleanup | restart test suite | ☐ |

## Risk Assessment (RA)

| Control | Title | Implementation | Evidence | Status |
|---------|-------|----------------|----------|--------|
| RA-5 | Vulnerability Monitoring | ACS image scanning on Quay registry | ACS + Quay integration | ☐ |

---

## Hybrid Sovereign-Specific Controls

| ID | Description | Owner | Status |
|----|-------------|-------|--------|
| HS-AC-1 | Entity namespace isolation via dedicated namespace operator | Platform team | ☐ |
| HS-AU-1 | All CR lifecycle events forwarded to Kafka for EDA audit | EDA team | ☐ |
| HS-SC-1 | No credentials in Ansible Job env; Vault KV read only | Operator team | ☐ |
| HS-CM-1 | Frozen sovereign repos deprecated; hybridcloud canonical | Architecture | ☐ |

---

## Assessment Workflow

1. Complete `tests/security/SECURITY_REVIEW.md` (prerequisite).
2. Mark each control above with evidence links.
3. File gaps in `hardening-checks/reports/migration-hardening-gap-analysis.md`.
4. Re-assess after Mega-Phase J gate.

**Acceptance threshold**: All **P0** controls Implemented; **P1** may be Partial with documented remediation date.
