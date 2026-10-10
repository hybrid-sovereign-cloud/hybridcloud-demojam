# Spec 005: Persona Management

**Spec ID**: `005-persona-management`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Persona
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

Persona CRs define reusable permission bundles (platform-admin, cloud-viewer, etc.) mapped to Rbac CR references for Keycloak group assignment.

## CRD Schema Summary

`spec.description`, `spec.rbacRefs` listing Rbac CR names for the persona.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `metadata.name` | string | Persona identifier |
| `spec.rbacRefs` | []string | Rbac CR names included in persona |

## Deployment Steps

1. Apply Persona CR after Rbac CRs exist

## Testing Guide

- Apply `samples/persona/platform-admin.yaml`

## Security Considerations

- IdentityAdmin required to manage personas

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
