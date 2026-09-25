# Rbac and Persona

## Rbac

Defines a **group** of users (Keycloak / IdP group name) used by Entity, Cloud\*, Platform, and Assignment RBAC fields.

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Rbac
metadata:
  name: acme-platform-admins
  namespace: entity-acme-corp
spec:
  # group / members per your Rbac CR schema
```

Reference that name in lists like:

- Entity `spec.namespaceRbac.entityAdmin`
- CloudOSO `spec.toolRbac.projectAdminRbac`
- PlatformOpenshift `spec.toolRbac.clusterAdminRbac`
- Assignment `spec.toolRbac.assignmentAdmin`

## Persona

Maps a person (user) to roles / teams for the UI and IdP sync.

Create Personas after Rbac groups exist. See samples under `samples/persona/` and `samples/rbac/`.

## Flow

```text
Rbac (groups) → Persona (users) → referenced by Entity / Cloud / Assignment
```
