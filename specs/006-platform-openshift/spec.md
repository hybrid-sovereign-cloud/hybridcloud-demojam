# Spec 006: Platform OpenShift

**Spec ID**: `006-platform-openshift`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: PlatformOpenshift
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

PlatformOpenshift provisions OpenShift clusters on OpenStack (CloudOSO) or AWS (CloudAWS). Creates ClusterBuild CR on hub and monitors installation.

## CRD Schema Summary

`spec.type` (openstack|aws), `spec.openstack` or `spec.aws` blocks with environment, flavor, and node counts.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `spec.type` | string | openstack or aws |
| `spec.openstack.environment` | string | CloudOSO CR name |
| `spec.openstack.controlPlaneCount` | integer | Control plane nodes |
| `spec.openstack.workerCount` | integer | Worker nodes |
| `status.ready` | boolean | Cluster installed and accessible |

## Deployment Steps

1. Prerequisite: CloudOSO or CloudAWS status.ready == true
2. Apply PlatformOpenshift CR
3. Monitor ClusterBuild on hub

## Testing Guide

- Apply `samples/platformopenshift/ocp-ses12.yaml` after ses12-env ready

## Security Considerations

- OpenStack/AWS credentials from Vault only
- Cluster kubeconfig stored in Vault via PushSecret

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
