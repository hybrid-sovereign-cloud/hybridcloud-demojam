# Spec 012: Plugin RBAC

**Spec ID**: `012-plugin-rbac`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: RbacConfig, Rbac
**Operator**: primary (RbacConfig) / namespace (Rbac)
**Namespace**: `sovereign-cloud-plugins / entity-<name>`

## Description

RbacConfig configures Keycloak realm/clients for tenant RBAC. Rbac CRs define groups with members resolved to Keycloak group paths.

## CRD Schema Summary

RbacConfig: Keycloak realm ref. Rbac: `spec.members`, `spec.description`, status.group.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `Rbac.spec.members` | []string | Keycloak usernames |
| `Rbac.status.group` | string | Resolved Keycloak group path |

## Deployment Steps

1. Apply RbacConfig first; then Rbac CRs per entity

## Testing Guide

- Apply `samples/rbacconfig/keycloak.yaml` then rbac samples

## Security Considerations

- Keycloak admin creds via ExternalSecret; group paths entity-scoped

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
