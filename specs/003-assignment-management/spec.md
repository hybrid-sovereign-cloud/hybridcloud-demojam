# Spec 003: Assignment Management

**Spec ID**: `003-assignment-management`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Assignment
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

Assignment binds Teams to PlatformOpenshift clusters with scoped RBAC. Creates ACM ManagedClusterSetBinding and cluster-scoped RBAC on hub.

## CRD Schema Summary

`spec.team`, `spec.platform`, `spec.clusterRbac` map cluster roles to Rbac CR names.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `spec.team` | string | Team CR name |
| `spec.platform` | string | PlatformOpenshift CR name |
| `spec.clusterRbac` | map[string][]string | Cluster role → Rbac CR names |
| `status.ready` | boolean | Assignment active on target cluster |

## Deployment Steps

1. Prerequisites: Team, PlatformOpenshift, Rbac CRs exist and ready
2. Apply Assignment CR to entity namespace
3. Verify hub RBAC and ManagedClusterSetBinding

## Testing Guide

- Apply `samples/assignment/ses12-platform-eng.yaml` after ocp-ses12 is ready
- Verify ACM binding and cluster role bindings on the hub

## Security Considerations

- AssignmentAdmin RBAC required to create/modify
- Hub SA token delivered via PushSecret from Vault — never in git

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
