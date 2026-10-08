# CloudVirt

A tenant project on a platform-registered **OpenShift Virtualization (CNV)** site ([CloudInfrastructure](cloudinfrastructure.md) of type `openshift`). Targets: tenant VMs attached to a HybridNetwork (NetworkPlacement backend) and **hosted** PlatformOpenshift (Hypershift HCP + KubeVirt workers).

## Flow

```text
CloudInfrastructure (type openshift, sovereign-cloud, platform admin)
        → CloudVirt (entity NS, spec.cloudRef)
        → status.ready
        → NetworkPlacement backend (VM namespaces on the fabric)
        → PlatformOpenshift type=hosted refs this CloudVirt
```

## Minimal example

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudVirt
metadata:
  name: workshop-virt
  namespace: entity-example-corp
spec:
  cloudRef:
    kind: CloudInfrastructure
    name: hub-virt                         # in sovereign-cloud
  baseDomain: virt.example.com
  storageClass: ocs-external-storagecluster-ceph-rbd
  vmNamespaceQuota:                        # optional, per VM namespace
    hard:
      requests.cpu: "16"
      requests.memory: 64Gi
  toolRbac:
    environmentAdminRbac:
      - example-platform-admins
    environmentPoweruserRbac:
      - example-infra-team
    environmentViewerRbac:
      - example-viewers
```

## Local CNV (hub cluster)

The platform registers the hub CNV as CloudInfrastructure `hub-virt` (`gitops/apps/platform-fabric/templates/cloud-infrastructure.yaml`). Each entity gets a CloudVirt `local-virt` on it: `gitops/apps/platform-smoke/templates/cloudvirt-local.yaml` (acme-corp) and `gitops/apps/platform-fabric/templates/entity-chad.yaml` (chad).

VMs join a tenant VRF through a [NetworkPlacement](fabric.md#networkplacement) with `backend.kind: CloudVirt`; the operator creates the VM namespaces listed in `spec.vmNamespaces`.

## Important fields

| Field | Meaning |
|-------|---------|
| `spec.cloudRef.name` | CloudInfrastructure (type openshift) in `sovereign-cloud` |
| `spec.baseDomain` | Parent DNS for hosted clusters (required) |
| `spec.storageClass` | Disk StorageClass for VMs / etcd |
| `spec.vmNamespaceQuota.hard` | ResourceQuota for each VM namespace a placement creates |
| `spec.networkAttachment` | Optional NAD |
| `spec.vaultPath`, `hostedClusterCidrDefaults`, `enableVRF`, `vrfId` | Deprecated (CIDR defaults moved to CloudInfrastructure); removed when validation is tightened |

## Status to wait for

- `status.ready: true`
- `status.domain` / `status.slug` when provisioned

```bash
oc get cloudvirt workshop-virt -n entity-example-corp -o yaml
```

## Next

Create [PlatformOpenshift](platformopenshift.md) with `spec.type: hosted` and `spec.hosted.environment: workshop-virt`.

Full procedure: [how-to/add-cloudvirt.md](../../how-to/add-cloudvirt.md).
