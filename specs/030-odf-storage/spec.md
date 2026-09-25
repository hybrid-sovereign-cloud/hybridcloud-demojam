# Spec 030: ODF Storage

**Spec ID**: `030-odf-storage`
**API Group**: `ocs.openshift.io/v1`
**Kind**: StorageCluster
**Operator**: ODF
**Namespace**: `openshift-storage`

## Description

OpenShift Data Foundation providing Noobaa object storage and Ceph-backed PVCs.

## CRD Schema Summary

StorageCluster CR: mode, resources, encryption, multiCloudGateway.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `StorageCluster.spec.multiCloudGateway` | object | Noobaa gateway config |

## Deployment Steps

1. Phase A3: Deploy ODF (sync-wave 12) on the hub

## Testing Guide

- Verify Noobaa running; test PVC and object bucket claim

## Security Considerations

- Encryption at rest; KMS integration via Vault optional

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
