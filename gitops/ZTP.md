# Zero-Touch Provisioning (ZTP) — GitOps entry `gitops/`

## Contract

On a **new** OpenShift cluster with OpenShift GitOps installed:

1. Create one root Application pointing at this repo path `gitops/` @ `main` (e.g. `field-content`).
2. From that point, **all** Hybrid Sovereign platform install/config is Argo-driven.
3. No imperative `oc apply` for platform config after the root app exists.

## Sync wave order (parent app-of-apps)

| Wave | Application | Purpose | Hard dependency |
|------|-------------|---------|-----------------|
| 0 | AppProject + Namespaces | Foundation | — |
| 5 | `hs-argocd-capacity` | Scale GitOps controller/repo for phase-1 | GitOps installed |
| 10 | `hs-eso` | External Secrets Operator | OLM |
| 15 | `hs-builds` | ImageStreams + BuildConfigs (start early) | `sovereign-cloud` NS |
| 20 | `hs-vault` | Vault STS + init | Storage class |
| 22 | `hs-security` | Vault backend / PushSecrets | Vault Ready |
| 25 | `hs-acm` | ACM + MCE (adopt-friendly) | — |
| 30 | `hs-quay` | QuayRegistry + OBC | ODF/NooBaa |
| 31 | `hs-gitea` | Gitea | Storage |
| 35 | `hs-aap-config` | JobTemplates / adopt AAP | AAP baseline present |
| 40 | `hs-operators` | CRDs + operators (**image-wait PreSync**) | `hybridsovereign-ansible-operator:latest` |
| 50 | `hs-ui` | Dashboards + console plugins + OAuthClients | UI ImageStreams |
| 60 | `hs-samples` | Demo CRs | CRDs + operators Healthy |

Parent sync **waits for prior-wave Application health** before creating the next Application CR.

## Known ZTP failure modes (and mitigations)

| Failure | Why | Mitigation in-repo |
|---------|-----|--------------------|
| Shared Namespace (`sovereign-ui`) | Parent + `hs-ui` both owned NS | NS only in parent `namespaces.yaml` |
| Namespace pruned / Terminating | Child prune after removing NS from desired + tracking-id on child | `Prune=false` on all parent Namespaces; never manage NS in child apps |
| Operators crash / ImagePullBackOff | Builds not finished when Deployments sync | `image-wait` Sync hook (wave 5) inside `hs-operators` |
| `scope denied: user:full` on dashboards | SA OAuth client cannot request `user:full` | Real `OAuthClient` + bootstrap Job |
| Sample CRs OutOfSync forever | Operator/ephemeral annotations + status | `ignoreDifferences` on `hs-samples` |
| SSA ComparisonError on samples | Desired fields absent from CRD OpenAPI (e.g. `AAPOrg.spec.description`) | Manifests must match live CRD schema exactly |
| CRD forever OutOfSync | Empty `metadata.labels:` in YAML / API default `spec.conversion` | Drop null labels; `ignoreDifferences` on CRD status/conversion |
| PushSecret forever OutOfSync | ESO injects defaults + status | Align defaults in manifest; ignore `.status` |
| AAP extra_vars nested JSON | Controller drops `event_payload.note` | Launch with `extra_vars` as JSON string; playbooks tolerate missing note |
| AAP project dirty checkout | `scm_update_on_launch` fails after wipe | Seed sets `scm_delete_on_update` + force project update |
| Helm template fail (`hs-aap-config`) | AAP injector `{{ token }}` parsed by Helm | Escape with `` {{`{{ token }}`}} `` |
| Quay/Gitea thrash | Operand mutates spec/status | `ignoreDifferences` + `RespectIgnoreDifferences` |
| Argo controller OOM / slow sync | 1 shard, heavy SSA | `hs-argocd-capacity` → 2 controller shards, 2 repo replicas, 8Gi limit |
| Parallel child re-sync races | After first install, apps selfHeal independently | Retries + `ApplyOutOfSyncOnly` + resource waves inside charts |
| Baseline missing (AAP/RHBK/ODF) | Adopt-not-install | Documented; Jobs fail closed with clear logs |
| Vault empty after wipe | vault-init rotates root; KV empty | `hs-plugin-cred-sync` PostSync seeds hybridsovereign KV from cluster Secrets / SA token / field-content values |
| Wave inversion | Manual sync of samples before operators | Parent wave annotations 5→60; do not reorder |
| CRD health wait forever | Apply path never persists `tracking-id` on CRDs (annotation-only) | Embed `tracking-id` + `app.kubernetes.io/instance` on CRDs; ArgoCD `annotation+label`; per-CRD `ServerSideApply=false,Replace=true` |
| Hardcoded apps domain | Lab URLs baked into Jobs/samples | Discover `ingresses.config.openshift.io/cluster` (+ Routes); UIHealthChecker PostSync Job |
| Wipe deletes OpenShift Projects | Bare `oc delete projects` hits `project.project.openshift.io` | **Only** `./scripts/ztp-wipe.sh` — FQ `*.hybridsovereign.redhat` |

## Cross-dependencies (must not invert)

```
ESO ──► Vault ──► Security (secrets)
Builds ──────────────────────► Operators ──► Samples
                              └────────────► UI
AAP baseline ──► hs-aap-config (JobTemplates)
ODF ──► Quay OBC
CRDs (operators) ──► Samples
```

## Operator image gate

`gitops/custom-operators/image-wait.yaml` Sync hook blocks Deployments until
`imagestream/hybridsovereign-ansible-operator:latest` exists. On a cold cluster,
expect operators Application to stay Progressing until first BC completes (~2–5m).

## Argo capacity (phase 1)

`hs-argocd-capacity` patches the **adopted** `ArgoCD/openshift-gitops` CR:

- Application controller: 2 shards, 2–8Gi memory, higher processors
- Repo server: 2 replicas, 2Gi limit
- Server: 1Gi limit

Re-run is idempotent (Sync hook Job).

## New-cluster checklist

1. Install OpenShift GitOps Operator + instance `openshift-gitops`.
2. Ensure baseline adoptees exist if required (AAP, RHBK/Keycloak, ODF) — or disable related `provision.*` flags.
3. Create root Application → `path: gitops`, `targetRevision: main`, auto-sync.
4. Watch waves 5→60; do not manually sync children out of order unless recovering.
5. Confirm `hs-builds` Completes before expecting `hs-operators` / `hs-ui` Healthy.
6. Enable console plugins via `console.operator` only after `hs-ui` Healthy (or automate in a later wave).

## Recovery

- Failed Sync hook: delete Job `*-image-wait` / `argocd-capacity-tune` and hard-refresh the Application.
- Stuck OutOfSync with SharedResourceWarning: ensure resource is owned by exactly one Application.
- Never delete `sovereign-*` namespaces as a remediation.
- **Full ZTP wipe:** only `./scripts/ztp-wipe.sh` (or `--wipe-only` / `--dry-run`). Never ad-hoc `oc delete <plural>` from CRD short names — `projects` destroys the cluster (ZTP-004).
