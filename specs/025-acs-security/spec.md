# Spec 025: ACS Security

**Spec ID**: `025-acs-security`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: ACS Helm + Job
**Namespace**: `stackrox`

## Description

Red Hat Advanced Cluster Security central deployment with cluster registration and OIDC integration for the hub.

## CRD Schema Summary

ACS Central CR; acs-config Job for cluster registration and OIDC.

## Deployment Steps

1. Phase B1: Deploy ACS (sync-wave 25); run acs-config Job

## Testing Guide

- Verify the hub registered; OIDC login works

## Security Considerations

- ACS admin password via ExternalSecret; network policies enforced

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
