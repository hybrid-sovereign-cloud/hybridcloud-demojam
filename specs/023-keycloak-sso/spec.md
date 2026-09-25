# Spec 023: Keycloak SSO

**Spec ID**: `023-keycloak-sso`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: RHBK Helm + Jobs
**Namespace**: `rhbk / services-rhbk`

## Description

Red Hat Build of Keycloak for SSO across dashboards, Vault, Quay, AAP, and OpenShift OAuth with sovereign-central and tenant realms.

## CRD Schema Summary

RHBK instance CR; Jobs for realms, groups, clients, RBAC, OAuth integration.

## Deployment Steps

1. Phase A7: Deploy RHBK (sync-wave 20)
2. Phase A8: keycloak-realms, groups, clients, rbac, oauth Jobs

## Testing Guide

- OAuth login on the hub; verify group membership drives RBAC

## Security Considerations

- Admin creds in Vault; test users via keycloak-test-users Job only

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
