# Hardening Check — ACS (RHACS)

**Chart:** `bootstrap/helm/charts/acs`
**Cluster:** Both (Central instance on central only)
**Namespace:** `rhacs-operator` (operator), `stackrox` (Central)

## Checks

| Check | Status | Notes |
|---|---|---|
| Central on central cluster only | PASS | SecuredCluster for services later |
| Operator from `redhat-operators` | PASS | Certified source |
| Scanner HA (2-5 replicas) | PASS | Auto-scaling enabled |
| Console plugin registered | PASS | rhacs ConsolePlugin CR |
