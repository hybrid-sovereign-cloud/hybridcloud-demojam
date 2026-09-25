# PlatformOpenshift

Provisions a spoke **OpenShift** cluster on a Cloud\* environment via AAP + Hive / MCE / Hypershift.

## Flow

```text
Cloud* ready
        → PlatformOpenshift
        → AAP JobTemplate (cluster build)
        → Hive ClusterDeployment | HostedCluster
        → ACM ManagedCluster
        → status ready / Provisioned
```

## Types

| `spec.type` | Needs | Block |
|-------------|-------|-------|
| `openstack` | CloudOSO ready | `spec.openstack.environment` |
| `aws` | CloudAWS ready | `spec.aws.environment` |
| `hosted` | CloudVirt ready | `spec.hosted.environment` |

## Examples

### OpenStack (RHOSO)

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

### AWS

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

### Hosted (Hypershift on CloudVirt)

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: pe-hosted
  namespace: entity-acme-corp
spec:
  type: hosted
  hosted:
    environment: local-virt   # or your CloudVirt name
    nodePoolReplicas: 2
```

## Status to watch

```bash
oc get platformopenshift -n entity-acme-corp
oc describe platformopenshift workshop-ocp-aws -n entity-acme-corp
# Hive / ACM
oc get clusterdeployment -A | grep workshop
oc get managedcluster | grep workshop
```

Look for `status.ready`, `status.provisionStatus`, `status.consoleURL`, `status.apiURL`.

## Deprovision

1. Delete Assignments that reference this platform.
2. Delete the PlatformOpenshift CR → teardown Job runs.
3. Confirm Hive / HostedCluster gone before deleting the Cloud\*.

## Related

- [CloudAWS](cloudaws.md) · [CloudOSO](cloudoso.md) · [CloudVirt](cloudvirt.md)
- [Assignment](team-project-assignment.md)
