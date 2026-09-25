# Entity

Creates the tenant namespace `entity-<metadata.name>` and starts the **namespace operator** for that tenant.

## Flow

```text
Create Entity in sovereign-cloud
        → namespace entity-<name>
        → namespace operator Deployment
        → ready for Cloud* / Team / …
```

## Minimal example

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Entity
metadata:
  name: acme-corp
  namespace: sovereign-cloud
spec:
  description: Acme Corp tenant
  billingID: acme-001
```

## Important fields

| Field | Meaning |
|-------|---------|
| `spec.description` | Required text |
| `spec.billingID` | Billing label (alphanumeric / `._-`) |
| `spec.namespaceRbac` | Maps roles (entityAdmin, cloudAWSAdmin, …) to **Rbac** CR names |

## Check

```bash
oc get entity acme-corp -n sovereign-cloud
oc get ns entity-acme-corp
oc get deploy -n entity-acme-corp   # namespace operator
```

## Delete

Deleting an Entity tears down tenant resources. Prefer removing Assignments / Platforms first. **Never delete `sovereign-*` namespaces.**
