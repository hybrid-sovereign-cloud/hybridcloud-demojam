# Spec 021: Tenant Console Plugin

**Spec ID**: `021-tenant-console-plugin`
**API Group**: `console.openshift.io/v1`
**Kind**: ConsolePlugin
**Operator**: Helm chart
**Namespace**: `sovereign-cloud`

## Description

OpenShift console plugin for tenant-scoped resource management.

## CRD Schema Summary

ConsolePlugin CR with tenant-scoped API proxy.

## Deployment Steps

1. Deploy sovereign-tenant-plugin chart

## Testing Guide

- Verify tenant pages render in console with correct RBAC

## Security Considerations

- Same token-only policy as admin plugin

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
