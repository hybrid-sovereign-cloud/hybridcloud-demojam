# CloudInfrastructure

Registers a **cloud site** the platform owns: an OpenStack site, the hub's OpenShift Virtualization, or an AWS account. It holds the site's admin credentials and infrastructure references, so tenant objects never carry them.

- Lives in the platform namespace `sovereign-cloud`. Platform admins only.
- Tenant cloud projects ([CloudOSO](cloudoso.md), [CloudVirt](cloudvirt.md), [CloudAWS](cloudaws.md)) point at it with `spec.cloudRef`.
- A [CloudGateway](fabric.md#cloudgateway) attaches the site to the HybridFabric with `spec.cloudRef`.
- Reconciled by the `CloudInfrastructure` operator, which runs the AAP job templates `cloudinfrastructure-provision` / `cloudinfrastructure-teardown`.

## Flow

```text
Vault path or Secret (admin credentials)
        → CloudInfrastructure (sovereign-cloud)
        → provision job: checks credentials and site prerequisites
        → status.ready + status.capabilities
        → tenant Cloud* projects (cloudRef) / CloudGateway (cloudRef)
```

The provision job only checks the site; it does not change it. For `openstack` it reads the management kubeconfig and confirms the NetConfig and NodeSets exist. For `openshift` it confirms OpenShift Virtualization and the fabric prerequisites.

## Spec

`spec.type` selects exactly one typed section. The API rejects an object where the section does not match the type, and `spec.type` cannot change after creation.

| Field | Type | Notes |
|-------|------|-------|
| `type` | `openstack` \| `openshift` \| `aws` | **Required**, immutable |
| `displayName` | string | Console label |
| `credentialsRef.vaultPath` / `credentialsRef.secretRef.name` | string | Exactly one when `credentialsRef` is set. openstack: key `clouds.yaml`; aws: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; openshift with `clusterRef: local` needs none |
| `entityRefs[].name` | string | Entities allowed to reference this site; empty means all |
| `openstack.region` | string | Default `regionOne` |
| `openstack.managementClusterKubeconfigRef` | string | Vault KV path (key `kubeconfig`) of the cluster running the OpenStack control plane. Default `oso/<name>/mgmt-kubeconfig` |
| `openstack.netConfigRef` | string | Default `openstacknetconfig` |
| `openstack.dataplaneNodeSetRefs[]` | string | Unique, ordered: the fabric is rolled out one NodeSet at a time in this order |
| `openstack.externalNetwork`, `baseDomain`, `projectDomain` | string | Site defaults for tenant projects |
| `openstack.designate.{zoneId,projectId}`, `openstack.route53VaultPath` | string | DNS |
| `openshift.clusterRef` | string | Default `local` (the hub) |
| `openshift.bootImage` | string | Default `docker://quay.io/containerdisks/centos-stream:9` |
| `openshift.storageClass` | string | VM disks |
| `openshift.hostedClusterCidrDefaults.{clusterNetworkPool,serviceNetworkPool}.{cidr,blockPrefixLength}` | CIDR, int | Defaults `100.64.0.0/11`/14 and `100.96.0.0/11`/16 (CG-NAT) |
| `aws.accountId` | string (12 digits) | Required for type aws |
| `aws.region` | string | Required for type aws |
| `aws.baseDomain` | string | Parent Route53 domain |

## Examples

OpenStack site:

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudInfrastructure
metadata:
  name: example-openstack
  namespace: sovereign-cloud
spec:
  type: openstack
  displayName: Example OpenStack site
  credentialsRef:
    vaultPath: oso/accounts/example-admin
  openstack:
    region: regionOne
    managementClusterKubeconfigRef: oso/example-openstack/mgmt-kubeconfig
    netConfigRef: openstacknetconfig
    dataplaneNodeSetRefs:
      - openstack-compute01
    externalNetwork: ext-net
```

Hub OpenShift Virtualization:

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudInfrastructure
metadata:
  name: hub-virt
  namespace: sovereign-cloud
spec:
  type: openshift
  displayName: Hub OpenShift Virtualization
  openshift:
    clusterRef: local
    storageClass: ocs-external-storagecluster-ceph-rbd
```

More: `samples/cloudinfrastructure/`. The live registrations are in `gitops/apps/platform-fabric/templates/cloud-infrastructure.yaml`.

## Status

| Field | Meaning |
|-------|---------|
| `status.ready`, `status.status`, `status.message`, `status.conditions[]` | Lifecycle |
| `status.capabilities` | Map of booleans: `evpn`, `virtualization`, `frrK8s`, `dataplane`, `openstackApi` |
| `status.site` | `endpoint`, `region`, `version`, `dataplaneNodeSets[]{name,ready}` |

```bash
oc get cloudinfrastructure -n sovereign-cloud
oc get cinfra hub-virt -n sovereign-cloud -o jsonpath='{.status.capabilities}'
```

## Deletion

Delete the tenant projects and the CloudGateway that reference the site first.
