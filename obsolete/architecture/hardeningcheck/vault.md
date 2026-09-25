# Hardening Check — Vault

**Retested**: 2026-07-15

| Check | Result | Notes |
|-------|--------|-------|
| Central HA Raft ×3 | PASS | `central-vault` vault-0..2 Running |
| Services HA Raft ×3 | PASS | `services-vault` vault-services-0..2 Running |
| Not standalone mode | PASS | values `standalone.enabled: false`, `ha.enabled: true` |
| Init Jobs present | PASS | `job-vault-init`, services init STS/Job completed |
| ESO ClusterSecretStore | PASS | Used by dashboards, AMQ, Gitea, operators |
| Human OIDC | PASS | Job `job-vault-oidc-auth` Synced |
| In-pod TLS | REVIEW | `tls_disable = 1` + edge Route — lab deviation |

## Gaps

| ID | Gap | Severity |
|----|-----|----------|
| VLT-001 | Enable end-to-end TLS for Vault listeners in production | MED |
| VLT-002 | Unseal key operational handling / break-glass | MED |
