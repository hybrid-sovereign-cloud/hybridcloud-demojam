# How to: add a new CloudVirt (new virt cluster)

Goal: register a **new OpenShift Virtualization (CNV)** cluster so you can create **hosted** PlatformOpenshift (Hypershift HCP) on it.

## Prerequisites

- Entity namespace exists.
- Target cluster has CNV (OpenShift Virtualization) and suitable StorageClass.
- Hub has MCE / Hypershift for HostedClusters.
- Credentials (kubeconfig or tooling) stored in **Vault** at a path you choose — never in Git.

## Steps

### 1. Seed Vault

Push kubeconfig / virt admin material to Vault (PushSecret or vault CLI), e.g.:

`virt/accounts/<label>`

### 2. Create CloudVirt

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudVirt
metadata:
  name: <label>                 # e.g. virt-west-1
  namespace: entity-<entity>
spec:
  vaultPath: virt/accounts/<label>
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

```bash
oc apply -f cloudvirt-<label>.yaml
oc get cloudvirt <label> -n entity-<entity> -w
```

Wait for `status.ready=true`.

### 3. Hub local CNV (already present)

If you only need the **hub** cluster’s CNV, use existing GitOps CR `local-virt` (`gitops/apps/platform-smoke`). Skip creating a duplicate unless you need a second logical environment.

### 4. Create hosted PlatformOpenshift

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: ocp-hosted-<label>
  namespace: entity-<entity>
spec:
  type: hosted
  hosted:
    environment: <label>
    nodePoolReplicas: 2
    # releaseImage: quay.io/openshift-release-dev/ocp-release:...  # optional
```

Requires pull-secret in `openshift-config` on the hub. Watch HostedCluster / NodePool until Available.

### 5. Assignment (optional)

Point Assignment `openshift:` at the hosted PlatformOpenshift name.

## Remove

1. Delete hosted PlatformOpenshift(s); wait for HostedCluster cleanup.
2. Delete CloudVirt (except do not remove GitOps-owned `local-virt` via ad-hoc delete if Argo manages it — change Git).
3. Rotate Vault path secrets.

## See also

- [CloudVirt CRD](../usage/crds/cloudvirt.md)
- [PlatformOpenshift](../usage/crds/platformopenshift.md)
- [Workshop lab](../workshop/README.md)
