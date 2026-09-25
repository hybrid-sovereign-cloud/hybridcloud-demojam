# Hardening Check — External Secrets Operator

**Chart:** `bootstrap/helm/charts/external-secrets`
**Cluster:** Central only
**Namespace:** `external-secrets`

## Checks

| Check | Status | Notes |
|---|---|---|
| Operator from `community-operators` | PASS | Channel stable |
| Dedicated namespace | PASS | `external-secrets` |
| ClusterSecretStore uses Vault token | PASS | From `vault-init-secrets` K8s Secret |
