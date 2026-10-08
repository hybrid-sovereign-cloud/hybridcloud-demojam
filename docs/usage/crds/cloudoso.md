# CloudOSO

A tenant **OpenStack project** on a platform-registered OpenStack site ([CloudInfrastructure](cloudinfrastructure.md) of type `openstack`). It creates the Keystone project, an application credential and a per-project clouds.yaml in Vault (`oso/projects/<name>/clouds-config`), plus Designate DNS.

## Flow

```text
CloudInfrastructure (type openstack, sovereign-cloud, platform admin)
        → CloudOSO (entity NS, spec.cloudRef)
        → AAP / OSOHelper environmentprep
        → status.slug + domain + VIPs + ready
        → PlatformOpenshift type=openstack, or NetworkPlacement backend
```

## Minimal example

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudOSO
metadata:
  name: workshop-oso
  namespace: entity-example-corp
spec:
  cloudRef:
    kind: CloudInfrastructure
    name: example-openstack      # in sovereign-cloud
  project: workshop-oso
  baseDomain: lab.example.com
```

The admin credentials, region, external network and site details come from the CloudInfrastructure.

## Legacy example (own credentials, deprecated)

Before CloudInfrastructure, each CloudOSO carried admin credentials. This still works while `spec.cloudRef` is unset, but it is deprecated.

```yaml
# 1) Secret — key must be clouds.yaml
apiVersion: v1
kind: Secret
metadata:
  name: oso-clouds-new
  namespace: entity-example-corp
type: Opaque
stringData:
  clouds.yaml: |
    clouds:
      openstack:
        auth:
          auth_url: https://keystone.example:5000/v3
          username: admin
          password: "..."
          project_name: admin
          user_domain_name: Default
          project_domain_name: Default
        region_name: regionOne
        interface: public
        identity_api_version: 3
---
# 2) CloudOSO
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudOSO
metadata:
  name: workshop-oso
  namespace: entity-example-corp
spec:
  project: workshop-oso
  baseDomain: lab.example.com
  credentialsSecretRef:
    name: oso-clouds-new
  externalNetwork: internet          # or ext-net — must allow FIPs to internet if needed
  projectDomain: shc_domain
  # route53VaultPath: oso/accounts/route53-openstack
  # designateZoneId / designateProjectId — lab defaults exist; override for new zones
```

## Important fields

| Field | Meaning |
|-------|---------|
| `spec.cloudRef.name` | CloudInfrastructure (type openstack) in `sovereign-cloud` |
| `spec.project` | OpenStack project hint |
| `spec.baseDomain` | DNS base for clusters |
| `spec.projectDomain` | Keystone domain |
| `spec.externalNetwork` | Neutron external net (use internet FIPs when required) |
| `spec.route53VaultPath` | Optional Route53 helper creds |
| `spec.designateZoneId` / `designateProjectId` | Designate zone |
| `spec.credentialsSecretRef` / `spec.vaultPath` | Deprecated: own admin credentials, used only without `cloudRef` |
| `spec.managementClusterKubeconfigRef`, `dataplaneNodeSetRefs`, `netConfigRef`, `enableVRF`, `vrfId` | Deprecated: site settings moved to CloudInfrastructure; removed when validation is tightened |

## Status to wait for

- `status.ready: true`
- `status.domain`, `status.slug`
- Helper created: `status.osoHelperCreated`

```bash
oc get cloudoso workshop-oso -n entity-example-corp -o yaml
```

## Next

Create [PlatformOpenshift](platformopenshift.md) with `spec.type: openstack` and `spec.openstack.environment: workshop-oso`.

Full procedure: [how-to/add-cloudoso.md](../../how-to/add-cloudoso.md).
