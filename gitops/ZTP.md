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
./scripts/ztp-app.sh wait-all                 # parallel: all catalog apps
# on failure — fix git, push, then ONLY that app:
./scripts/ztp-app.sh cleanup hs-vault
./scripts/ztp-app.sh redeploy hs-vault
./scripts/ztp-app.sh redeploy-wave 24         # parallel same-wave apps
# walk waves (parallel within each wave by default):
./scripts/ztp-app.sh validate-sequence --from 5 --to 60
./scripts/ztp-app.sh validate-sequence --serial   # optional sequential
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
| 23 | `hs-ingress` | `WildcardsAllowed` on hub IngressController (HCP KubeVirt passthrough) | Ingress operator |
| 24 | `hs-mce` | Multicluster Engine OLM | OLM |
| 26 | `hs-acm` | ACM hub (`MultiClusterHub`) | MCE installing |
| 30 | `hs-quay` | QuayRegistry + OBC | ODF/NooBaa |
| 31 | `hs-gitea` | Gitea | Storage |
| 35 | `hs-aap-config` | JobTemplates / adopt AAP | AAP baseline |
| 38 | `hs-crds` | hybridsovereign CRDs only | — |
| 40 | `hs-operators` | Operator Deployments + image-wait | CRDs + operator image |
| 42 | `hs-platform-configs` | **ZTP prerequisite:** RbacConfig + AAPConfig + QuayConfig | Operators + AAP JTs + RHBK/AAP/Quay secrets |
| 46 | `hs-platform-smoke` | Always-on ACME Entity + **local CloudVirt** + dummy tool CRs | Platform configs ready; CNV adopted |
| 50 | `hs-ui` | Dashboards + plugins + OAuth | UI ImageStreams |
| 60 | `hs-samples` | Workshop sample CRs (**seed-once**: no selfHeal / no prune) | Entity + platform configs |

Parent sync **waits for prior-wave Application health** before creating the next Application CR.

## Cross-dependencies (must not invert)

```
ESO ──► Vault ──► Security (secrets)
Builds ──────────────────────► Operators ──► Platform configs (42) ──► Smoke (46: Entity + local-virt)
                              └────────────────────────────────────► UI
MCE (24) ──► ACM hub (26)
CRDs (38) ──► Operators (40) ──► Platform configs (42) ──► Samples (60, seed-once)
AAP baseline ──► hs-aap-config (JTs) ──► Operators launch AAP jobs for configs
ODF ──► Quay OBC ──► platform-configs Sync hook (plugin secrets)
RHBK adopt ──► RbacConfig secret (rhbk-hub-admin)
CNV adopt ──► CloudVirt local-virt (hs-platform-smoke)
```

`hs-platform-smoke` PostSync waits for QuayConfig/AAPConfig ready, then force-reconciles
AAPOrg/QuayOrg/CloudVirt if they raced ahead. Operators for those kinds use
`reconcilePeriod: 120s` so failed AAP jobs are relaunched without manual annotate.
AAP playbooks wait for configs and CloudVirt reads `event_payload.regarding`.

PlatformOpenshift types on CloudVirt:
- `type: hosted` → Hypershift HostedCluster (containerized control plane) + KubeVirt NodePool.
  Requires hub `IngressController/default` `routeAdmission.wildcardPolicy: WildcardsAllowed`
  (`hs-ingress`) when `baseDomainPassthrough` is used, or guest console stays Unavailable.
  (`type: virt` VM control-plane installs were removed — use hosted/HCP instead.)

Spoke SSO (ZTP):
- **hosted (HCP):** OAuth is set on `HostedCluster.spec.configuration.oauth` (guest OAuth is
  admission-blocked). `hs-spoke-sso-ensure` + provision playbook push Keycloak `sso` realm IDP.
- **aws / openstack:** ACM Policy `hs-spoke-sso` selects ManagedClusters with
  `hybridsovereign.redhat/platformopenshift` (platform-type aws|openstack) and enforces
  OAuth → Keycloak via hub templates (`{{hub ... hub}}` from `open-cluster-management`).

```

## Platform configs (ZTP prerequisite)

On every new cluster pointing at `gitops/`, `provision.platformConfigs: true` (default) creates
`hs-platform-configs`, which:

1. **Sync hook** `hs-platform-config-ensure-secrets` — waits for Keycloak / AAP / Quay and
   writes plugin admin credentials into `sovereign-cloud-plugins` (no secrets in Git).
2. Applies always-on CRs: `RbacConfig`, `AAPConfig`, `QuayConfig`.
3. Operators launch AAP JobTemplates (`rbacconfig` / `aapconfig` / `quayconfig` provision).
4. **PostSync hook** `hs-platform-config-wait-ready` — blocks until all three CRs report
   `status.ready=true` (force-reconciles on failure). Parent wave sync will not advance
   past 42 until this succeeds.

Disable only with `provision.platformConfigs: false` (not recommended for production ZTP).

## Local CloudVirt (base ZTP, not a sample)

Every target cluster adopts OpenShift Virtualization (`adopt.cnv: true`). `hs-platform-smoke`
always applies `CloudVirt/local-virt` in `entity-acme-corp` (with Entity + dummy tool CRs).
Sample `PlatformOpenshift` hosted types reference `environment: local-virt`.

## Samples (seed-once)

`provision.samples: true` (default) creates `hs-samples` after smoke. Sync policy is
**prune=false, selfHeal=false** and the Application has **no resources-finalizer**:

- First sync (and later git additions) still apply sample CRs.
- If a user deletes a sample CR in the UI, ArgoCD does **not** recreate it.
- Deleting the `hs-samples` Application does **not** cascade-wipe remaining sample CRs.
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

## Step 0 — Manual secrets (only human / pre-GitOps step)

**Never** commit secret values. **Never** automate `~/.bashrc` into Git.
When reading bashrc, **ignore all `#` commented lines**.

Required uncommented exports (names; workshop aliases accepted):

| Purpose | Preferred vars | Accepted aliases |
|---------|----------------|------------------|
| AWS account | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID` | `AWS_ACCESSKEY`, `AWS_SECRET_KEY`, `AWS_ACCOUNT` |
| OpenStack | `OSO_CLOUDS` (path to `clouds.yaml` file) | — |
| Cluster admin seed | `OCP_HUB_SERVER`, `OCP_HUB_USERNAME`, `OCP_HUB_PASSWORD` | Legacy: `OCP_SERVICES_*`, `OCP_CENTRAL_*` |

Upload into `sovereign-secrets` (do **not** label `gitops-owned`; wipe preserves these names):

```bash
# aws-credentials → Vault aws/accounts/{example-admin,acme-dev,route53} + oso route53
oc -n sovereign-secrets create secret generic aws-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=... \
  --from-literal=AWS_SECRET_ACCESS_KEY=... \
  --from-literal=ACCOUNT_ID=...

# oso-clouds → Vault oso/accounts/example-admin
oc -n sovereign-secrets create secret generic oso-clouds \
  --from-file=clouds.yaml="$OSO_CLOUDS"

# openshift-kubeadmin-seed → Vault openshift-services-kubeadmin (+ plugin-cred-sync)
oc -n sovereign-secrets create secret generic openshift-kubeadmin-seed \
  --from-literal=api_host=api.<cluster-host>:6443 \
  --from-literal=username=... \
  --from-literal=password=...
```

After Vault + ESO are up, `hs-security` PushSecrets sync these into Vault. No mid-rollout password patches.

## New-cluster checklist

1. **Step 0** secrets in `sovereign-secrets` (above).
2. Install OpenShift GitOps + instance `openshift-gitops`.
3. Ensure baseline adoptees (AAP, RHBK/Keycloak, ODF) — required for platform configs ZTP.
4. Root Application → `path: gitops`, `targetRevision: main`, auto-sync.
5. Prefer `./scripts/ztp-app.sh validate-sequence` on the first cluster (includes wave 42 configs).
6. Confirm `hs-platform-configs` Synced+Healthy before relying on tenant CRs.
7. Fresh cold start: `./scripts/ztp-wipe.sh` (preserves Step 0 secrets; single field-content trigger).

## Recovery

- Single app: `./scripts/ztp-app.sh cleanup APP && ./scripts/ztp-app.sh redeploy APP`
- Full ZTP wipe: only `./scripts/ztp-wipe.sh`
- Never delete `sovereign-*` namespaces as remediation
