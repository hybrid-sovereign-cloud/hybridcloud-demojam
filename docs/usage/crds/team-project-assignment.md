# Team, Project, Assignment

## Team

Feature flags for a group of people inside an entity.

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Team
metadata:
  name: platform-engineering
  namespace: entity-acme-corp
spec:
  features:
    istio: false
    argo: false
```

Do **not** set deprecated `teamAdmin` / `rbacConfig` — use Assignment `toolRbac`.

## Project

Logical app / workload name used by Assignments.

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Project
metadata:
  name: website-redesign
  namespace: entity-acme-corp
spec:
  description: Website redesign
```

## Assignment

Links a **Team** to a **PlatformOpenshift** (and optional Projects). Creates spoke namespaces + RoleBindings via ACM Policy.

```text
Team + Platform (+ Projects) → Assignment → spoke NS + RBAC
```

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Assignment
metadata:
  name: pe-on-workshop-aws
  namespace: entity-acme-corp
spec:
  team: platform-engineering
  projects:
    - website-redesign
  openshift: workshop-ocp-aws
  toolRbac:
    assignmentAdmin: acme-platform-admins
    assignmentDeveloper: acme-devs
    assignmentViewer: acme-viewers
```

### Lifecycle test (lab)

```bash
# create
oc apply -f assignment.yaml
oc get assignment pe-on-workshop-aws -n entity-acme-corp -o yaml
# delete → spoke NS / bindings cleaned
oc delete assignment pe-on-workshop-aws -n entity-acme-corp
# re-apply
oc apply -f assignment.yaml
```

## Order

```text
Entity → Team + Project → Platform ready → Assignment
```
