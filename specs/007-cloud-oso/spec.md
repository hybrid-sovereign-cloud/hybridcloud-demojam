# Spec 007: CloudOSO (OpenStack)

**Spec ID**: `007-cloud-oso`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: CloudOSO
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

CloudOSO provisions an OpenStack project/environment for the entity. Creates OSOHelper type:environmentprep Job on central cluster.

Credentials are supplied either via UI (`clouds.yaml` stored as a namespaced `Secret`, referenced by `spec.credentialsSecretRef`) or via Vault (`spec.vaultPath`). Credentials are never inlined on the CR.

## CRD Schema Summary

`spec.project`, `spec.baseDomain`, `spec.projectDomain`, `spec.externalNetwork`, `spec.credentialsSecretRef` or `spec.vaultPath`, `spec.route53VaultPath`.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `spec.project` | string | OpenStack project name hint |
| `spec.baseDomain` | string | DNS base domain for cluster routes |
| `spec.externalNetwork` | string | OpenStack external network name |
| `spec.credentialsSecretRef.name` | string | Secret in the entity namespace with key `clouds.yaml` |
| `spec.vaultPath` | string | Vault path for OpenStack credentials (fallback when credentialsSecretRef is unset) |
| `spec.route53VaultPath` | string | Vault path for Route53 DNS credentials |

## UI / Console

Create CloudOSO forms accept a `clouds.yaml` textarea. On submit the UI creates `{name}-openstack-credentials` Secret in the entity namespace, then sets `spec.credentialsSecretRef.name` on the CR.

## Deployment Steps

1. Apply CloudOSO CR (with credentialsSecretRef or vaultPath); wait for environmentprep Job completion

## Testing Guide

- Apply `samples/cloudoso/ses12-env.yaml`
- From UI: create CloudOSO with clouds.yaml; confirm Secret exists and CR references it

## Security Considerations

- OpenStack credentials stored as `kind: Secret` in the entity namespace (UI path) or Vault (fallback)
- DNS creds via route53VaultPath

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
