# Hardening Check — Crunchy Postgres

**Retested**: 2026-07-15

| Check | Result | Notes |
|-------|--------|-------|
| Operator both clusters | PASS | Argo apps `crunchy-postgres-central/services` Synced |
| Used by Keycloak / AAP / Gitea | PASS | Values wire `PostgresCluster` |
| HA instances | PARTIAL | Most apps set `instances: 2` — confirm per cluster |

Backup retention policies: REVIEW for production.
