# Lab 2 — Entity: create your tenant

**Time:** ~10 minutes · **Prerequisite:** [Lab 1](lab-01-verify-platform.md) passed

This is the root of everything. An `Entity` is one customer, business unit or
sovereign domain. Until it exists, that tenant has nowhere to put anything.

---

## What the Entity CR actually does

You create one object in `sovereign-cloud`. The entity operator turns it into
a tenant foothold:

```text
Entity/mycorp  (in sovereign-cloud)
      │
      ├─► creates namespace  entity-mycorp
      │       the only place this tenant's CRs may live; every later lab
      │       puts its objects here
      │
      ├─► starts the per-tenant namespace operator in that namespace
      │       watches tenant CRs scoped to this entity
      │
      ├─► stamps entity identity onto the namespace
      │       name + billingID, so cost and ownership are attributable
      │
      └─► wires spec.namespaceRbac → Keycloak groups
              who may administer the entity itself, and who may create
              CloudAWS / CloudOSO / … inside it
```

Nothing is provisioned in any cloud yet. The Entity is purely the tenancy
boundary — it is cheap, fast, and the thing every other CR hangs from.

### Why it is a CR and not just a namespace

A namespace alone carries no identity mapping, no billing attribution and no
operator. The Entity CR is what makes `entity-mycorp` a *governed* tenant:
deleting the Entity tears down the tenant's resources in order, and the
platform can enumerate tenants by listing one kind.

---

## Create it

```yaml
# lab-entity.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Entity
metadata:
  # Becomes the namespace name: entity-mycorp. Lowercase DNS label.
  name: mycorp
  # Entities always live in the platform namespace, never in a tenant one.
  namespace: sovereign-cloud
spec:
  description: Workshop tenant for the hybrid sovereign lab
  billingID: MYCORP-2026-001
```

```bash
oc apply -f lab-entity.yaml
```

### Fields that matter

| Field | Why you care |
|-------|--------------|
| `metadata.name` | Fixes the namespace (`entity-<name>`) and is immutable in practice — renaming means recreating the tenant. |
| `spec.description` | Required. Shown in the admin console tenant list. |
| `spec.billingID` | Billing/chargeback label. Alphanumeric plus `._-`. |
| `spec.namespaceRbac` | Maps entity-level roles (`entityAdmin`, `cloudAWSAdmin`, `cloudOSOAdmin`, …) to **Rbac** CR names. Left out here on purpose — the Rbac CRs do not exist yet. You add it in [Lab 3](lab-03-identity.md). |

---

## Watch it come up

```bash
# The CR itself
oc get entity mycorp -n sovereign-cloud -w

# What it produced
oc get ns entity-mycorp
oc get deploy -n entity-mycorp        # the per-tenant namespace operator
```

**Pass criteria**

- `oc get entity mycorp -n sovereign-cloud` shows the entity with its billing ID.
- Namespace `entity-mycorp` exists.
- A namespace operator Deployment in `entity-mycorp` is Running.

Typical time to ready: under a minute.

### If it does not go ready

```bash
oc describe entity mycorp -n sovereign-cloud          # conditions + AAP job link
oc logs -n sovereign-cloud deploy/hybridsovereign-entity-operator --tail=50
```

The operator drives an AAP job template; `status.aapJob.url` in the CR links
straight to the job output. A failure there is almost always a missing
platform config (Lab 1 should have caught it).

---

## Compare with the one ZTP built

```bash
oc get entity -n sovereign-cloud
oc get entity acme-corp -n sovereign-cloud -o yaml | less
```

`acme-corp` is the fully-populated example: by the end of this workshop your
`mycorp` will have the same shape. Use it as the answer key.

---

## Cleaning up (later, not now)

Deleting an Entity cascades to the tenant's resources. Always remove the
expensive, external things first:

```text
Assignment → PlatformOpenshift → NetworkPlacement → HybridNetwork
           → Cloud* → Vault/VaultKV, AAPOrg, QuayOrg → Rbac/Persona → Entity
```

**Never delete `sovereign-*` namespaces** — those are the platform itself.

---

Your tenant exists but nobody can do anything in it yet. Next: identity.

→ [Lab 3 — Rbac and Persona](lab-03-identity.md)
