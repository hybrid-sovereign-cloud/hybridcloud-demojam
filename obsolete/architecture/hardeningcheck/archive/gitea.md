# Hardening Check — Gitea

**Chart:** `bootstrap/helm/charts/gitea`
**Cluster:** Services cluster
**Namespace:** `gitea`

## Checks

| Check | Status | Notes |
|---|---|---|
| Images mirrored to allowed registry | PASS | All from quay.example.com |
| PostgreSQL backend (not SQLite) | PASS | Bitnami PostgreSQL subchart |
| Valkey cluster cache | PASS | In-cluster Valkey (Redis-compatible) |
| Keycloak OIDC integration | PASS | Client `gitea` in sovereign-central realm |
| Route-based access | WARN | OpenShift Route without TLS — HTTP only. TLS termination pending |
| Admin credentials from Vault | PASS | ExternalSecret pulls `central/gitea-admin` from vault-backend |
| OCI pull secret from Vault | PASS | ExternalSecret pulls `central/oci-credentials` as dockerconfigjson |
| Admin token stored in Vault | PASS | `central/gitea-admin.admin_token` path |

## Known Deviations

- **Route TLS**: The gitea OpenShift Route does not have TLS termination configured. The ROOT_URL in `app.ini` uses HTTPS (for external browser access via the cluster router wildcard cert), but the route itself is HTTP. For production, add `tls.termination: edge` to the route.
- **Job URLs**: The `gitea-init` and `gitea-create-repo` Ansible jobs use `http://` scheme (not `https://`) because the OpenShift route is HTTP-only. Internal job-to-service communication uses plain HTTP.
- **ExternalSecret sync-waves**: Negative sync-waves (`-3`, `-2`) used for ExternalSecrets to ensure pull secrets exist before StatefulSet pods start.
