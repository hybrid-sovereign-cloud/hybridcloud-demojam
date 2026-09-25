# Security State — Hybrid Sovereign Cloud

**Retested**: 2026-08-25  
**Lab**: central `shc-cental5` · services `shc-services5`  
**Overall**: Medium risk (lab deviations accepted; production remediations tracked)

Replaces `security-assessment.md` and the June `security-state-2026.md` snapshot.

---

## Topology verified

| Check | Result | Evidence |
|-------|--------|----------|
| ArgoCD only on central | PASS | Apps in `openshift-gitops` on central; services has GitOps operator CSV but no Application CRs as control plane |
| Vault HA Raft ×3 both clusters | PASS | `central-vault` vault-0..2 Running; `services-vault` vault-services-0..2 Running |
| ESO on both clusters | PASS | CSV `external-secrets-operator.v0.11.0` Succeeded both |
| Gitea on central only | PASS | `gitea/gitea` Deployment on central |
| AAP EDA on central only | PASS | `eda/sovereign-aap-eda` on central; services `aap.eda.enabled: false` |
| AMQ Streams on central | PASS | `hybridsovereign-kafka` Ready 4.2.0 |
| Event Forwarder optional | PASS | Re-enabled (`eventForwarder.enabled: true`) for K8s Events → EDA audit path; primary path remains operator→Kafka |
| AAP Postgres WAL limits | PASS | Central `aap-pgcluster` recovered after WAL disk-full; chart adds `max_wal_size=2GB` |
| Kafka topic partitions | PASS | `hybridsovereign-events` 12p, `hybridsovereign-audit` 6p (patched live + chart 0.2.4) |
| ClusterSecretStore services | FAIL | `vault-backend` InvalidProviderConfig — run `vault-k8s-auth` job; blocks tenant ExternalSecrets |
| IAAC = Python git-sync | PASS | `iaac-git-sync` STS 1/1 in `sovereign-cloud-plugins` |
| Operators on services | PASS | `hybridsovereign-primary-operator` in `sovereign-cloud` |
| UI at pinned tags | PASS | See [ui.md](ui.md) — all four ArgoCD apps Synced/Healthy |
| No secrets committed (sample scan) | REVIEW | Credential YAML under `aap-config/` uses Jinja placeholders — keep scanning in CI (`tests/specs/security/no-secrets-in-git.yaml`) |

---

## Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SEC-001 | HIGH | Broad `cluster-admin` bindings (`gitops-cluster-admin`, `sovereign-aap-controller-cluster-admin`, `sovereign-ansible-runner-admin`, …) | OPEN — least-privilege backlog |
| SEC-002 | HIGH | Platform NetworkPolicies sparse (lab: ~60–90 NPs cluster-wide, many default OCP) | OPEN — tighten sovereign namespaces |
| SEC-003 | MED | Kafka producer TLS uses `CERT_NONE` for Strimzi passthrough Route hostname mismatch | OPEN — lab deviation; document + plan proper cert/SAN |
| SEC-004 | MED | AAP license must be present for job launches (`License is missing` blocks EDA→JT) | OPEN / ops — license Jobs exist (`job-aap-license-*`) |
| SEC-005 | MED | Primary operator GitOps pin `0.1.6` may be OutOfSync vs live `0.1.4` until values pushed | OPEN — sync `hybridsovereignPrimaryOperator` |
| SEC-006 | LOW | ACS enabled on central (values `acs.enabled: true`) — ensure scanner policies match lab scope | REVIEW |
| SEC-007 | LOW | Vault in-pod TLS disabled (`tls_disable = 1`) with edge Routes | Lab deviation — track in technical/deviations |

---

## Positive controls

- ExternalSecret / PushSecret pattern for dashboard OAuth, AMQ, Gitea, AAP admin
- `sovereign-*` namespace protection rule enforced in agent/docs
- GitOps-only post `init-central-argo`
- Unique EDA Kafka `group_id` per rulebook (consumer fan-out)
- UI OAuth proxy + user-token K8s access model

---

## Related

- [README.md](README.md) — component check index
- [../docs/c4/components/vault-identity.md](../docs/c4/components/vault-identity.md)
- [../docs/technical/deviations.md](../docs/technical/deviations.md)
