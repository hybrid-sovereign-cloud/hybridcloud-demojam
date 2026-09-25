# Hardening — 010 CloudOSO VRF + OpenStack Migration

**Retested**: 2026-07-15 — still in progress (dummy migration / token scoping gaps remain open).

## CloudOSO VRF passthrough

- [x] No secrets in Git for VRF identifiers (user-supplied spec only)
- [x] VRF fields optional; `vrfId` required in UI only when `enableVRF` is true
- [x] Ansible facts logged with debug task only (no Vault paths)

## OpenStackMigration operator

- [x] Operator runs on services cluster only; emits events (no direct AAP calls)
- [x] CR spec requires explicit `source`, `vmName`, `cloudoso` (no defaults for VM/source)
- [x] Operator Deployment `replicas: 2` for HA
- [x] No credentials in OpenStackMigration CR

## MTV catalog sync Job

- [x] Uses `argocd-cluster-services` token from central (not in Git)
- [x] Writes catalog ConfigMap only (no MTV credentials in ConfigMap)
- [x] Job runs via ArgoCD sovereign Job pattern

## Dummy migration job

- [x] AAP template logs parameters only; no destructive actions in Phase 2
- [x] `patch_cr_status.yml` uses Vault-backed services token (existing pattern)
- [x] `no_log: true` on token extraction tasks

## Gaps / production targets

- [ ] Scope `argocd-cluster-services` token to least-privilege SA (SEC-003)
- [ ] Real migration playbook replaces dummy template in future phase
- [ ] Catalog sync CronJob or scheduled Job for stale VM lists
