# Workshop — ZTP guardrails

Operators running the Hybrid Sovereign demojam on **50+** OpenShift clusters must follow these rules.

## Absolute

| Rule | Detail |
|------|--------|
| Zero hardcoding | No cluster `apps.` / `api.` domains, IPs, or passwords in Git manifests |
| Dynamic credentials | Only bashrc → `sovereign-secrets` → PushSecret → Vault differs per cluster |
| Absolute GitOps | Config changes only via Git commit to this repo; Argo natural poll/selfHeal |
| No mid-rollout sync | Forbidden: `argocd app sync`, hard refresh annotations, forced sync patches during soak |
| Secret boundary | `~/.bashrc` is manual Day 0 only; ignore `#` comments |
| Never delete `sovereign-*` NS shells | Empty contents via wipe script only |
| FQ wipe only | Always `./scripts/ztp-wipe.sh` — never bare CRD plurals (ZTP-004) |

## Failure handling

| Situation | Action |
|-----------|--------|
| One `hs-*` app stuck | Investigate read-only → fix in Git → push → `./scripts/ztp-app.sh cleanup APP` → wait natural sync |
| Same root cause after fix+wipe | Log in `gitops/issues.md` and **HALT** that thread (no wipe loop) |
| Fresh cold start | Full `./scripts/ztp-wipe.sh` (includes single field-content trigger) |

## Sleep-poll

Default interval **3–5 minutes**. Checkpoint to `/tmp/ztp-agent-state/` before each sleep. Long soaks (hours) are expected for ACM/MCE and cloud provision jobs.

## Platform types

`PlatformOpenshift.spec.type`: `openstack` | `aws` | `hosted`.  
Environments: `CloudOSO`, `CloudAWS`, `CloudVirt`.

See [ZTP.md](../../../gitops/ZTP.md) and [issues.md](../../../gitops/issues.md).
