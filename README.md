# Hybrid Sovereign Cloud

Single-hub Hybrid Sovereign platform delivered **only** via ArgoCD sync of [`gitops/`](gitops/).

Prebuilt images and the `mce-cluster-build` Helm chart live on public Quay:

`quay.io/gauravshankar/<name>`

ZTP pulls those images — **no in-cluster ImageStream builds** by default (`provision.builds: false`).

## Getting started

### Day 0 (once per hub)

1. Install/adopt on the hub: OpenShift GitOps, AAP Controller, RHBK/Keycloak, ODF/NooBaa, CNV, cert-manager.
2. Create secrets in `sovereign-secrets` (never commit credentials). See [docs/workshop/](docs/workshop/) Day 0 notes and [docs/lab-config.md](docs/lab-config.md).
3. Point ArgoCD at this repo:
   - **path:** `gitops`
   - **revision:** `main` (or your pin)
4. Sync the root app once. After that: **Git only** — no mid-rollout `oc apply` for platform config.

### Verify

```bash
oc get applications -n openshift-gitops
oc get deploy -n sovereign-cloud
oc get cloudvirt,entity -A
```

Operators and UI should pull:

| Image | Purpose |
|-------|---------|
| `quay.io/gauravshankar/hybridsovereign-ansible-operator:latest` | All CR operators |
| `quay.io/gauravshankar/sovereign-cloud-dashboard:latest` | Admin UI |
| `quay.io/gauravshankar/tenancy-dashboard:latest` | Tenant UI |
| `quay.io/gauravshankar/sovereign-admin-plugin:latest` | Admin console plugin |
| `quay.io/gauravshankar/sovereign-tenant-plugin:latest` | Tenant console plugin |
| `docker.io/gitea/gitea:1.22.3-rootless` | Gitea on the hub |
| `oci://quay.io/gauravshankar/mce-cluster-build` | Spoke cluster charts |

Rebuild/push (maintainers):

```bash
export OCI_HOST=quay.io/gauravshankar
export OCI_REGISTRY_TOKEN=…   # never commit
make -C charts upload-mce-chart OCI_REGISTRY_HOST="$OCI_HOST"
# UI + operator: see Makefile `push-ztp-images`
```

## Adding a new cloud

| Cloud | Guide |
|-------|--------|
| **CloudOSO** (RHOSO / OpenStack) | [docs/how-to/add-cloudoso.md](docs/how-to/add-cloudoso.md) |
| **CloudAWS** | [docs/how-to/add-cloudaws.md](docs/how-to/add-cloudaws.md) |
| **CloudVirt** (CNV / local virt) | [docs/how-to/add-cloudvirt.md](docs/how-to/add-cloudvirt.md) |

Flow for each:

1. Credentials Secret in the entity namespace (or Vault path).
2. Create the **Cloud\*** CR with `spec.baseDomain`.
3. Wait until ready (`status.domain` / slug).
4. Create **PlatformOpenshift** referencing that environment.
5. Optional: **Assignment** → Team for tenant access.

## Usage

- **CRD reference:** [docs/usage/crds/](docs/usage/crds/)
- **UI:** [docs/usage/ui/](docs/usage/ui/)
- **Mental model:** [docs/flow.md](docs/flow.md)
- **Workshop:** [docs/workshop/](docs/workshop/)
- **ZTP notes:** [docs/ztp.md](docs/ztp.md)
- **All docs:** [docs/README.md](docs/README.md)
- **Design specs:** [specs/README.md](specs/README.md)

```text
Git → ArgoCD → Operators → AAP JobTemplates → AWS / RHOSO / Virt spokes
```

No Kafka, AMQ Streams, or EDA activations on the active path.

## Non-negotiable

1. **No secrets in Git** — Vault + ExternalSecret / PushSecret only.
2. **Never delete `sovereign-*` namespaces.**
3. **GitOps after Day 0** — `oc` for investigation only.
4. **No lab domains in Git** — use `.env` / `values-lab.yaml` / Vault lab-config ([docs/lab-config.md](docs/lab-config.md)).

## Local development

Source under `operator/`, `ui/`, `eda/` (AAP playbooks), `samples/` for builds. **Runtime deploy path is only `gitops/`.**
