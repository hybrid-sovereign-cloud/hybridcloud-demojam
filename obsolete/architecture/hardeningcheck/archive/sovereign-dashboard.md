# Hardening Check — Sovereign Dashboard

**Chart:** `user_dashboard/helm/charts/dashboard`
**Cluster:** Services (deployed by central ArgoCD)
**Namespace:** `sovereign-cloud`

## Checks

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application uses `servicesCluster.server` |
| Runs in sovereign-cloud namespace | PASS | `destinationNamespace: sovereign-cloud` |
| TLS termination | PASS | Route with `reencrypt`, serving cert auto-provisioned |
| OAuth proxy sidecar | PASS | `ose-oauth-proxy` with secure cookie flags |
| HTTP security headers | PASS | Helmet.js: CSP, HSTS, X-Frame-Options, Referrer-Policy |
| Rate limiting | PASS | `express-rate-limit` on API endpoints |
| Input validation | PASS | Server-side validation for all Entity fields |
| Body size limits | PASS | JSON body limited to 16KB |
| Image pull secret uses shared robot | PASS | `quay-pull-secret` (not dashboard-specific) |
| No oc exec used | PASS | All operations via Kubernetes API proxy |
| Cookie security | PASS | `--cookie-secure`, `--cookie-httponly`, `--cookie-samesite=Strict` |
