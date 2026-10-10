# Spec 010: Plugin AAP

**Spec ID**: `010-plugin-aap`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: AAPConfig, AAPOrg
**Operator**: primary (AAPConfig) / namespace (AAPOrg)
**Namespace**: `sovereign-cloud-plugins / entity-<name>`

## Description

AAPConfig configures the AAP controller connection and OIDC. AAPOrg creates entity-scoped AAP organizations with RBAC group mappings.

## CRD Schema Summary

AAPConfig: `spec.secret`, `spec.rbacConfig`. AAPOrg: org name, admin/executor RBAC refs.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `AAPConfig.spec.secret` | string | K8s Secret name for AAP admin creds (ExternalSecret) |
| `AAPOrg.spec.aapAdminRbac` | []string | Rbac CR names for org admins |

## Deployment Steps

1. Deploy AAPConfig in plugins namespace; AAPOrg per entity

## Testing Guide

- Apply `samples/aapconfig/aap-sovereign-services.yaml` and `samples/aaporg/acme-corp.yaml`

## Security Considerations

- AAP credentials via ExternalSecret from Vault; entity-prefixed org names

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
