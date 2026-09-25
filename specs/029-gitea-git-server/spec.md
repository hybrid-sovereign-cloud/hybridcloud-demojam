# Spec 029: Gitea Git Server

**Spec ID**: `029-gitea-git-server`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Gitea Helm + Jobs
**Namespace**: `gitea`

## Description

Gitea git server on hub for IAAC sync, cluster builds, and tenancy repo.

## CRD Schema Summary

Gitea Helm values; gitea-init and gitea-create-repo Jobs.

## Deployment Steps

1. Phase B4: Deploy Gitea (sync-wave 18, 35-36); run init Jobs

## Testing Guide

- Verify Gitea accessible; tenancy_repo exists; IAAC syncs CRs

## Security Considerations

- Admin token stored in Vault via gitea-init Job

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
