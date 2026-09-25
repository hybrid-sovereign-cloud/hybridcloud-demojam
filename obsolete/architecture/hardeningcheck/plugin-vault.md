# Plugin Vault — Hardening Check

## Version
- Chart: 0.1.0
- Operator Image: 0.0.1

## Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| Non-root containers | PASS | `runAsNonRoot: true`, `seccompProfile: RuntimeDefault` |
| Privilege escalation | PASS | `allowPrivilegeEscalation: false`, `capabilities.drop: ALL` |
| Secret storage | PASS | Root tokens stored in K8s Secrets, not hardcoded |
| RBAC scoping | PASS | ClusterRole limited to Vault/VaultKV CRDs and supporting resources |
| OIDC isolation | PASS | Per-entity OIDC clients with entity-scoped redirect URIs |
| KV policy isolation | PASS | Separate admin/reader policies per VaultKV engine |
| Vault unseal keys | WARN | Stored as K8s Secret; consider auto-unseal with a KMS in production |
| TLS termination | PASS | Edge TLS via OpenShift Route |
| Entity namespace isolation | PASS | Vault instances deployed only in entity-labeled namespaces |
| Cross-entity access | PASS | Separate Vault instances + OIDC clients prevent cross-entity access |
| Finalizer cleanup | PASS | Vault and VaultKV finalizers remove resources on CR deletion |

## Deviation from Best Practice

| Item | Description | Mitigation |
|------|-------------|------------|
| Single unseal key | `secret_shares=1, secret_threshold=1` used for simplicity | Increase to 5/3 for production workloads |
| Root token in Secret | Root token stored in K8s Secret vs. external KMS | Future: integrate with auto-unseal using external KMS |
| File storage backend | Uses `storage "file"` instead of Raft for single-node | HA mode should be enhanced to use Raft with proper retry_join |
