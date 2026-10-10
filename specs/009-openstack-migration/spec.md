# Spec 009: OpenStack Migration

**Spec ID**: `009-openstack-migration`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: OpenStackMigration
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

OpenStackMigration CR triggers VMware-to-OpenStack VM migration via os_migrate.vmware_migration_kit playbooks executed by EDA.

## CRD Schema Summary

Migration source (VMware), target CloudOSO project, VM inventory, network/flavor maps.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `spec.source` | object | VMware vCenter connection (Vault ref) |
| `spec.target` | object | CloudOSO project reference |
| `spec.vms` | []string | VM names to migrate |

## Deployment Steps

1. Prerequisites: CloudOSO ready, MTV operator, conversion host deployed

## Testing Guide

- Apply `samples/openstackmigration/website.yaml` in test entity

## Security Considerations

- VMware and OpenStack creds in Vault only; migration logs to S3 via PushSecret

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
