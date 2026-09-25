# Spec 027: Quay Registry

**Spec ID**: `027-quay-registry`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Quay Helm + Jobs
**Namespace**: `quay / services-quay`

## Description

Red Hat Quay registry on the hub with OIDC and Postgres backend.

## CRD Schema Summary

Quay config bundle; quay-central-config and quay-services-config Jobs.

## Deployment Steps

1. Phase B3: Deploy Quay (sync-wave 35-37); run config Jobs

## Testing Guide

- Push/pull test image; verify OIDC login

## Security Considerations

- All repos private; config secret via ExternalSecret; TLS required

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
