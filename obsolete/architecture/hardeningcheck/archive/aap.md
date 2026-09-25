# Hardening Check — AAP

**Chart:** `bootstrap/helm/charts/aap`
**Cluster:** Services only
**Namespace:** `aap`

## Checks

| Check | Status | Notes |
|---|---|---|
| Deployed only on services cluster | PASS | Central ArgoCD manages |
| Controller + EDA + Hub enabled | PASS | Full platform |
| Operator from `redhat-operators` | PASS | Certified, channel stable-2.5 |
