# CloudOSO

Registers a **Red Hat OpenStack Services on OpenShift (RHOSO)** / OpenStack cloud for an entity (project prep, Designate DNS, Vault).

## Flow

```text
Secret (clouds.yaml) in entity NS
        → CloudOSO (credentialsSecretRef or vaultPath)
        → AAP / OSOHelper environmentprep
        → status.slug + domain + VIPs + ready
        → PlatformOpenshift type=openstack can use it
```

## Minimal example (Secret ref — preferred)

```yaml
# 1) Secret — key must be clouds.yaml
apiVersion: v1
kind: Secret
metadata:
  name: oso-clouds-new
  namespace: entity-acme-corp
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
  namespace: entity-acme-corp
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
| `spec.project` | OpenStack project hint |
| `spec.baseDomain` | DNS base for clusters |
| `spec.credentialsSecretRef` | Secret with key `clouds.yaml` |
| `spec.vaultPath` | Alt: Vault path for clouds.yaml |
| `spec.externalNetwork` | Neutron external net (use internet FIPs when required) |
| `spec.route53VaultPath` | Optional Route53 helper creds |
| `spec.designateZoneId` | Designate zone UUID |
| `spec.enableVRF` / `vrfId` | Future VRF flag |

## Status to wait for

- `status.ready: true`
- `status.domain`, `status.slug`
- Helper created: `status.osoHelperCreated`

```bash
oc get cloudoso workshop-oso -n entity-acme-corp -o yaml
```

## Next

Create [PlatformOpenshift](platformopenshift.md) with `spec.type: openstack` and `spec.openstack.environment: workshop-oso`.

Full procedure: [how-to/add-cloudoso.md](../../how-to/add-cloudoso.md).
