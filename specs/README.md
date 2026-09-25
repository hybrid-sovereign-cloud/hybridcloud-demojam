# Hybridcloud Feature Specifications

Design specs for platform features. **Day-2 usage** (simple flows, workshop, how-tos): [`../docs/README.md`](../docs/README.md).

**Relevance reviewed**: 2026-09-25

## Status legend

| Status | Meaning |
|--------|---------|
| **KEEP** | Spec matches current implementation |
| **UPDATE** | Spec still needed but details drift from live deploy |

## Index

| # | Spec | Kind / Component | Status | Notes |
|---|------|------------------|--------|-------|
| 001 | [Entity Management](./001-entity-management/spec.md) | Entity | KEEP | `operator/primary` |
| 002 | [Team Management](./002-team-management/spec.md) | Team | KEEP | |
| 003 | [Assignment Management](./003-assignment-management/spec.md) | Assignment | KEEP | |
| 004 | [Project Management](./004-project-management/spec.md) | Project | KEEP | |
| 005 | [Persona Management](./005-persona-management/spec.md) | Persona | KEEP | |
| 006 | [Platform OpenShift](./006-platform-openshift/spec.md) | PlatformOpenshift | KEEP | types: openstack, aws, hosted |
| 007 | [CloudOSO](./007-cloud-oso/spec.md) | CloudOSO | KEEP | |
| 008 | [CloudAWS](./008-cloud-aws/spec.md) | CloudAWS | KEEP | |
| 009 | [OpenStack Migration](./009-openstack-migration/spec.md) | OpenStackMigration | UPDATE | Often parked in labs |
| 010 | [Plugin AAP](./010-plugin-aap/spec.md) | AAPConfig, AAPOrg | KEEP | |
| 011 | [Plugin Quay](./011-plugin-quay/spec.md) | QuayConfig, QuayOrg | KEEP | |
| 012 | [Plugin RBAC](./012-plugin-rbac/spec.md) | RbacConfig, Rbac | KEEP | |
| 013 | [Plugin Vault](./013-plugin-vault/spec.md) | Vault, VaultKV | KEEP | |
| 014 | [IAAC Git Sync](./014-iaac-git-sync/spec.md) | iaacGitSync STS | UPDATE | Live path is Python StatefulSet; Go `pluginIaac` disabled |
| 018 | [Admin Dashboard UI](./018-admin-dashboard-ui/spec.md) | Deployment | KEEP | `ui/packages/admin-dashboard` |
| 019 | [Tenant Dashboard UI](./019-tenant-dashboard-ui/spec.md) | Deployment | KEEP | |
| 020 | [Admin Console Plugin](./020-admin-console-plugin/spec.md) | ConsolePlugin | KEEP | |
| 021 | [Tenant Console Plugin](./021-tenant-console-plugin/spec.md) | ConsolePlugin | KEEP | |
| 022 | [Vault Integration](./022-vault-integration/spec.md) | Helm + Jobs | KEEP | |
| 023 | [Keycloak SSO](./023-keycloak-sso/spec.md) | RHBK + Jobs | UPDATE | `rhbkConfig` chart deprecated; Jobs own config |
| 024 | [RHACM GitOps](./024-rhacm-gitops/spec.md) | GitOpsCluster | UPDATE | Confirm `acmGitOpsCluster` enablement vs live |
| 025 | [ACS Security](./025-acs-security/spec.md) | ACS | KEEP | Central enabled in lab |
| 026 | [AAP Config as Code](./026-aap-config-as-code/spec.md) | Playbook | KEEP | |
| 027 | [Quay Registry](./027-quay-registry/spec.md) | Helm | KEEP | |
| 028 | [Crunchy Postgres](./028-crunchy-postgres/spec.md) | PGO | KEEP | |
| 029 | [Gitea](./029-gitea-git-server/spec.md) | Helm | KEEP | Hub |
| 030 | [ODF Storage](./030-odf-storage/spec.md) | ODF | KEEP | |
| 031 | [CNV Virtualization](./031-cnv-virtualization/spec.md) | HyperConverged | KEEP | CloudVirt + hosted |
| 032 | [MTV](./032-mtv-migration-toolkit/spec.md) | Provider | UPDATE | Not in active path in many labs |
| 033 | [Unified Operator](./033-unified-operator/spec.md) | All CRDs | KEEP | |
| 034 | [Bootstrap Deployment](./034-bootstrap-deployment/spec.md) | App-of-apps | KEEP | Runtime: `gitops/` |

**Summary**: Usage docs: [`../docs/`](../docs/).

## Conventions

- API group: `hybridsovereign.redhat/v1alpha1`
- Primary operator namespace: `sovereign-cloud`
- Plugin config namespace: `sovereign-cloud-plugins`
- Entity namespaces: `entity-<name>`
- All deployments via ArgoCD (`gitops/`) after bootstrap

## Related

- Usage & workshop: [`../docs/README.md`](../docs/README.md)
- Architecture: [`../architecture/README.md`](../architecture/README.md)
- Test specs: [`../tests/specs/README.md`](../tests/specs/README.md)
