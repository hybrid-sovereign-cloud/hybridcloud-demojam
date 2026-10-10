# Spec 001: Entity Management

**Spec ID**: `001-entity-management`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Entity
**Operator**: primary
**Namespace**: `sovereign-cloud`

## Description

Entity is the top-level tenancy boundary. Creating an Entity CR triggers the primary operator to provision an `entity-<name>` namespace, deploy a namespace operator, configure namespace RBAC roles, and register the entity with Keycloak.

## CRD Schema Summary

`spec.description`, `spec.billingID`, `spec.websiteLink`, and `spec.namespaceRbac` map 14 named RBAC role keys to lists of Rbac CR names resolved at reconcile time.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `metadata.name` | string | Unique entity identifier; drives namespace name `entity-<name>` |
| `spec.description` | string | Human-readable tenant description |
| `spec.billingID` | string | Optional billing reference |
| `spec.websiteLink` | string | Optional tenant website URL |
| `spec.namespaceRbac` | map[string][]string | Role key → Rbac CR name list |
| `status.ready` | boolean | True when namespace operator is deployed and healthy |
| `status.conditions` | []Condition | Reconciliation conditions |

## Deployment Steps

1. Deploy primary operator and CRDs (sync-wave 38)
2. Apply Entity CR to `sovereign-cloud` namespace
3. Verify `entity-<name>` namespace created with `hybridsovereign.redhat/entity` label
4. Verify namespace operator Deployment is Running in entity namespace

## Testing Guide

- Apply `samples/entity/acme-corp.yaml` and verify namespace creation
- Create Team CR in entity namespace; confirm namespace operator reconciles
- Delete Entity CR and verify finalizer tears down namespace operator

## Security Considerations

- Entity CRs only in `sovereign-cloud`; cluster-admin or platform-admin required
- No credentials in Entity spec — RBAC references resolved via Rbac CR status
- Namespace isolation: each entity gets dedicated namespace operator with namespace-scoped Role

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
