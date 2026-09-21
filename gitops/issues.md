# ZTP Issues Log — Infinite Loop Prevention

Track recurring failures across wipe→rollout cycles. If the **same issue** reappears after a fix+wipe, halt and escalate.

## Baseline (pre wipe-cycle-1 on cluster-fbwcv)

| ID | First seen | Symptom | Root cause | Fix | Cycles |
|----|------------|---------|------------|-----|--------|
| ZTP-001 | 2026-09-21 (fbwcv, **recurred l9mxc**) | `hs-operators` stuck forever waiting for CRD healthy; CRDs lack `tracking-id`; zero Deployments | Annotation tracking + apply path never persists `tracking-id` on CRDs (SSA=false/Replace insufficient) | **HALT wipe loop.** Stronger fix: embed `tracking-id` + `app.kubernetes.io/instance` on CRDs; ArgoCD `resourceTrackingMethod: annotation+label` via capacity tune. Next wipe only after this ships | 2 — **HALTED** |
| ZTP-002 | 2026-09-21 (fbwcv) | Sample `UIHealthChecker` + AAP Jobs pointed at `apps.cluster-qvhzm...` on new cluster `fbwcv` | Hardcoded old-cluster apps domain in gitops Jobs/samples | Discover domain via `ingresses.config.openshift.io/cluster` (+ live Routes); UIHealthChecker via PostSync Job | 1 (fixing) |
| ZTP-003 | 2026-09-21 (fbwcv) | `field-content` SharedResourceWarning / OutOfSync on `Namespace/external-secrets` | Parent `values.namespaces` + `hs-eso` both owned the NS | NS only in parent; removed from ESO chart | 1 (fixing) |
| ZTP-004 | 2026-09-21 (fbwcv) | **Cluster break:** OAuth/:443 down; mass OpenShift Project deletion | Wipe used bare plural `projects` from CRD → resolved to `project.project.openshift.io` and deleted platform namespaces | `scripts/ztp-wipe.sh`: **FQ only** `<plural>.hybridsovereign.redhat`; refuse bare names / Project API; protect baseline NS | 1 (halt — rebuild cluster) |
| ZTP-005 | 2026-09-21 (l9mxc) | `hs-security` Degraded; PostSync `hs-plugin-cred-sync` CrashLoop | Job used PyYAML + curl; `openshift/cli` has neither reliably | Rewrite seed to python3 stdlib (`urllib`/`json`/`re`) only; also seed `aap-admin` for PushSecret | 1 (fixing) |
| ZTP-006 | 2026-09-21 (l9mxc) | `hs-aap-config` Sync hook `hs-aap-cred-sync` Failed (backoff); no `aap-operator-credentials` | ClusterRole lacked `ingresses.config.openshift.io` + `routes` | Expand ClusterRole | 1 (**verified** after wipe) |
| ZTP-007 | 2026-09-21 (l9mxc) | `hs-quay` Degraded: Subscription `ResolutionFailed` | Orphan CSV after wipe | Wipe deletes quay Subscription/IP/CSV | 1 (**quay Healthy** after fix) |
| ZTP-008 | 2026-09-21 (l9mxc) | All BuildConfigs `PushImageToRegistryFailed`; UI/Gitea ImagePullBackOff | Wipe deleted all secrets/SAs in `sovereign-cloud` (+ emptied `external-secrets`) | Preserve dockercfg/builder SAs; never empty `external-secrets`; refresh builder SA | 1 (**builds Complete**) |
| ZTP-009 | 2026-09-21 (l9mxc) | `hs-security` Degraded; CSS `unable to create client`; ESO webhook CrashLoop (`tls.crt` missing); cert-controller Unauthorized | ESO operand damaged by earlier wipe of `external-secrets`; pods kept stale Unauthorized tokens | Wipe soft-restarts ESO pods only (no SA wipe) | 1 (**ESO Ready after soft-restart**) |
| ZTP-010 | 2026-09-21 (l9mxc) | `hs-security` Unknown/Degraded: helm `parse error ... plugin-cred-sync.yaml:208 bad character '{'` | Python f-string `jsonpath={{.data.{f}}}` is invalid Helm | Concatenate jsonpath; bump hs-security 0.1.8; wipe deletes all CSS | 1 (**hs-security Healthy, CSS Valid**) |
| ZTP-011 | 2026-09-21 (l9mxc) | All BuildConfigs `PushImageToRegistryFailed`; registry `invalid token` / SA UID mismatch | Builder dockercfg secret predates recreated SA | Wipe deletes builder SA and dockercfg; waits for a newer secret | 1 (**builds Complete**) |
| ZTP-012 | 2026-09-21 (l9mxc) | `hs-quay` `UpgradePending`; MCE CSV `Pending` | Wipe deleted InstallPlans the Subscriptions still referenced | Delete Subscription+IP+CSV; ignore copied ESO/GitOps CSVs | 1 (**quay + MCE CSV Succeeded**) |
| ZTP-013 | 2026-09-21 (l9mxc) | `hs-acm` stuck Progressing: MultiClusterHub `Uninstalling` / "Pending deletion" | MCE cannot delete ManagedCluster (dead ocm-webhook); merge-patch empty finalizers no-op | Wipe deletes OCM webhooks; JSON-remove finalizers on ManagedCluster→MCE→MCH | 2 (fixing) |

## Recurrence halt rule

If any ID above fails again **after** its listed fix has been pushed and a full wipe+single-trigger, **stop**. Do not wipe again for that same root cause.

**ZTP-004 note:** Never run an ad-hoc wipe that deletes CRD plurals without the API group. Always use `./scripts/ztp-wipe.sh`.
