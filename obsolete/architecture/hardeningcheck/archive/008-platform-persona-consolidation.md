# Hardening Check: 008 Platform Persona Consolidation

**Date**: 2026-06-12
**Reviewer**: Agent

## CIS/NIST Controls

### Secret Management

| Control | Status | Notes |
|---------|--------|-------|
| No secrets in Git | PASS | All secret delivery via ExternalSecret/PushSecret |
| Ansible `no_log` on credentials | PASS | All EDA roles use `no_log: true` for bearer tokens |
| Vault-only credential storage | PASS | Cloud creds at `central/openstack-creds`, `aws/accounts/shc_admin` |
| No hardcoded tokens in operator code | PASS | Persona operator uses in-cluster SA |

### RBAC & Least Privilege

| Control | Status | Notes |
|---------|--------|-------|
| Persona operator ClusterRole scoped | PASS | Only `personas`, `events`, `secrets` verbs |
| EDA cross-cluster token rotation | PASS | Uses ArgoCD-managed cluster secret |
| Persona types enforce least privilege | PASS | 14 distinct types with specific verb sets |
| Dashboard API proxy auth | PASS | Uses service account bearer token |

### Container Security

| Control | Status | Notes |
|---------|--------|-------|
| Operator image from trusted base | PASS | `quay.io/operator-framework/ansible-operator` |
| DE images from Red Hat base | PASS | `registry.redhat.io/ansible-automation-platform-25/de-minimal-rhel9` |
| Image pull secrets via ExternalSecret | PASS | `quay-pull-secret` delivered via Vault |
| No root containers | PASS | All operators run as non-root |

### Network & Access

| Control | Status | Notes |
|---------|--------|-------|
| EDA event stream authenticated | PASS | Bearer token auth on event stream POST |
| Cross-cluster TLS | PASS | Services cluster API accessed via HTTPS |
| Dashboard routes TLS | PASS | OpenShift routes enforce edge TLS |

## Deviations

| Deviation | Why | Where | Remediation |
|-----------|-----|-------|-------------|
| Persona CRs manually patched to `ready` | EDA activations not yet configured for Persona | `oc patch persona -n entity-acme-corp` | Configure Persona EDA activations in AAP |
| Helper operators disabled, not fully removed | ArgoCD app-of-apps `ComparisonError` blocks clean prune | `bootstrap/helm/central/values.yaml` | Fix app-of-apps sync, then remove helper templates |
| Cross-cluster status writes from EDA | EDA on central patches CRs on services cluster | All EDA provision/teardown roles | Production: dedicated service account with narrow RBAC |
| Phase 8 deferred | Requires DE rebuild and EDA activation setup | Cluster reprovisioning with merged operators | Schedule DE rebuilds and test end-to-end |

## New Components Added

| Component | Hardened | Notes |
|-----------|----------|-------|
| Persona Operator | Yes | CRD, RBAC, operator deployment verified |
| Persona EDA roles | Yes | Provision and teardown roles with `no_log` |
| CloudAWS EDA roles (merged) | Yes | environmentprep absorbed from AWSHelper |
| CloudOSO EDA roles (merged) | Yes | environmentprep absorbed from OSOHelper |
| PlatformOpenshift clusterbuild (merged) | Yes | AWS and OpenStack clusterbuild in EDA |
| EdaJobs CRD field | Yes | Added to all 13 operator CRDs |
| Force-reconcile UI button | Yes | Patches annotation only, no direct state mutation |
| EDA GitHub repository | Yes | SSH auth, no PAT in code |
