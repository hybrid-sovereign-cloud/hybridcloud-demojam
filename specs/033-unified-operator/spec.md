# Spec 033: Unified Operator

**Spec ID**: `033-unified-operator`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: All hybridsovereign CRDs
**Operator**: primary + namespace
**Namespace**: `sovereign-cloud / entity-<name>`

## Description

Multi-tier operator architecture consolidating 13 Ansible operators into primary (Entity + plugin configs) and per-entity namespace operators.

## CRD Schema Summary

Primary watches: Entity, RbacConfig, AAPConfig, QuayConfig. Namespace watches: Team, Assignment, Project, Persona, PlatformOpenshift, CloudOSO, CloudAWS, OpenStackMigration, Rbac, AAPOrg, QuayOrg, Vault, VaultKV.

## Deployment Steps

1. Phase C1-C2: Build primary and namespace operator images
2. Phase C3: Deploy primary operator with all CRDs
3. Phase C6: Entity creation end-to-end test

## Testing Guide

- Create Entity → verify namespace operator spawn
- Create each CR type → verify reconciliation
- Delete Entity → verify finalizer cleanup

## Security Considerations

- Primary uses ClusterRole; namespace operator uses namespace-scoped Role
- All Ansible roles use no_log for credential tasks
- AMQ event publishing for audit trail

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
