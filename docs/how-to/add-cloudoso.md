# How to: add a new CloudOSO (new RHOSO cluster)

Goal: register a **new OpenStack / RHOSO** cloud so you can provision OpenShift on it.

## Prerequisites

- Entity namespace exists.
- Working `clouds.yaml` for an admin (or project admin) user on the new RHOSO.
- External network that can allocate **internet FIPs** if clusters need public API/ingress (often named `internet` or `ext-net`).
- Designate zone (or Route53 path) for DNS as used in your lab.

## Steps

### 1. Create Secret with clouds.yaml

```bash
oc create secret generic oso-clouds-<label> -n entity-<entity> \
  --from-file=clouds.yaml=/path/to/clouds.yaml
```

### 2. Create CloudOSO

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudOSO
metadata:
  name: <label>              # e.g. rhoso-east-2
  namespace: entity-<entity>
spec:
  project: <label>
  baseDomain: lab.example.com
  credentialsSecretRef:
    name: oso-clouds-<label>
  externalNetwork: internet
  projectDomain: shc_domain
  # Override if this RHOSO uses a different Designate zone:
  # designateZoneId: "<uuid>"
  # designateProjectId: "<project-id>"
  # route53VaultPath: oso/accounts/route53-openstack
```

```bash
oc apply -f cloudoso-<label>.yaml
```

### 3. Wait until ready

```bash
oc get cloudoso <label> -n entity-<entity> -w
# status.ready=true, status.domain / slug set
```

### 4. Provision OpenShift on RHOSO

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: ocp-<label>
  namespace: entity-<entity>
spec:
  type: openstack
  openstack:
    environment: <label>
    controlPlaneCount: 3
    workerCount: 3
    externalNetwork: internet
```

Monitor Hive / ClusterDeployment until Provisioned.

### 5. Assignment (optional)

Same pattern as AWS — Assignment → Team on `ocp-<label>`.

## Remove

1. Delete PlatformOpenshift(s); wait for teardown (FIPs / project resources released).
2. Delete CloudOSO.
3. Delete Secret; rotate OpenStack user password; clean Vault path.

## See also

- [CloudOSO CRD](../usage/crds/cloudoso.md)
- [Workshop lab](../workshop/README.md)
