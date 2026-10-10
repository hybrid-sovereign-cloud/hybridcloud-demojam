# Spec 011: Plugin Quay

**Spec ID**: `011-plugin-quay`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: QuayConfig, QuayOrg
**Operator**: primary (QuayConfig) / namespace (QuayOrg)
**Namespace**: `sovereign-cloud-plugins / entity-<name>`

## Description

QuayConfig configures Quay registry OIDC. QuayOrg creates entity-scoped Quay organizations.

## CRD Schema Summary

QuayConfig: registry URL, OIDC client. QuayOrg: org name, admin RBAC refs.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `QuayConfig.spec.registryUrl` | string | Quay registry base URL |
| `QuayOrg.spec.quayAdminRbac` | []string | Rbac CR names for org admins |

## Deployment Steps

1. Quay registry must be running; apply QuayConfig then QuayOrg

## Testing Guide

- Apply samples in quayconfig/ and quayorg/

## Security Considerations

- All Quay repos private; OIDC via Keycloak; no robot tokens in git

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
