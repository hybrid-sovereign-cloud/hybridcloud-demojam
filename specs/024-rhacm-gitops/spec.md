# Spec 024: RHACM GitOps

**Spec ID**: `024-rhacm-gitops`
**API Group**: `apps.open-cluster-management.io/v1beta1`
**Kind**: GitOpsCluster
**Operator**: RHACM
**Namespace**: `open-cluster-management`

## Description

Advanced Cluster Management with GitOpsCluster pull model syncing hub applications from the hub ArgoCD.

## CRD Schema Summary

GitOpsCluster CR: ArgoCD server ref, managed cluster, placement rules.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `GitOpsCluster.spec.argocdServer` | object | Central ArgoCD reference |
| `GitOpsCluster.spec.placement` | object | Cluster placement |

## Deployment Steps

1. Phase A4: Deploy RHACM; import hub
2. Phase F: Create GitOpsCluster CR

## Testing Guide

- Verify GitOpsCluster Connected; services apps sync via ACM

## Security Considerations

- ArgoCD credentials via Vault; least-privilege ManagedCluster RBAC

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
