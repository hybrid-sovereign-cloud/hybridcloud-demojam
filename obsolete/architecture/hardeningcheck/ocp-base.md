# Hardening Check — ocp-base Chart

## Component
`ocp-base` Helm chart — deployed to provisioned OCP clusters via ACM `policy-basechart-operators`.

## Assessment Date
Phase 1 — 2026-05-19

## Checklist

| # | Control | Status | Notes |
|---|---------|--------|-------|
| 1 | No secrets in chart | PASS | Chart installs OLM operators only; no credentials rendered |
| 2 | Vault-only credentials | N/A | No credentials in this chart; vault integration is future (`vault.enabled: false`) |
| 3 | ExternalSecret/PushSecret for all secrets | N/A | No secrets; Vault ClusterSecretStore wiring deferred |
| 4 | `installPlanApproval: Automatic` | ACCEPTABLE | Spoke clusters are non-production lab; switch to `Manual` for production |
| 5 | ESO channel pinned | PASS | `stable` channel pinned; not `latest` |
| 6 | GitOps channel | ACCEPTABLE | `latest` channel used; switch to specific `gitops-1.x` channel for production |
| 7 | OCI chart public visibility | PASS | Upload target enforces public visibility via Quay API |
| 8 | No duplicate OperatorGroup | PASS | GitOps subscription targets `openshift-operators` which has AllNamespaces OperatorGroup by default |
| 9 | Idempotent ACM policy | PASS | ConfigurationPolicy with `musthave` is idempotent |
| 10 | Namespace protection | PASS | `external-secrets` namespace only; no `sovereign-*` namespaces touched |
| 11 | RBAC least privilege | PASS | OLM manages operator RBAC; no custom ClusterRoles added |
| 12 | No `no_log` required | PASS | No secrets processed |

## Known Gaps / Production Remediation

| Gap | Severity | Remediation |
|-----|----------|-------------|
| `installPlanApproval: Automatic` on spokes | Low | Switch to `Manual` with approval automation for production |
| `gitopsOperator.channel: latest` | Low | Pin to `gitops-1.14` or current stable release for production |
| No Vault ClusterSecretStore on spokes | Medium | Phase 2: enable `vault.enabled: true` with per-spoke Kubernetes auth path |
| ESO from `community-operators` | Acceptable (lab) | Production: use `redhat-operators` or certified catalog |

## Deviation Record

- **ESO source `community-operators`**: Lab environment only. Production must use certified catalog.
  - Why: Lab clusters have community catalog available; no Red Hat catalog for ESO.
  - Remediation target: Phase 2+ when spokes are production-grade.
