# Zero-Touch Provisioning (ZTP) — GitOps entry `gitops/`

## Contract

On a **new** OpenShift cluster with OpenShift GitOps installed:

1. Create one root Application pointing at this repo path `gitops/` @ `main` (e.g. `field-content`).
2. From that point, **all** Hybrid Sovereign platform install/config is Argo-driven.
3. No imperative `oc apply` for platform config after the root app exists.

## Per-app development loop (before full wipe)

For **50+ cluster** ZTP, each `hs-*` Application must be independently deployable and idempotent.

```bash
./scripts/ztp-app.sh list
./scripts/ztp-app.sh status
./scripts/ztp-app.sh wait hs-vault
# on failure — fix git, push, then ONLY that app:
./scripts/ztp-app.sh cleanup hs-vault
./scripts/ztp-app.sh redeploy hs-vault
# walk waves after a change:
./scripts/ztp-app.sh validate-sequence --from 5 --to 60
```

**Do not** run `./scripts/ztp-wipe.sh` while debugging a single app. Full wipe is the **final** soak after every app is Healthy in isolation.

## Sync wave order (parent app-of-apps)

| Wave | Application | Purpose | Hard dependency |
|------|-------------|---------|-----------------|
| 0 | AppProject + Namespaces | Foundation | — |
| 5 | `hs-argocd-capacity` | Scale GitOps controller/repo | GitOps installed |
| 10 | `hs-eso` | External Secrets Operator | OLM |
| 15 | `hs-builds` | ImageStreams + BuildConfigs | `sovereign-cloud` NS |
| 20 | `hs-vault` | Vault STS + init + unseal CronJob | Storage class |
| 22 | `hs-security` | ClusterSecretStore / PushSecrets | Vault **unsealed** |
| 24 | `hs-mce` | Multicluster Engine OLM | OLM |
| 26 | `hs-acm` | ACM hub (`MultiClusterHub`) | MCE installing |
| 30 | `hs-quay` | QuayRegistry + OBC | ODF/NooBaa |
| 31 | `hs-gitea` | Gitea | Storage |
| 35 | `hs-aap-config` | JobTemplates / adopt AAP | AAP baseline |
| 38 | `hs-crds` | hybridsovereign CRDs only | — |
| 40 | `hs-operators` | Operator Deployments + image-wait | CRDs + operator image |
| 50 | `hs-ui` | Dashboards + plugins + OAuth | UI ImageStreams |
| 60 | `hs-samples` | Demo CRs | CRDs + operators Healthy |

Parent sync **waits for prior-wave Application health** before creating the next Application CR.

## Cross-dependencies (must not invert)

```
ESO ──► Vault ──► Security (secrets)
Builds ──────────────────────► Operators ──► Samples
                              └────────────► UI
MCE (24) ──► ACM hub (26)
CRDs (38) ──► Operators (40) ──► Samples (60)
AAP baseline ──► hs-aap-config
ODF ──► Quay OBC
```

## Known ZTP failure modes (and mitigations)

See `gitops/issues.md` for the live wipe-cycle log (ZTP-001…016).

| Failure | Why | Mitigation in-repo |
|---------|-----|--------------------|
| Shared Namespace | Parent + child both own NS | NS only in parent; `Prune=false` on NS |
| Operators before image | Builds not finished | `image-wait` Sync hook in `hs-operators` |
| Vault sealed after reboot | One-shot init Job | `vault-unseal` CronJob (ZTP-016) |
| CRD tracking forever | SSA + annotation-only | Embed tracking-id + instance label; `hs-crds` Replace |
| ACM/MCE uninstall stuck | Dead webhooks / finalizers | Wipe F3/F4 + per-app `ztp-app.sh cleanup hs-mce|hs-acm` |
| Full wipe destroys Projects | Bare `projects` plural | **Only** `./scripts/ztp-wipe.sh` FQ deletes |

## Operator image gate

`gitops/custom-operators/image-wait.yaml` Sync hook blocks Deployments until
`imagestream/hybridsovereign-ansible-operator:latest` exists.

## New-cluster checklist

1. Install OpenShift GitOps + instance `openshift-gitops`.
2. Ensure baseline adoptees (AAP, RHBK, ODF) or disable related `provision.*`.
3. Root Application → `path: gitops`, `targetRevision: main`, auto-sync.
4. Prefer `./scripts/ztp-app.sh validate-sequence` on the first cluster.
5. After all apps Healthy: optional `./scripts/ztp-wipe.sh` soak to prove cold ZTP.

## Recovery

- Single app: `./scripts/ztp-app.sh cleanup APP && ./scripts/ztp-app.sh redeploy APP`
- Full ZTP wipe: only `./scripts/ztp-wipe.sh`
- Never delete `sovereign-*` namespaces as remediation
