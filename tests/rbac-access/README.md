# RBAC Access Matrix

**Scope**: Admin vs tenant user authorization across Hybrid Sovereign surfaces  
**Identity provider**: Keycloak (RHBK central)  
**Prerequisite**: RbacConfig + Entity `namespaceRbac` applied; test users provisioned via `keycloakTestUsers` Job

---

## User Personas

| Persona | Keycloak User (example) | Group / Role Binding | Cluster Access |
|---------|-------------------------|----------------------|------------------|
| **Platform Admin** | `test-platform-admin` | `hybridsovereign-platform-admins` | `cluster-admin` or equivalent on the hub |
| **Entity Admin** | `test-entity-admin` | `acme-entity-admin` (via Rbac CR) | `edit` in `entity-acme-corp` |
| **Entity Viewer** | `test-entity-viewer` | `acme-auditor` | `view` in `entity-acme-corp` |
| **Team Admin** | `test-team-lead` | `acme-team-admin` + team membership | `edit` on Team CR + related resources |
| **Team Member** | `test-developer` | Team `spec.members` | Team viewer RoleBinding only |
| **Vault Admin** | `test-vault-admin` | `acme-vault-admins` | Vault UI policy (not K8s cluster-admin) |
| **AAP Executor** | `test-aap-executor` | `acme-aap-executors` | AAP launch; no CR create |
| **Tenant Dashboard User** | `test-tenant-user` | Entity-scoped group | OAuth to tenant dashboard; namespace-scoped API |

---

## Kubernetes API Matrix

Legend: ✅ Allowed · ❌ Denied · 🔒 Scoped (resourceNames / subresource)

### sovereign-cloud namespace (primary operator CRs)

| Resource | Platform Admin | Entity Admin | Entity Viewer |
|----------|---------------|--------------|---------------|
| `entities` create | ✅ | ❌ | ❌ |
| `entities` get/list | ✅ | ✅ (own entity) | ✅ (own entity) |
| `entities` delete | ✅ | ❌ | ❌ |
| `rbacconfigs` | ✅ | ❌ | ❌ |
| `aapconfigs`, `quayconfigs` | ✅ | ❌ | ❌ |

### entity-acme-corp namespace (namespace operator CRs)

| Resource | Entity Admin | Entity Viewer | Team Member |
|----------|--------------|---------------|-------------|
| `teams` create | ✅ | ❌ | ❌ |
| `teams` get (all) | ✅ | ✅ | 🔒 own team only |
| `teams` patch/delete | ✅ | ❌ | ❌ |
| `projects` CRUD | ✅ | ❌ | ❌ |
| `personas` CRUD | ✅ | ❌ | ❌ |
| `cloudosos` create | ✅ (cloudoso-admin) | ❌ | ❌ |
| `platformopenshifts` create | ✅ | ❌ | ❌ |
| `assignments` create | ✅ | ❌ | ❌ |
| `openstackmigrations` create | ✅ (migration-admin) | ❌ | ❌ |
| `secrets` get | ❌ | ❌ | ❌ |
| `pods/exec` | ❌ | ❌ | ❌ |

### sovereign-cloud-plugins namespace

| Resource | Platform Admin | Entity Admin | Vault Admin |
|----------|---------------|--------------|-------------|
| `rbacs` (cluster-wide config) | ✅ | ❌ | ❌ |
| Plugin operator pods | ✅ view | ❌ | ❌ |

---

## Console / Dashboard Matrix

| Action | Admin Dashboard | Tenant Dashboard | OCP Console Plugin |
|--------|----------------|------------------|-------------------|
| List all entities | ✅ Platform Admin | ❌ | ✅ Admin plugin |
| View own entity CRs | ✅ | ✅ Entity Admin/Viewer | ✅ Tenant plugin |
| Create Team | ✅ | ✅ Entity Admin | ✅ (scoped) |
| Delete Entity | ✅ Platform Admin | ❌ | ❌ |
| View secrets | ❌ | ❌ | ❌ |
| Launch AAP job template | ✅ | ✅ AAP Executor | ❌ |

---

## Vault Policy Matrix

| Path | Platform Admin | Entity Admin | Vault Admin | Tenant User |
|------|---------------|--------------|-------------|-------------|
| `central/*` | ✅ (policy) | ❌ | ✅ | ❌ |
| `entity-acme-corp/*` | ✅ | ✅ (scoped) | ✅ | ❌ |
| `entity-globex/*` | ✅ | ❌ | ✅ | ❌ |

---

## Test Cases

### TC-RBAC-001: Entity Admin Cannot Create Entity

```bash
oc login --token=<entity-admin-token> --server=<api>
oc apply -f samples/entity/globex-industries.yaml -n sovereign-cloud
# Expected: Forbidden
```

### TC-RBAC-002: Entity Viewer Read-Only

```bash
oc auth can-i create teams --namespace=entity-acme-corp --as=test-entity-viewer
# Expected: no
oc auth can-i get teams --namespace=entity-acme-corp --as=test-entity-viewer
# Expected: yes
```

### TC-RBAC-003: Team Member Scoped View

```bash
oc auth can-i get teams/frontend-team --namespace=entity-acme-corp --as=test-developer
# Expected: yes (if member)
oc auth can-i get teams/other-team --namespace=entity-acme-corp --as=test-developer
# Expected: no
```

### TC-RBAC-004: No Secret Access for Tenants

```bash
oc auth can-i get secrets --namespace=entity-acme-corp --as=test-entity-admin
# Expected: no
```

### TC-RBAC-005: Platform Admin Entity CRUD

```bash
oc auth can-i create entities --namespace=sovereign-cloud --as=test-platform-admin
# Expected: yes
```

### TC-RBAC-006: Cross-Entity Isolation

```bash
# Entity admin for acme cannot access entity-globex namespace
oc auth can-i get teams --namespace=entity-globex-industries --as=test-entity-admin
# Expected: no
```

### TC-RBAC-007: Dashboard OAuth Scope

Log in to tenant dashboard as `test-tenant-user`; verify API calls return only `entity-acme-corp` resources.

### TC-RBAC-008: Vault OIDC Login

Log in to Vault UI via Keycloak OIDC as `test-vault-admin`; verify `entity-acme-corp` paths readable, `central/admin` denied.

---

## Pass Criteria

- TC-RBAC-001 through TC-RBAC-008 PASS
- No tenant user receives `cluster-admin`, `secrets`, or `pods/exec` access
- Cross-entity isolation verified

## References

- Spec 001 (Entity), Spec 002 (Team), Spec 012 (Plugin RBAC)
- `samples/rbac/` — 38 sanitized Rbac CR samples
- `tests/security/SECURITY_REVIEW.md` §3
