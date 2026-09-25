# End-to-End Migration Test Plan

**Scope**: VMware → CloudOSO VM migration via OpenStackMigration CR and EDA  
**Specs**: 009 (OpenStack Migration), 017 (VM Migration VMware), 032 (MTV)  
**Status**: Phases 1–2 executable; **Phase 3 (VDDK data transfer) deferred**

---

## Prerequisites

| Component | Gate | Verification |
|-----------|------|--------------|
| Mega-Phase A | Foundation | Vault, RHBK, ODF, RHACM ready |
| Mega-Phase B | Platform services | MTV operator, Quay, Gitea |
| Mega-Phase C | Operators | Entity + CloudOSO + namespace operator |
| Mega-Phase G | Migration tooling | MTV Provider Ready, conversion host |
| Samples applied | Tenancy | `entity-acme-corp`, CloudOSO env, Rbac |

---

## Phase 1 — Discovery and Inventory (No VDDK)

### TC-E2E-001: MTV VMware Provider Ready

```bash
oc get provider vmware-vcenter -n openshift-mtv --context=hub-admin \
  -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
```

**Expected**: `True`

### TC-E2E-002: MTV VM Inventory Populated

```bash
oc describe provider vmware-vcenter -n openshift-mtv --context=hub-admin | grep -A10 Inventory
```

**Expected**: Test VMs listed from vCenter

### TC-E2E-003: CloudOSO Environment Ready

```bash
oc get cloudoso <env-name> -n entity-acme-corp --context=hub-admin \
  -o jsonpath='{.status.ready}'
```

**Expected**: `true`

### TC-E2E-004: OpenStack API Reachability from Cluster

```bash
# Via CloudOSO status endpoint or ansible openstack auth test
```

**Expected**: Keystone auth succeeds with Vault-sourced credentials

---

## Phase 2 — Migration CR and EDA Orchestration

### TC-E2E-005: Apply OpenStackMigration Sample

```bash
oc apply -f samples/openstackmigration/website.yaml -n entity-acme-corp --context=hub-admin
```

**Expected**: CR accepted; `status` shows `Reconciling`

### TC-E2E-006: EDA Rulebook Activation

```bash
oc get edaactivation -n aap-eda --context=hub-admin | grep openstack
```

**Expected**: Activation Running; Job spawned for migration playbook

### TC-E2E-007: Ansible Job Completion (Discovery Only)

```bash
oc get jobs -n sovereign-cloud-jobs --context=hub-admin | grep migration
oc logs job/<migration-job-name> -n sovereign-cloud-jobs
```

**Expected**: Discovery playbook completes; no credentials in logs

### TC-E2E-008: Kafka Migration Event

Verify OpenStackMigration status change emits event on `hybridsovereign-events`.

**Expected**: Event contains CR name and phase; no secret fields

### TC-E2E-009: Migration Logs to S3 (PushSecret)

```bash
oc get pushsecret -n sovereign-cloud-jobs --context=hub-admin
```

**Expected**: Log bundle pushed to Vault/S3 path per operator design

---

## Phase 3 — VDDK Data Transfer (DEFERRED)

> **Deferral reason**: VDDK libraries require VMware licensing acceptance and conversion host hardening (GAP-006). Execute only when VDDK packages are approved for lab use.

### TC-E2E-010: Conversion Host Deployed (DEFERRED)

| Step | Description |
|------|-------------|
| 1 | Run `deploy_conversion_host.yml` via EDA |
| 2 | Verify conversion host VM in CloudOSO project |
| 3 | Confirm nbdkit service running |

**Expected**: Conversion host Ready; firewall rules restrict data path

### TC-E2E-011: VDDK Libraries Installed (DEFERRED)

| Step | Description |
|------|-------------|
| 1 | Install VDDK from approved artifact store (not Git) |
| 2 | Verify `vmware-vix-disklib` path on conversion host |

**Expected**: Libraries present; checksum verified

### TC-E2E-012: Cold Migration Test VM (DEFERRED)

| Step | Description |
|------|-------------|
| 1 | Select small test VM from MTV inventory |
| 2 | Apply OpenStackMigration with `spec.vms: [<test-vm>]` |
| 3 | Monitor os_migrate playbook via EDA Job logs |
| 4 | Verify Nova instance in CloudOSO |

**Expected**: VM powered on in OpenStack; source VM unchanged (cold migration)

### TC-E2E-013: Warm Migration (DEFERRED)

Optional advanced test after TC-E2E-012 passes.

### TC-E2E-014: Post-Migration Validation (DEFERRED)

- Network connectivity to migrated VM
- Application health check (if applicable)
- MTV migration plan marked Complete

---

## Phase 4 — Cleanup and Rollback

### TC-E2E-015: OpenStackMigration Delete

```bash
oc delete openstackmigration <name> -n entity-acme-corp --context=hub-admin
```

**Expected**: Finalizer clears; temporary resources removed

### TC-E2E-016: No Orphaned Conversion Host (when Phase 3 run)

**Expected**: Teardown role removes conversion host unless `spec.retainConversionHost: true`

---

## Test Data Requirements

| Asset | Source | Notes |
|-------|--------|-------|
| Test vCenter VM | MTV inventory | Small Linux VM recommended |
| CloudOSO project | CloudOSO CR | Dedicated migration project |
| Network maps | OpenStackMigration spec | Match lab networking |
| Flavor map | OpenStackMigration spec | Equivalent instance size |

All credentials: Vault paths only (`central/vmware-credentials`, entity-scoped OpenStack paths).

---

## Pass Criteria

| Phase | Required for Gate |
|-------|-------------------|
| Phase 1 | All TC-E2E-001–004 PASS |
| Phase 2 | All TC-E2E-005–009 PASS |
| Phase 3 | **Deferred** — document skip reason in test report |
| Phase 4 | TC-E2E-015 PASS (TC-E2E-016 when Phase 3 executed) |

## Related Artifacts

- `tests/functional/README.md` — Entity/Team baseline
- `tests/connectivity/README.md` — MTV/Kafka connectivity
- `samples/openstackmigration/` — 4 sanitized samples
