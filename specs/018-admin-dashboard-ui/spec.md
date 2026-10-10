# Spec 018: Admin Dashboard UI

**Spec ID**: `018-admin-dashboard-ui`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Deployment
**Namespace**: `sovereign-cloud`

## Description

Standalone admin dashboard (PatternFly 5, React 18, TypeScript) for platform administrators to manage all CR types across entities.

## CRD Schema Summary

N/A — UI consumes K8s API via user OAuth token proxy.

## Deployment Steps

1. Build/push dashboard image; deploy via sovereign-dashboard Helm chart

## Testing Guide

- Login via Keycloak; verify CR list/create/edit/delete for all types

## Security Considerations

- User OAuth token only; RBAC-aware UI hiding forbidden actions

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
