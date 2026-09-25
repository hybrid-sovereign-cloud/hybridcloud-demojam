# Lab 4 — Assignment lifecycle

Uses the PlatformOpenshift from Lab 3. Adjust names to match.

## Ensure Team (+ Project)

```bash
oc get team,project -n entity-acme-corp
```

If missing, apply samples or:

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
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Project
metadata:
  name: workshop-app
  namespace: entity-acme-corp
spec:
  description: Workshop demo project
```

## Create Assignment

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Assignment
metadata:
  name: pe-workshop
  namespace: entity-acme-corp
spec:
  team: platform-engineering
  projects:
    - workshop-app
  openshift: workshop-ocp-aws   # or workshop-ocp-oso / workshop-ocp-hosted
```

```bash
oc apply -f assignment.yaml
oc get assignment pe-workshop -n entity-acme-corp -o yaml
```

**Pass:** Assignment ready; spoke namespace(s) and RoleBindings exist (check ManagedCluster / Policy).

## Deprovision / re-apply

```bash
oc delete assignment pe-workshop -n entity-acme-corp
# confirm spoke cleanup, then:
oc apply -f assignment.yaml
```

**Pass:** Delete cleans access; re-apply restores it.

→ [Lab 5](lab-05-ui.md) (optional) or cleanup Platforms when finished.
