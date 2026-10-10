# Spec 002: Team Management

**Spec ID**: `002-team-management`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Team
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

Team CRs represent organizational units within an entity. The namespace operator reconciles Team membership, Keycloak group bindings, and RBAC references.

## CRD Schema Summary

`spec.description`, `spec.members` (Keycloak usernames), and optional RBAC role bindings.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `metadata.name` | string | Team name within entity |
| `spec.description` | string | Team description |
| `spec.members` | []string | Keycloak usernames |
| `status.ready` | boolean | Reconciliation complete |

## Deployment Steps

1. Prerequisite: Entity CR reconciled, entity namespace exists
2. Apply Team CR to entity namespace
3. Verify Keycloak group created/updated via RbacConfig integration

## Testing Guide

- Apply `samples/team/alpha.yaml` in entity-acme-corp
- Verify status.ready and Keycloak group membership

## Security Considerations

- TeamAdmin/TeamView RBAC enforced via Entity namespaceRbac mapping
- Dashboard uses user OAuth token, not service account

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
