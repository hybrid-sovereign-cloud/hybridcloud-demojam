# Spec 013: Plugin Vault

**Spec ID**: `013-plugin-vault`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Vault, VaultKV
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

Vault CR deploys entity-scoped Vault HA instance. VaultKV CR creates KV secret engines with OIDC auth and RBAC policies.

## CRD Schema Summary

Vault: `spec.ha`, `spec.rbacConfig`. VaultKV: engine path, admin/reader RBAC refs.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `Vault.spec.ha` | boolean | Enable HA Raft mode |
| `VaultKV.spec.path` | string | KV engine mount path |

## Deployment Steps

1. Apply Vault CR; wait for init/unseal; apply VaultKV CRs

## Testing Guide

- Apply `samples/vault/acme-vault.yaml` and vaultkv samples

## Security Considerations

- Root token/unseal keys via ExternalSecret; OIDC auth via Keycloak

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
