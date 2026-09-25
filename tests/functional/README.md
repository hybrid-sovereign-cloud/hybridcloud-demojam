# Functional Tests

**Scope**: Hybrid Sovereign operator CR lifecycle and event propagation  
**Cluster**: Hub (`--context=hub-admin`) unless noted  
**Prerequisites**: Mega-Phase C complete; primary + namespace operators Synced/Healthy

---

## Test Environment Setup

```bash
export OC_CONTEXT=hub-admin
export TEST_ENTITY=acme-corp
export TEST_NAMESPACE=entity-acme-corp
```

Apply sanitized samples from `samples/` — never use production credentials.

---

## TC-F001: Entity Create

| Field | Value |
|-------|-------|
| **Objective** | Verify Entity CR provisions entity namespace and namespace operator |
| **Sample** | `samples/entity/acme-corp.yaml` |
| **Steps** | 1. `oc apply -f samples/entity/acme-corp.yaml -n sovereign-cloud --context=$OC_CONTEXT` 2. Wait for `status.ready=True` 3. Verify namespace `entity-acme-corp` exists with label `hybridsovereign.redhat/entity=acme-corp` 4. Verify Deployment `hybridsovereign-namespace-operator` Running in entity namespace |
| **Expected** | Namespace created; operator pod 1/1 Ready; no errors in operator logs |
| **Cleanup** | Retain for downstream tests |

## TC-F002: Entity Status Conditions

| Field | Value |
|-------|-------|
| **Objective** | Confirm reconciliation conditions reflect progress |
| **Steps** | `oc get entity acme-corp -n sovereign-cloud -o jsonpath='{.status.conditions}'` |
| **Expected** | `Ready` condition `status=True`; no stale `Reconciling` stuck >5 min |

## TC-F003: Entity Update (Idempotent Reconcile)

| Field | Value |
|-------|-------|
| **Objective** | Patch Entity spec; verify no namespace recreation |
| **Steps** | 1. Patch `spec.description` 2. Confirm namespace UID unchanged 3. Operator logs show reconcile without error |
| **Expected** | In-place update; `status.ready` remains True |

## TC-F004: Team CR Create

| Field | Value |
|-------|-------|
| **Objective** | Namespace operator reconciles Team in entity namespace |
| **Sample** | `samples/team/frontend-team.yaml` (or `alpha.yaml` if present) |
| **Prerequisite** | TC-F001 PASS |
| **Steps** | 1. Apply Team CR to `entity-acme-corp` 2. Wait `status.ready=True` 3. Verify per-CR viewer Role `<team-name>-team-viewer` exists |
| **Expected** | Role + RoleBinding created; Keycloak group updated (if RbacConfig applied) |

## TC-F005: Team CR Update (Member Change)

| Field | Value |
|-------|-------|
| **Objective** | Adding/removing members triggers reconcile |
| **Steps** | 1. Patch `spec.members` 2. Verify operator reconcile event 3. Confirm RoleBinding subjects unchanged structurally |
| **Expected** | Status updates; no duplicate RoleBindings |

## TC-F006: Team CR Delete

| Field | Value |
|-------|-------|
| **Objective** | Finalizer removes per-CR RBAC |
| **Steps** | 1. `oc delete team <name> -n entity-acme-corp` 2. Verify `<name>-team-viewer` Role and RoleBinding absent |
| **Expected** | Clean teardown; no orphaned RBAC |

## TC-F007: Kafka Event — Entity Create

| Field | Value |
|-------|-------|
| **Objective** | Entity creation emits event on `hybridsovereign-events` topic |
| **Prerequisite** | Mega-Phase D; AMQ Streams healthy (event-forwarder disabled) |
| **Steps** | 1. Consume from Kafka topic (or check EDA activation logs) 2. Apply new test Entity CR 3. Confirm event payload contains `kind=Entity`, `name=<entity>` |
| **Expected** | Event within 60s; EDA rulebook `entity-create` activation fires |

## TC-F008: Kafka Event — Team Create

| Field | Value |
|-------|-------|
| **Objective** | Team CR triggers namespace operator event → Kafka |
| **Prerequisite** | TC-F004 |
| **Steps** | Apply Team; verify Kafka message or EDA `team-create` rulebook job spawned |
| **Expected** | Event forwarded; no plaintext credentials in payload |

## TC-F009: Kafka Audit Topic

| Field | Value |
|-------|-------|
| **Objective** | K8s audit events land on `hybridsovereign-audit` |
| **Steps** | 1. Perform audited action (e.g. `oc create configmap` in entity ns) 2. Verify audit event in topic |
| **Expected** | Audit record with user identity; TLS transport in production |

## TC-F010: Entity Delete (Finalizer)

| Field | Value |
|-------|-------|
| **Objective** | Entity deletion removes namespace operator; respects namespace policy |
| **Steps** | 1. Delete dependent CRs (Team, Rbac, etc.) 2. Delete Entity CR 3. Verify namespace operator Deployment removed 4. Confirm entity namespace handling per policy (retained or removed per finalizer design) |
| **Expected** | No orphaned operator pods; finalizer clears |

---

## Pass Criteria

- All TC-F001 through TC-F010 PASS (TC-F007–F009 require Kafka infrastructure)
- No credentials in operator logs (event-forwarder retired)
- All tests use `samples/` sanitized CRs only

## Related Artifacts

- `tests/rbac-access/README.md` — authorization matrix
- `tests/e2e/README.md` — full migration flow
- `tests/security/SECURITY_REVIEW.md` — Kafka TLS gate
