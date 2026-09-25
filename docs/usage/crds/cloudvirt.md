# CloudVirt

Registers an **OpenShift Virtualization (CNV)** environment used as the target for **hosted** PlatformOpenshift (Hypershift HCP + KubeVirt workers).

## Flow

```text
Vault path (or adopt local CNV)
        → CloudVirt
        → status.ready
        → PlatformOpenshift type=hosted refs this CloudVirt
```

## Minimal example (new remote virt cluster)

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudVirt
metadata:
  name: workshop-virt
  namespace: entity-acme-corp
spec:
  vaultPath: virt/accounts/workshop-virt   # kubeconfig / tooling creds in Vault
  baseDomain: virt.example.com
  storageClass: ocs-external-storagecluster-ceph-rbd
  enableVRF: false
  toolRbac:
    environmentAdminRbac:
      - acme-platform-admins
    environmentPoweruserRbac:
      - acme-infra-team
    environmentViewerRbac:
      - acme-viewers
```

## Local CNV (hub cluster)

The platform ships a GitOps sample `local-virt` on the hub CNV:

See `gitops/apps/platform-smoke/templates/cloudvirt-local.yaml`.

## Important fields

| Field | Meaning |
|-------|---------|
| `spec.vaultPath` | Vault KV for virt credentials |
| `spec.baseDomain` | Parent DNS for hosted clusters |
| `spec.storageClass` | Disk StorageClass for VMs / etcd |
| `spec.networkAttachment` | Optional NAD |
| `spec.enableVRF` / `vrfId` | Design-time VRF flags |

## Status to wait for

- `status.ready: true`
- `status.domain` / `status.slug` when provisioned

```bash
oc get cloudvirt workshop-virt -n entity-acme-corp -o yaml
```

## Next

Create [PlatformOpenshift](platformopenshift.md) with `spec.type: hosted` and `spec.hosted.environment: workshop-virt`.

Full procedure: [how-to/add-cloudvirt.md](../../how-to/add-cloudvirt.md).
