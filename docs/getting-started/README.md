# Getting started

Bringing up a Hybrid Sovereign hub, from an empty OpenShift cluster to a
platform with tenants on it.

## The short version

The platform is delivered **only** by ArgoCD syncing [`gitops/`](../../gitops/).
You point OpenShift GitOps at this repo once; everything else is waves.

```bash
# 1. Adopt the prerequisites on the hub (these are never installed by ZTP):
#    OpenShift GitOps, AAP Controller, RHBK/Keycloak, ODF, CNV, cert-manager
# 2. Create the Day-0 secrets in sovereign-secrets  (see lab-config.md)
# 3. Point an ArgoCD Application at path `gitops`, revision `main`
# 4. Sync once, then watch:
oc get applications -n openshift-gitops -w
```

After that first sync it is **Git only**. `oc apply` against platform config
mid-rollout will be reverted by self-heal, and will confuse the wave ordering.

## Read in this order

| Step | Document |
|------|----------|
| 1. What ZTP does, wave by wave, and how to debug one wave | [ztp.md](ztp.md) |
| 2. Wiring ArgoCD to this repo | [gitops-install.md](gitops-install.md) |
| 3. Keeping cluster-specific values and secrets out of Git | [lab-config.md](lab-config.md) |
| 4. Checking a rollout actually landed | [progress-verify.md](progress-verify.md) |
| 5. Air-gapped / disconnected hubs | [disconnected-deploy.md](disconnected-deploy.md) |

## What you get

A completed sync leaves a hub with:

- the hybridsovereign CRDs and one Ansible operator per kind,
- Vault, Quay, Gitea and the AAP job templates the operators call,
- ACM/MCE for spoke cluster provisioning,
- the EVPN hybrid fabric and the hub's own `CloudVirt`,
- the Admin and Tenant dashboards plus their console plugins,
- IaaC config-as-code exporting every CR to Gitea,
- a worked example tenant (`acme-corp`) with teams, projects, secrets, a
  registry org and a hosted spoke cluster.

## Then what

- Learn the model: [concepts](../concepts/README.md)
- Build a tenant yourself: [workshop](../workshop/README.md)
- Look up a field: [reference/crds](../reference/crds/README.md)

## Non-negotiable

1. **No secrets in Git** — Vault plus ExternalSecret / PushSecret only.
2. **Never delete `sovereign-*` namespaces.**
3. **GitOps after Day 0** — `oc` is for investigation.
4. **No lab domains in Git** — the apps domain is discovered at runtime; see
   [lab-config.md](lab-config.md).
