# Spec 019: Tenant Dashboard UI

**Spec ID**: `019-tenant-dashboard-ui`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Deployment
**Namespace**: `sovereign-cloud`

## Description

Tenant-scoped dashboard for entity admins and developers to manage teams, projects, clouds, and assignments within their entity.

## CRD Schema Summary

N/A — scoped to user's entity namespace via RBAC.

## Deployment Steps

1. Deploy tenancy-dashboard chart on hub

## Testing Guide

- Login as tenant user; verify entity scoping and CRUD permissions

## Security Considerations

- 14 named RBAC roles enforced; no cross-entity data leakage

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
