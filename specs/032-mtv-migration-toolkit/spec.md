# Spec 032: MTV Migration Toolkit

**Spec ID**: `032-mtv-migration-toolkit`
**API Group**: `forklift.konveyor.io/v1beta1`
**Kind**: Provider
**Operator**: MTV
**Namespace**: `openshift-mtv`

## Description

Migration Toolkit for Virtualization for VMware inventory discovery and migration planning integrated with OpenStackMigration CRs.

## CRD Schema Summary

Provider CR for VMware; StorageMap, NetworkMap for target CloudOSO.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `Provider.spec.url` | string | vCenter URL (from Vault) |
| `Provider.spec.secret` | objectRef | Credentials secret reference |

## Deployment Steps

1. Phase B6: Deploy MTV (sync-wave 28); vmware-init and mtv-catalog-sync Jobs

## Testing Guide

- Verify Provider Ready; VM inventory populated

## Security Considerations

- VMware creds in Vault; MTV namespace isolated

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
