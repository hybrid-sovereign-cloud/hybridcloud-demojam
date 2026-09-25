# Hardening Check — UI (Dashboards + Console Plugins)

**Retested**: 2026-07-22  
**Cluster**: Services · Namespace: `sovereign-cloud`

## Deployed versions (match `bootstrap/helm/central/values.yaml`)

| App | Image | ArgoCD |
|-----|-------|--------|
| `sovereign-cloud-dashboard` | `…/sovereign-cloud-dashboard:2.0.16` | Synced (pin via values) |
| `tenancy-dashboard` | `…/tenancy-dashboard:5.0.15` | Synced (pin via values) |
| `sovereign-admin-plugin` | `…/sovereign-admin-plugin:1.2.13` | Synced |
| `sovereign-tenant-plugin` | `…/sovereign-tenant-plugin:1.3.11` | Synced |

Source: `hybridcloud/ui/packages/{admin,tenant}-{dashboard,console-plugin}`.  
Build/push: `cd hybridcloud/ui && make build-push` (tags in `ui/Makefile`).

## Controls

| # | Control | Result | Notes |
|---|---------|--------|-------|
| 1 | OAuth proxy in front of dashboards | PASS | `ose-oauth-proxy:v4.14` sidecar |
| 2 | OAuth secrets from Vault | PASS | ExternalSecret paths `dashboard-oauth`, `tenancy-dashboard-oauth` |
| 3 | User token for K8s API (not pod SA for CRUD) | PASS | Design in C4 UI + dashboard docs |
| 4 | Console plugins on services only | PASS | Deployments in `sovereign-cloud` |
| 5 | Pull secrets for Quay | PASS | `quay-pull-secret` |
| 6 | UI Health probes from dashboard pod | PASS | `UIHealthChecker` registry + `/api/uihealth/probe`; no reconcile loop |

## Gaps

| ID | Gap | Severity |
|----|-----|----------|
| UI-001 | Chart sources for standalone dashboards not always mirrored under `bootstrap/helm/charts/` | LOW — OCI pins in central values |
