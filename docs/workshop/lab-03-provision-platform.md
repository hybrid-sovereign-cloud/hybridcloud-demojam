# Lab 3 — Provision PlatformOpenshift

Match the Cloud\* from Lab 2.

## Track A — AWS

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: workshop-ocp-aws
  namespace: entity-acme-corp
spec:
  type: aws
  aws:
    environment: workshop-aws
    region: us-east-1
    clusterType: standalone
    controlPlaneCount: 3
    workerCount: 2
```

## Track B — OpenStack

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: workshop-ocp-oso
  namespace: entity-acme-corp
spec:
  type: openstack
  openstack:
    environment: workshop-oso
    controlPlaneCount: 3
    workerCount: 3
    externalNetwork: internet
```

## Track C — Hosted on Virt

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: workshop-ocp-hosted
  namespace: entity-acme-corp
spec:
  type: hosted
  hosted:
    environment: local-virt
    nodePoolReplicas: 2
```

## Monitor

```bash
oc apply -f platform.yaml
oc get platformopenshift -n entity-acme-corp -w
# also:
oc get clusterdeployment -A 2>/dev/null | head
oc get hostedcluster -A 2>/dev/null | head
oc get managedcluster | head
```

**Pass:** Platform shows ready / Provisioned; console or API URL in status when applicable.

Troubleshoot: `oc describe platformopenshift <name> -n entity-acme-corp` and AAP job output.

→ [Lab 4](lab-04-assignment.md)
