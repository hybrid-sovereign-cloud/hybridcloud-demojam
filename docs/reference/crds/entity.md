# Entity

Creates the tenant namespace `entity-<metadata.name>` — the only place that
tenant's CRs may live.

The operators that reconcile those CRs are **cluster-scoped** and already
running in `sovereign-cloud` (`WATCH_NAMESPACE=""`); nothing is deployed into
the entity namespace itself. Older revisions of this platform ran a
per-entity namespace operator (still in the legacy `operator/namespace/`
tree); the live operator image does not.

## Flow

```text
Create Entity in sovereign-cloud
        → namespace entity-<name>
        → cluster-scoped operators start watching it
        → ready for Cloud* / Team / …
```

## Minimal example

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Entity
metadata:
  name: example-corp
  namespace: sovereign-cloud
spec:
  description: Example Corp tenant
  billingID: example-001
```

## Important fields

| Field | Meaning |
|-------|---------|
| `spec.description` | Required text |
| `spec.billingID` | Billing label (alphanumeric / `._-`) |
| `spec.namespaceRbac` | Maps roles (entityAdmin, cloudAWSAdmin, …) to **Rbac** CR names |

## Check

```bash
oc get entity example-corp -n sovereign-cloud
oc get ns entity-example-corp
oc get deploy -n sovereign-cloud -l hybridsovereign.redhat/operator-kind
```

## Delete

Deleting an Entity tears down tenant resources. Prefer removing Assignments / Platforms first. **Never delete `sovereign-*` namespaces.**
