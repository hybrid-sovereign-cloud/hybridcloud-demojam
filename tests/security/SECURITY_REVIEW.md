# Hybrid Sovereign — Security Review Checklist

**Scope**: `hybridcloud/` monorepo (canonical platform source)  
**Audience**: Platform engineers, security reviewers, release gate owners  
**Last updated**: 2026-07-11

Use this checklist before merging bootstrap changes, operator releases, or migration milestones. Mark each item **PASS**, **FAIL**, or **N/A** with evidence (command output, PR link, or ArgoCD Application name).

---

## 1. No Secrets in Git

| # | Check | Evidence | Status |
|---|-------|----------|--------|
| 1.1 | No plaintext credentials, tokens, API keys, or private keys in any tracked file | `git grep -iE '(password|secret|token|apikey|private_key)\s*[:=]' -- hybridcloud/` returns only templated references or docs | ☐ |
| 1.2 | Sample CRs use `REDACTED` placeholders (`samples/README.md` sanitization rules) | Spot-check `samples/**/*.yaml` | ☐ |
| 1.3 | Bootstrap init chart seeds secrets from env vars only (`make init-central-argo`); no post-bootstrap Secret manifests in Git | Review `bootstrap/helm/init/templates/` | ☐ |
| 1.4 | Ansible roles use `no_log: true` on credential-bearing tasks | Grep `eda/`, `bootstrap/ansible/`, `operator/` roles | ☐ |
| 1.5 | CI/pre-commit hooks block secret patterns (if configured) | CI config or local hook output | ☐ |
| 1.6 | `.env`, `kubeconfig`, and credential files are `.gitignore`d | Review `.gitignore` | ☐ |

**Remediation**: Rotate any exposed credential immediately; move to Vault KV; replace with ExternalSecret/PushSecret references.

---

## 2. Vault-Only Credentials

| # | Check | Evidence | Status |
|---|-------|----------|--------|
| 2.1 | All runtime credentials flow: env/bootstrap → Vault KV → ExternalSecret → K8s Secret | Trace one credential path (e.g. VMware, Keycloak admin) end-to-end | ☐ |
| 2.2 | `ClusterSecretStore` name is `vault-backend` across all ExternalSecrets | `oc get externalsecret -A -o yaml \| grep secretStoreRef` | ☐ |
| 2.3 | ExternalSecret `creationPolicy: Owner` on all generated Secrets | Template review under `bootstrap/helm/charts/*/templates/` | ☐ |
| 2.4 | PushSecret used for outbound secret sync (e.g. cluster SA tokens, migration logs) | Review `vault-services-init`, migration roles | ☐ |
| 2.5 | Ansible Jobs read Vault via `vault_kv_read.yml` common task, not inline secrets | `eda/common/tasks/vault_kv_read.yml` usage | ☐ |
| 2.6 | No `oc create secret` or direct Secret YAML in charts post-bootstrap | Chart template audit | ☐ |

**Vault path conventions**:

- Hub: `central/data/<component>`
- Entity-scoped: `entity-<name>/data/<component>`
- Hub bootstrap: seeded via init Jobs only

---

## 3. RBAC Least Privilege

| # | Check | Evidence | Status |
|---|-------|----------|--------|
| 3.1 | Primary operator ClusterRole grants only verbs needed for Entity + plugin config CRs | `operator/primary/helm/templates/clusterrole.yaml` | ☐ |
| 3.2 | Namespace operator uses namespace-scoped Role, not ClusterRole | `operator/namespace/helm/templates/role.yaml` | ☐ |
| 3.3 | Entity namespace RBAC uses 14 named roles; no blanket `*` on secrets | Entity reconcile roles | ☐ |
| 3.4 | Per-CR viewer Roles (`<cr>-team-viewer`) scope `resourceNames` to single CR | Team/Project operator tasks | ☐ |
| 3.5 | Ansible Job ServiceAccounts bound via `sovereign-job-rbac` chart with minimal verbs | `bootstrap/helm/charts/sovereign-job-rbac/` | ☐ |
| 3.6 | Dashboard/console plugins use user OAuth token, not cluster-admin SA | UI plugin deployment specs | ☐ |
| 3.7 | Test users (`test-*`) have scoped Keycloak groups, not `cluster-admin` | Keycloak realm review | ☐ |
| 3.8 | HELPEROSO/HELPERAWS SAs remain disabled (`enabled: false` in central values) | `bootstrap/helm/central/values.yaml` | ☐ |

---

## 4. External Secrets Operator (ESO) Patterns

| # | Check | Evidence | Status |
|---|-------|----------|--------|
| 4.1 | Every component needing credentials has an ExternalSecret template | Inventory: Vault, Quay, AAP, MTV, event-forwarder, RHBK, etc. | ☐ |
| 4.2 | ExternalSecrets use `argocd.argoproj.io/sync-wave: "-2"` (or earlier) so Secrets exist before workloads | Template annotations | ☐ |
| 4.3 | `SkipDryRunOnMissingResource=true` on ExternalSecrets where CRD may lag | MTV, event-forwarder templates | ☐ |
| 4.4 | ExternalSecret `refreshInterval` set (default 1h); no infinite stale creds without rotation path | Template `spec.refreshInterval` | ☐ |
| 4.5 | Remote Vault keys use `property:` for structured KV fields | `remoteRef.property` in templates | ☐ |
| 4.6 | ESO operator itself is Synced/Healthy before dependent apps | `oc get application external-secrets -n openshift-gitops` | ☐ |

---

## 5. Namespace Protection

| # | Check | Evidence | Status |
|---|-------|----------|--------|
| 5.1 | No automation deletes `sovereign-*` or `entity-*` namespaces | Teardown roles use `state: absent` only on owned resources | ☐ |
| 5.2 | Hub does NOT host `sovereign-cloud` or `sovereign-cloud-plugins` tenant workloads | Cluster topology doc + `oc get ns` on the hub | ☐ |
| 5.3 | Entity finalizer removes namespace operator before namespace deletion | Entity teardown playbook | ☐ |
| 5.4 | ArgoCD prune disabled or scoped for tenant namespaces | Application `syncPolicy` review | ☐ |
| 5.5 | `sovereign-namespaces` chart creates namespaces additively only | `bootstrap/helm/charts/sovereign-namespaces/` | ☐ |
| 5.6 | MTV/CNV disable tests verify namespace emptied but not deleted | Phase 5 CRUD validation | ☐ |

---

## 6. Operator Security Contexts

| # | Check | Evidence | Status |
|---|-------|----------|--------|
| 6.1 | All operator Deployments set `runAsNonRoot: true` | `operator/*/helm/templates/deployment.yaml` | ☐ |
| 6.2 | Pod-level `seccompProfile: RuntimeDefault` | Namespace operator deployment | ☐ |
| 6.3 | Container `allowPrivilegeEscalation: false` | Operator + event-forwarder templates | ☐ |
| 6.4 | Container `capabilities.drop: [ALL]` | Operator templates | ☐ |
| 6.5 | No `hostNetwork`, `hostPID`, or `privileged: true` on platform workloads | Helm template grep | ☐ |
| 6.6 | ServiceAccounts do not auto-mount unnecessary tokens where disabled | `automountServiceAccountToken: false` where applicable | ☐ |
| 6.7 | Resource requests/limits defined on all platform Deployments | values.yaml + templates | ☐ |
| 6.8 | Image pull policy `Always` or digest-pinned for production tags | Chart values review | ☐ |

---

## Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| Platform lead | | | |
| Security reviewer | | | |
| Release manager | | | |

**Gate criteria**: Sections above must be PASS (or documented N/A) before release.
