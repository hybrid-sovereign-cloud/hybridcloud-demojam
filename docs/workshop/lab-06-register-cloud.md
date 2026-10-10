# Lab 6 — Register a cloud

Two roles, two steps:

1. **Track 0 (platform admin):** register the cloud *infrastructure* once per site, as a `CloudInfrastructure` in `sovereign-cloud`. It holds the site's admin credentials and infrastructure references.
2. **Tracks A/B/C (tenant):** create a cloud *project* in your entity namespace that points at that infrastructure with `spec.cloudRef`. Tenant objects never carry site admin credentials.

```text
CloudInfrastructure (sovereign-cloud, platform)  ──cloudRef──  CloudOSO / CloudVirt / CloudAWS (entity-<name>, tenant)
```

Reference: [CloudInfrastructure](../reference/crds/cloudinfrastructure.md) · [CloudOSO](../reference/crds/cloudoso.md) · [CloudVirt](../reference/crds/cloudvirt.md) · [CloudAWS](../reference/crds/cloudaws.md). Replace `entity-acme-corp` if your entity differs.

## Track 0 — Register cloud infrastructure (platform admin)

On the reference hub the platform GitOps app already registers two sites (`gitops/apps/platform-fabric/templates/cloud-infrastructure.yaml`):

| Name | `spec.type` | What it is |
|------|-------------|------------|
| `oso1` | `openstack` | The RHOSO site: admin credentials, the management cluster kubeconfig (Vault), NetConfig and the data plane NodeSets the fabric rolls out to |
| `hub-virt` | `openshift` | OpenShift Virtualization on the hub itself (`clusterRef: local`): boot image, storage class, CG-NAT defaults for hosted clusters |

Check them:

```bash
oc get cloudinfrastructure -n sovereign-cloud
oc get cinfra oso1 -n sovereign-cloud -o jsonpath='{.status.capabilities}{"\n"}'
oc get cinfra hub-virt -n sovereign-cloud -o jsonpath='{.status.capabilities}{"\n"}'
```

**Pass:** both `READY=true`; `oso1` reports `openstackApi` and `dataplane`, `hub-virt` reports `virtualization` (and `frrK8s` / `evpn` once the hub network operator has the FRR provider, see Lab 9).

### Register a site yourself (fresh hub or extra site)

Admin credentials go into the platform namespace, never into Git. For an OpenStack site, store the admin `clouds.yaml` (key `clouds.yaml`) as a Secret in `sovereign-cloud` (or in Vault and use `credentialsRef.vaultPath`):

```bash
oc -n sovereign-cloud create secret generic workshop-openstack-admin \
  --from-file=clouds.yaml="$HOME/Downloads/clouds.yaml"
```

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudInfrastructure
metadata:
  name: workshop-openstack
  namespace: sovereign-cloud
spec:
  type: openstack
  displayName: Workshop OpenStack site
  credentialsRef:
    secretRef:
      name: workshop-openstack-admin
  entityRefs:
    - name: acme-corp              # entities allowed to use the site; empty = all
  openstack:
    region: regionOne
    externalNetwork: public
    baseDomain: lab.example.com
    # Only needed when the site attaches to the hybrid fabric (Lab 9):
    # managementClusterKubeconfigRef: oso/workshop-openstack/mgmt-kubeconfig   # Vault, key "kubeconfig"
    # netConfigRef: openstacknetconfig
    # dataplaneNodeSetRefs: [openstack-compute01]                              # rolled out in this order
```

Hub OpenShift Virtualization needs no credentials (`clusterRef: local`):

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudInfrastructure
metadata:
  name: workshop-virt-infra
  namespace: sovereign-cloud
spec:
  type: openshift
  displayName: Hub OpenShift Virtualization
  openshift:
    clusterRef: local
    bootImage: docker://quay.io/containerdisks/centos-stream:9
    storageClass: ocs-external-storagecluster-ceph-rbd
```

More shapes (including `type: aws`): `samples/cloudinfrastructure/example-openstack.yaml`, `example-virt.yaml`, `example-aws.yaml`.

```bash
oc apply -f cloudinfra.yaml
oc get cloudinfrastructure -n sovereign-cloud -w
```

`spec.type` is immutable and selects exactly one typed section; the API rejects an object whose section does not match. The provision job only *checks* the site (credentials, NetConfig/NodeSets, OpenShift Virtualization); it changes nothing there.

## Track A — CloudAWS

A CloudAWS project can use a platform AWS account (`cloudRef` to a CloudInfrastructure of type `aws`) or, as before, its own credentials Secret.

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudAWS
metadata:
  name: workshop-aws
  namespace: entity-acme-corp
spec:
  account: "YOUR_ACCOUNT_ID"
  baseDomain: YOUR_PARENT_DOMAIN     # parent Route53 zone you control
  cloudRef:
    kind: CloudInfrastructure
    name: example-aws                # in sovereign-cloud; its credentials are used
  # Without cloudRef: credentialsSecretRef: {name: workshop-aws-creds}
  #   (Secret with AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / ACCOUNT_ID in this namespace)
```

```bash
oc apply -f workshop-aws.yaml
oc get cloudaws workshop-aws -n entity-acme-corp -w
```

**Pass:** `status.ready=true` and `status.domain` set. AWS projects run clusters (Lab 7) but carry no fabric VRFs.

## Track B — CloudOSO

A tenant OpenStack project on the `oso1` site. The site's admin credentials, region and external network come from the CloudInfrastructure; the job creates the Keystone project, an application credential and a per-project `clouds.yaml` in Vault.

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudOSO
metadata:
  name: workshop-oso
  namespace: entity-acme-corp
spec:
  cloudRef:
    kind: CloudInfrastructure
    name: oso1
  project: workshop-oso
  baseDomain: lab.example.com
```

```bash
oc apply -f workshop-oso.yaml
oc get cloudoso workshop-oso -n entity-acme-corp -w
```

**Pass:** `status.ready=true`.

## Track C — CloudVirt

A tenant project on the hub's OpenShift Virtualization. Each entity on the reference hub already has one, `local-virt`, on `hub-virt`:

```bash
oc get cloudvirt local-virt -n entity-acme-corp -o jsonpath='{.spec.cloudRef.name}{" "}{.status.ready}{"\n"}'
# hub-virt true
```

Or create your own:

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudVirt
metadata:
  name: workshop-virt
  namespace: entity-acme-corp
spec:
  cloudRef:
    kind: CloudInfrastructure
    name: hub-virt
  baseDomain: virt.example.com
  storageClass: ocs-external-storagecluster-ceph-rbd
  vmNamespaceQuota:                  # applied to every VM namespace a NetworkPlacement creates
    hard:
      requests.cpu: "16"
      requests.memory: 64Gi
```

**Pass:** `status.ready=true`. A CloudVirt is both the environment for hosted clusters (Lab 7) and a fabric backend for tenant VMs (Lab 9).

The older per-project credentials (`credentialsSecretRef` / `vaultPath` on CloudOSO and CloudVirt) still work while `cloudRef` is unset, but are deprecated; see [add-cloudoso](../how-to/add-cloudoso.md) · [add-cloudvirt](../how-to/add-cloudvirt.md) · [add-cloudaws](../how-to/add-cloudaws.md).

→ [Lab 7 — Provision a spoke cluster](lab-07-provision-platform.md)
