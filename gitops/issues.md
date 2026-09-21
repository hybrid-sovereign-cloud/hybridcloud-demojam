# ZTP Issues Log — Infinite Loop Prevention

Track recurring failures across wipe→rollout cycles. If the **same issue** reappears after a fix+wipe, halt and escalate.

## Baseline (pre wipe-cycle-1 on cluster-fbwcv)

| ID | First seen | Symptom | Root cause | Fix | Cycles |
|----|------------|---------|------------|-----|--------|
| ZTP-001 | 2026-09-21 (fbwcv) | `hs-operators` stuck forever: `waiting for healthy state of ...CustomResourceDefinition` (~8m+); CRDs Established on cluster but Argo health=Missing; zero operator Deployments | Annotation tracking + app-level `ServerSideApply=true`: CRDs never get `argocd.argoproj.io/tracking-id`, so live lookup fails and wave-1 health wait never completes | CRDs: `ServerSideApply=false,Replace=true`; remove SSA/`ApplyOutOfSyncOnly` from `hs-operators` Application | 1 (fixing) |
| ZTP-002 | 2026-09-21 (fbwcv) | Sample `UIHealthChecker` + AAP Jobs pointed at `apps.cluster-qvhzm...` on new cluster `fbwcv` | Hardcoded old-cluster apps domain in gitops Jobs/samples | Discover domain via `ingresses.config.openshift.io/cluster` (+ live Routes); UIHealthChecker via PostSync Job | 1 (fixing) |
| ZTP-003 | 2026-09-21 (fbwcv) | `field-content` SharedResourceWarning / OutOfSync on `Namespace/external-secrets` | Parent `values.namespaces` + `hs-eso` both owned the NS | NS only in parent; removed from ESO chart | 1 (fixing) |
| ZTP-004 | 2026-09-21 (fbwcv) | **Cluster break:** OAuth/:443 down; mass OpenShift Project deletion | Wipe used bare plural `projects` from CRD → resolved to `project.project.openshift.io` and deleted platform namespaces | `scripts/ztp-wipe.sh`: **FQ only** `<plural>.hybridsovereign.redhat`; refuse bare names / Project API; protect baseline NS | 1 (halt — rebuild cluster) |

## Recurrence halt rule

If any ID above fails again **after** its listed fix has been pushed and a full wipe+single-trigger, **stop**. Do not wipe again for that same root cause.

**ZTP-004 note:** Never run an ad-hoc wipe that deletes CRD plurals without the API group. Always use `./scripts/ztp-wipe.sh`.
