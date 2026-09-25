# Hardening Check -- Tenancy Dashboard

**Chart:** `tenancy_dashboard/helm/charts/dashboard`
**Cluster:** Services (deployed by central ArgoCD)
**Namespace:** `sovereign-cloud`

## Checks

| Check | Status | Notes |
|---|---|---|
| Deployed to services cluster | PASS | ArgoCD Application uses `servicesCluster.server` |
| Runs in sovereign-cloud namespace | PASS | `destinationNamespace: sovereign-cloud` |
| OAuth proxy sidecar | PASS | `ose-oauth-proxy` with TLS, cookie security, httponly |
| User token passthrough | PASS | Uses `X-Forwarded-Access-Token`, never reads SA token |
| No ServiceAccount token used for K8s API | PASS | All K8s calls use logged-in user's bearer token |
| Non-root container | PASS | `allowPrivilegeEscalation: false`, capabilities dropped |
| Health probes configured | PASS | Liveness + readiness for both proxy and app |
| Resource limits set | PASS | Defined in values for both containers |
| Security headers | PASS | Helmet CSP, HSTS, referrer policy, X-Frame-Options |
| Rate limiting | PASS | 120 req/min read, 20 req/min write |
| Input validation | PASS | Name pattern and config validation on server |
| TLS termination | PASS | Route uses reencrypt TLS |
| Image pull secret uses shared robot | PASS | `quay-pull-secret` |
| No hardcoded secrets | PASS | Cookie secret from values, not in image |
| RBAC scoping via user token | PASS | User sees only namespaces/resources they have access to |
| RbacConfig dropdown | PASS | Fetches only `ready=true` configs from cluster |
| Creator annotation | PASS | Captures `X-Forwarded-User` and sets `hybridsovereign.redhat/creator` |
| Expandable status detail | PASS | Shows full group attributes without additional API calls |
| Red Hat theme | PASS | Primary color `#CC0000`, consistent with Red Hat brand guidelines |
