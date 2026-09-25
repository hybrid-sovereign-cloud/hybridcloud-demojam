# Hardening Check — Keycloak (RHBK)

**Retested**: 2026-07-15

| Check | Result | Notes |
|-------|--------|-------|
| Central instance | PASS | `central-rhbk`, chart `0.10.2` |
| Services instance | PASS | `services-rhbk` |
| Postgres via Crunchy | PASS | `rhbk-pgcluster` pattern in values |
| Admin secrets → Vault | PASS | `pushSecretToVault: true` |
| Config via Jobs (not rhbkConfig chart) | PASS | `rhbkConfig.enabled: false`; keycloak-* Jobs Synced |
| In-pod TLS | REVIEW | `tls.enabled: false` lab — edge Routes |

Realms: `sovereign-central` (central), `sovereign-tenants` (services).
