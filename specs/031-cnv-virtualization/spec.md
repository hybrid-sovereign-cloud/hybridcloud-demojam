# Spec 031: CNV Virtualization

**Spec ID**: `031-cnv-virtualization`
**API Group**: `hco.kubevirt.io/v1beta1`
**Kind**: HyperConverged
**Operator**: CNV
**Namespace**: `openshift-cnv`

## Description

OpenShift Virtualization (CNV) for VM workloads; deployed alongside ODF.

## CRD Schema Summary

HyperConverged CR enabling KubeVirt with storage class integration.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `HyperConverged.spec.storageClassName` | string | Default storage class |

## Deployment Steps

1. Phase A3: Deploy CNV after ODF

## Testing Guide

- Verify HyperConverged Available; launch test VM

## Security Considerations

- SCC restrictions; network policies for VM workloads

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
