# Migration Hardening Gap Analysis

**Date**: 2026-07-11  
**Scope**: Sovereign multi-repo → `hybridcloud/` monorepo migration  
**Reviewer**: Platform security (automated artifact; human sign-off required)

---

## Executive Summary

The `hybridcloud/` monorepo consolidates 13 Ansible operators, bootstrap Helm charts, EDA decision environments, UI packages, and samples into a single canonical source. Most constitution gates (no secrets in Git, Vault-only creds, GitOps-only post-bootstrap) are **implemented**. This report identifies **remaining gaps** before production hardening sign-off (Mega-Phase J).

| Category | Implemented | Partial | Open |
|----------|-------------|---------|------|
| Secrets management | 6 | 1 | 0 |
| RBAC least privilege | 5 | 2 | 1 |
| ESO patterns | 5 | 0 | 1 |
| Namespace protection | 4 | 1 | 0 |
| Operator security contexts | 6 | 1 | 0 |
| Kafka TLS | 2 | 3 | 2 |
| CIS / NIST coverage | 8 | 6 | 4 |

---

## Gap Register

### GAP-001 — Kafka plaintext bootstrap in lab defaults (P0)

| Field | Value |
|-------|-------|
| **Finding** | `event-forwarder/values.yaml` defaults to `hybridsovereign-kafka-kafka-bootstrap.amq-streams.svc:9092` (plaintext) |
| **Risk** | Event bus credentials and CR lifecycle events traverse unencrypted in-cluster |
| **Target** | TLS listener on port 9093 with SASL SCRAM via ExternalSecret |
| **Remediation** | Override `event-forwarder.kafka.bootstrapServers` in `bootstrap/helm/central/values.yaml`; enable TLS in AMQ Streams Kafka CR; update EDA DE Kafka client config |
| **Owner** | Platform |
| **ETA** | Before Mega-Phase D gate |

### GAP-002 — NetworkPolicies not uniformly deployed (P1)

| Field | Value |
|-------|-------|
| **Finding** | Default-allow cluster networking; no deny-all baseline NetworkPolicy for `sovereign-cloud`, `entity-*`, `amq-streams` |
| **Risk** | Lateral movement between tenant namespaces |
| **Remediation** | Add NetworkPolicy Helm subchart or OVN-Kubernetes admin policy set |
| **Owner** | Platform / NetSec |
| **ETA** | Mega-Phase J |

### GAP-003 — global_tests still references root-level paths (P2)

| Field | Value |
|-------|-------|
| **Finding** | `global_tests/` at repo root predates monorepo; not relocated under `hybridcloud/tests/` |
| **Risk** | Test drift; CI may validate wrong tree |
| **Remediation** | Port Ansible playbooks to `hybridcloud/tests/` or symlink; update `run-tests.sh` integration |
| **Owner** | QA |
| **ETA** | Post Mega-Phase I |

### GAP-004 — HELPEROSO/HELPERAWS deviation documentation (P2)

| Field | Value |
|-------|-------|
| **Finding** | Legacy helper SAs disabled but deviation ADR not in `hybridcloud/architecture/` |
| **Risk** | Future re-enablement without security review |
| **Remediation** | Document in `architecture/docs/technical/DEPRECATED_REPOS.md` and ADR |
| **Owner** | Architecture |
| **ETA** | Mega-Phase A cleanup |

### GAP-005 — Image digest pinning (P1)

| Field | Value |
|-------|-------|
| **Finding** | Operator and dashboard images use floating tags (`0.x.y`) not SHA digests |
| **Risk** | Supply chain tampering between build and deploy |
| **Remediation** | Quay digest pinning in central values; ImageDigestMirrorSet where applicable |
| **Owner** | Release engineering |
| **ETA** | Mega-Phase J |

### GAP-006 — VDDK conversion host hardening deferred (P1)

| Field | Value |
|-------|-------|
| **Finding** | VM migration e2e (Spec 017) defers VDDK library install and conversion host CIS hardening |
| **Risk** | Migration data path not validated under production controls |
| **Remediation** | Complete `tests/e2e/README.md` Phase 3 after VDDK availability |
| **Owner** | Migration |
| **ETA** | Mega-Phase G (deferred) |

### GAP-007 — Per-entity Vault policy audit (P1)

| Field | Value |
|-------|-------|
| **Finding** | Entity namespaces receive Vault KV paths via operator; policy least-privilege not automated-tested |
| **Risk** | Cross-entity Vault read if policy misconfigured |
| **Remediation** | Add Vault policy test to `tests/rbac-access/` matrix |
| **Owner** | Security |
| **ETA** | Mega-Phase J |

### GAP-008 — ESO operator upgrade path (P2)

| Field | Value |
|-------|-------|
| **Finding** | External Secrets Operator version pinned in bootstrap; upgrade runbook not in hybridcloud docs |
| **Risk** | Stale ESO missing CVE patches |
| **Remediation** | Document upgrade via ArgoCD Application bump in deployment gates |
| **Owner** | Platform |
| **ETA** | Ongoing |

---

## Migration-Specific Risks (Frozen Repos)

| Frozen repo | Risk if used post-migration | Mitigation |
|-------------|------------------------------|------------|
| `Entity/`, `Team/`, etc. | Divergent operator logic; stale CRDs | `DEPRECATED_REPOS.md`; archive branches |
| `eda/plugin-iaac/` | Removed IAAC plugin; broken activations | Use `hybridcloud/iaac/` StatefulSet |
| `assignment-central-rbac/` | Orphaned ACM RBAC chart | `hybridcloud/bootstrap/helm/charts/rhacm/` |
| Root `bootstrap/` | Duplicate chart versions | Single source: `hybridcloud/bootstrap/` |
| `global_tests/` | Wrong inventory paths | Port to `hybridcloud/tests/run-tests.sh` |

---

## Closed Gaps (Verified)

| ID | Description | Evidence |
|----|-------------|----------|
| CLOSED-01 | No secrets in sample CRs | `samples/README.md` sanitization |
| CLOSED-02 | VMware creds via Vault + ExternalSecret | MTV chart `externalsecret.yaml` |
| CLOSED-03 | Operator runAsNonRoot + seccomp | Namespace operator deployment template |
| CLOSED-04 | sovereign-* namespace delete protection | Constitution + teardown role review |
| CLOSED-05 | Unified operator architecture | Spec 033; `hybridcloud/operator/` |

---

## Recommended Gate Sequence

```mermaid
flowchart LR
  A[SECURITY_REVIEW.md] --> B[CIS checklist]
  B --> C[NIST checklist]
  C --> D[Close P0 gaps]
  D --> E[run-tests.sh PASS]
  E --> F[verify-sync.sh PASS]
  F --> G[Mega-Phase J sign-off]
```

---

## Sign-Off

| Milestone | Date | Approver | Notes |
|-----------|------|----------|-------|
| P0 gaps closed | | | |
| Mega-Phase J | | | |
| Production ready | | | |

**Next review**: After each bootstrap `values.yaml` change affecting secrets, RBAC, or Kafka.
