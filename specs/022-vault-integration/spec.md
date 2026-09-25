# Spec 022: Vault Integration

**Spec ID**: `022-vault-integration`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Helm charts + Jobs
**Namespace**: `vault / external-secrets`

## Description

Platform Vault HA deployment on the hub with k8s auth, OIDC, KV engines, and ESO ClusterSecretStore integration.

## CRD Schema Summary

Vault Helm: Raft HA, ingress, auto-unseal. Jobs: vaultInit, vaultKv, vaultK8sAuth.

## Deployment Steps

1. Phase A5: Deploy Vault (sync-wave 15)
2. Phase A6: vault-init, vault-kv, vault-k8s-auth Jobs
3. Configure ClusterSecretStore with k8s auth on the hub

## Testing Guide

- ExternalSecret test sync; Vault OIDC login via Keycloak

## Security Considerations

- No token auth for ESO; k8s auth only; root token never in git

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
