# Lab 3 — Rbac and Persona: who exists, and who they are

**Time:** ~15 minutes · **Prerequisite:** [Lab 2](lab-02-entity.md)

Your tenant has a namespace and nothing else. Before it can own clouds or
clusters you need groups to grant things *to*. This lab covers the three
identity kinds and the division of labour between them.

---

## The three kinds, and why there are three

```text
RbacConfig   (platform, sovereign-cloud-plugins)
   "identity lives at this Keycloak, in this realm, with this client"
   One per hub. A platform admin owns it. You will not create one.
        │
        ├── referenced by ───┐
        ▼                    │
Rbac    (tenant, entity-*)   │
   "a group exists, called mycorp/mycorp-developers"
   Creates a real subgroup in Keycloak under the entity's group.
   This is the unit every other CR grants access to.
        │
        ▼
Persona (tenant, entity-*)
   "this group is the entity-admin persona for this tenant"
   Binds an Rbac group to a platform role, which is what the
   Admin and Tenant consoles use to decide what to show.
```

Put simply: **Rbac is the group, Persona is the hat it wears.** An `Rbac`
with no `Persona` is a perfectly good group you can reference from a Cloud or
Assignment; it just has no special standing in the UI.

---

## Step 1 — Confirm the platform RbacConfig

This already exists; you are just locating it so the `config` field in the
next step makes sense.

```bash
oc get rbacconfig -n sovereign-cloud-plugins
```

```text
NAME                                  PROVIDER   READY
keycloak-sovereign-tenants-services   keycloak   true
```

`RbacConfig` holds the Keycloak URL, realm and admin credential reference for
the whole hub. Every `Rbac` names it so the operator knows where to create
the group. If this is not `READY`, stop — nothing in this lab will work.

---

## Step 2 — Create Rbac groups

Create the groups your tenant will actually use. Four is a realistic minimum:
admins, developers, operators, viewers.

```yaml
# lab-rbac.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Rbac
metadata:
  name: mycorp-platform-admins
  namespace: entity-mycorp
spec:
  # Must match the RbacConfig from step 1.
  config: keycloak-sovereign-tenants-services
  description: Full administrators for the mycorp tenant
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Rbac
metadata:
  name: mycorp-developers
  namespace: entity-mycorp
spec:
  config: keycloak-sovereign-tenants-services
  description: Application developers
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Rbac
metadata:
  name: mycorp-operators
  namespace: entity-mycorp
spec:
  config: keycloak-sovereign-tenants-services
  description: Day-2 operations
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Rbac
metadata:
  name: mycorp-viewers
  namespace: entity-mycorp
spec:
  config: keycloak-sovereign-tenants-services
  description: Read-only observers
```

```bash
oc apply -f lab-rbac.yaml
oc get rbac -n entity-mycorp -w
```

### What the operator did

For each `Rbac` it called an AAP job template that created a Keycloak subgroup
under the entity's group. The result is in the status:

```bash
oc get rbac mycorp-developers -n entity-mycorp \
  -o jsonpath='{.status.group}{"  ready="}{.status.ready}{"\n"}'
```

```text
mycorp/mycorp-developers  ready=true
```

`status.group` is the **fully qualified Keycloak path**. That is the string
that ends up in tokens, and it is why group names are entity-scoped: two
tenants can both have `developers` without colliding.

**Pass:** all four `Rbac` CRs show `ready=true` and a `status.group`.

---

## Step 3 — Create Personas

A `Persona` promotes one group to a platform role. The role names are a fixed
enum — they are what the consoles key off.

```yaml
# lab-persona.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Persona
metadata:
  name: mycorp-entity-admin
  namespace: entity-mycorp
spec:
  # The Rbac CR name from step 2 — not the Keycloak path.
  rbac: mycorp-platform-admins
  type: entityAdmin
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Persona
metadata:
  name: mycorp-auditor
  namespace: entity-mycorp
spec:
  rbac: mycorp-viewers
  type: auditor
```

```bash
oc apply -f lab-persona.yaml
oc get persona -n entity-mycorp
```

Common `spec.type` values: `entityAdmin`, `identityAdmin`, `assignmentAdmin`,
`auditor`, `cloudViewer`, `platformAdmin`. See the
[live samples](../../samples/persona/) for the full set in use.

**Pass:** both Personas report ready and name the right Rbac.

---

## Step 4 — Wire the groups back into the Entity

Now that the groups exist, close the loop you deliberately left open in Lab 2:

```bash
oc patch entity mycorp -n sovereign-cloud --type=merge -p '{
  "spec": {
    "namespaceRbac": {
      "entityAdmin":    "mycorp-platform-admins",
      "cloudOSOAdmin":  "mycorp-operators",
      "cloudVirtAdmin": "mycorp-operators",
      "cloudAWSAdmin":  "mycorp-operators"
    }
  }
}'
```

This is the ordering constraint worth remembering: **Rbac before
`namespaceRbac`**. The Entity can only reference groups that already exist.

---

## Why this matters for every later lab

From here on, access control is always "name an Rbac CR":

| Later CR | Field | Meaning |
|----------|-------|---------|
| `CloudOSO` / `CloudVirt` / `CloudAWS` | `spec.toolRbac.environment*Rbac` | who can use the cloud project |
| `PlatformOpenshift` | `spec.toolRbac.cluster*Rbac` | roles on the provisioned cluster |
| `Assignment` | `spec.toolRbac.assignment*` | roles on the team's spoke namespaces |
| `VaultKV` | `spec.vaultAdminRbac` / `vaultReaderRbac` | who reads and writes secrets |

You never type a Keycloak group path into those fields — always the Rbac CR
name. The operator resolves it.

---

Groups exist, but nothing organises the work yet.

→ [Lab 4 — Team and Project](lab-04-team-project.md)
