# Hybrid Sovereign Cloud

**Multi-tenant sovereign cloud as a Kubernetes API.** One OpenShift hub
governs tenants across OpenStack, AWS and on-premise virtualization — with a
single identity model, one EVPN fabric joining their networks, and every
decision recorded as code.

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Entity
metadata:
  name: mycorp
  namespace: sovereign-cloud
spec:
  description: A new sovereign tenant
  billingID: MYCORP-2026-001
```

That is a complete tenant. From there, roughly twenty more custom resources
give it groups, teams, secrets, a registry, cloud projects, real OpenShift
clusters and a private network stretched across sites — all declarative, all
reconciled, all exported back to Git.

---

## Why it exists

Sovereignty is usually sold as a location. In practice it is three harder
properties, and this platform is built to make each one demonstrable:

**Your tenancy is portable.** Every custom resource — who the tenants are,
what they own, who may touch it — is continuously exported to a Git
repository as redeployable YAML. Nothing is trapped in a vendor console. Shut
the platform off and the description of your estate is still readable.

**Your boundaries are enforced, not promised.** Tenant isolation is a route
target on a shared EVPN fabric, policed by a platform-owned border gateway.
Tenant clusters are deliberately *not* fabric members, because a tenant
cluster-admin controls their own OVN-Kubernetes and could otherwise forge
VNIs. That is a security decision with a written rationale, not an omission.

**Your clouds are interchangeable.** `CloudOSO`, `CloudAWS` and `CloudVirt`
are the same shape. A tenant project on RHOSO and a tenant project on AWS are
described, secured and networked the same way, so moving workloads is a
scheduling question rather than a rewrite.

And the operational claim: **the central cluster comes up first and alone.**
Nothing in a bring-up blocks on a cloud that has not been built yet. An
OpenStack site can arrive six months later, or never.

---

## What you get

| | |
|---|---|
| **One API** | ~26 CRDs in `hybridsovereign.redhat/v1alpha1`, one Ansible operator per kind |
| **Zero-touch provisioning** | Point ArgoCD at `gitops/` once; 18 applications sync in dependency waves |
| **Identity that composes** | Keycloak groups as first-class CRs, referenced by name from every other kind |
| **Hybrid networking** | EVPN/VXLAN fabric joining hub VMs, OpenStack VMs and cloud projects into per-tenant VRFs |
| **Cluster fleet** | Spoke OpenShift on OpenStack, AWS or HyperShift-on-hub, via ACM |
| **Secrets** | Per-tenant Vault with group-mapped policies; no credential ever in Git |
| **Config as code** | Live CRs exported to Gitea every 5 minutes, redeployable into a fresh hub |
| **Two consoles** | Admin and Tenant dashboards, plus OpenShift console plugins |

---

## Getting started

### Day 0 — once per hub

1. **Adopt the prerequisites.** These are never installed or uninstalled by
   this repo: OpenShift GitOps, AAP Controller, RHBK/Keycloak, ODF/NooBaa,
   CNV, cert-manager.
2. **Create Day-0 secrets** in `sovereign-secrets`. Never commit credentials —
   see [docs/getting-started/lab-config.md](docs/getting-started/lab-config.md).
3. **Point ArgoCD at this repo:** path `gitops`, revision `main`.
4. **Sync once.** After that it is Git only — no mid-rollout `oc apply` for
   platform config.

```bash
oc get applications -n openshift-gitops -w
```

### Verify

```bash
oc get applications -n openshift-gitops      # all Synced / Healthy
oc get deploy -n sovereign-cloud             # one operator per kind
oc get entity,cloudinfrastructure -A         # the worked example tenant
oc get iaac -A                               # config-as-code reporting ready
```

Full detail: **[docs/getting-started](docs/getting-started/README.md)**.

### Then learn it

The [**workshop**](docs/workshop/README.md) walks the whole API in dependency
order — you create an `Entity`, then hang identity, teams, secrets, clouds, a
cluster and a stretched network off it, and finish by watching all of it
appear in Git. Labs 0–5 take under an hour; the cluster installs dominate the
rest.

---

## Onboarding a cloud

A cloud is onboarded in two halves, and the split is the whole security model:

```text
PLATFORM ADMIN                          TENANT
──────────────                          ──────
CloudInfrastructure                     CloudOSO / CloudAWS / CloudVirt
  the real site or account                a project on that site
  holds the admin credential              holds no credential at all
  one per site, in sovereign-cloud        one per tenant, in entity-<name>
             │                                        │
             └──────── referenced by spec.cloudRef ───┘
```

Then, per tenant project:

1. Credentials go in a Secret or Vault path — referenced by the
   **CloudInfrastructure**, never by a tenant CR.
2. Create the **Cloud\*** project CR with `spec.cloudRef`.
3. Wait for `status.ready=true` and a `status.domain` slug.
4. Optionally create a **PlatformOpenshift** on it to get a real cluster.
5. Optionally create an **Assignment** to give a Team access there.
6. Optionally place a **HybridNetwork** on it to join the EVPN fabric.

| Cloud | Guide |
|-------|-------|
| **CloudOSO** — RHOSO / OpenStack | [docs/how-to/add-cloudoso.md](docs/how-to/add-cloudoso.md) |
| **CloudAWS** — AWS account | [docs/how-to/add-cloudaws.md](docs/how-to/add-cloudaws.md) |
| **CloudVirt** — OpenShift Virtualization | [docs/how-to/add-cloudvirt.md](docs/how-to/add-cloudvirt.md) |

---

## The custom resources

Three layers. Platform objects hold credentials and are admin-owned; tenant
objects hold only references.

### Platform — one set per hub

| Kind | What it does |
|------|--------------|
| `CloudInfrastructure` | A real cloud: an OpenStack site, an AWS account, the hub's own OpenShift. Holds the admin credential. |
| `HybridFabric` | The shared EVPN underlay. One per hub. Allocates VNIs and route targets. |
| `CloudGateway` | Attaches one CloudInfrastructure to the fabric. |
| `TransportLink` | The tunnel between two gateways. |
| `RbacConfig` | Where identity lives: Keycloak URL, realm, admin credential. |
| `AAPConfig` / `QuayConfig` | Where automation and the registry live. |

### Tenant — per customer, in `entity-<name>`

| Kind | What it does |
|------|--------------|
| `Entity` | **The root.** Creates `entity-<name>` and starts the tenant operator. Everything else hangs off it. |
| `Rbac` | A group. Creates a real Keycloak subgroup. The unit every other CR grants access to. |
| `Persona` | Promotes a group to a platform role (`entityAdmin`, `auditor`, …) the consoles key off. |
| `Team` | A unit of placement, with feature flags. Not a group — groups are `Rbac`. |
| `Project` | A body of work. Becomes a namespace on a spoke when an Assignment places it. |
| `Vault` / `VaultKV` | Tenant Vault instance and a KV mount with per-group policies. |
| `AAPOrg` / `QuayOrg` | Tenant organisation in AAP and Quay, with groups mapped to roles. |
| `CloudOSO` / `CloudAWS` / `CloudVirt` | A tenant project on a `CloudInfrastructure`. |
| `HybridNetwork` | A tenant VRF on the fabric — one VNI and route target. |
| `NetworkPlacement` | Realises that VRF on a specific cloud project. |

### Workload

| Kind | What it does |
|------|--------------|
| `PlatformOpenshift` | A spoke OpenShift cluster: `openstack`, `aws` or `hosted` (HyperShift on the hub's CloudVirt). Never a fabric member. |
| `Assignment` | Binds a Team and its Projects onto a cluster, mapping Rbac groups to roles there. |

### Cross-cutting

| Kind | What it does |
|------|--------------|
| `Iaac` | Exports every CR above to Gitea as redeployable YAML. Reports sync health. |
| `UIHealthChecker` | Smoke-tests a dashboard URL. |
| `OpenStackMigration` | VM migration into a CloudOSO project. |

Dependency order:

```text
Entity → Rbac → Persona → Team → Project → Vault/AAPOrg/QuayOrg
      → Cloud* → PlatformOpenshift → Assignment

HybridFabric → CloudGateway → TransportLink → HybridNetwork → NetworkPlacement
```

Field-level reference: **[docs/reference/crds](docs/reference/crds/README.md)**.

---

## Images

Prebuilt and pulled from public Quay; ZTP does **no** in-cluster builds by
default (`provision.builds: false`).

| Image | Purpose |
|-------|---------|
| `quay.io/gauravshankar/hybridsovereign-ansible-operator:latest` | All CR operators |
| `quay.io/gauravshankar/sovereign-cloud-dashboard:latest` | Admin UI |
| `quay.io/gauravshankar/tenancy-dashboard:latest` | Tenant UI |
| `quay.io/gauravshankar/sovereign-admin-plugin:latest` | Admin console plugin |
| `quay.io/gauravshankar/sovereign-tenant-plugin:latest` | Tenant console plugin |
| `docker.io/gitea/gitea:1.22.3-rootless` | Gitea on the hub |
| `oci://quay.io/gauravshankar/mce-cluster-build` | Spoke cluster charts |

The IaaC sync image is the one exception: it has no published build, so
`hs-iaac` builds it in-cluster from [`iaac/`](iaac/).

Rebuild and push (maintainers):

```bash
export OCI_HOST=quay.io/gauravshankar
export OCI_REGISTRY_TOKEN=…        # never commit
make -C charts upload-mce-chart OCI_REGISTRY_HOST="$OCI_HOST"
# UI + operator: see Makefile target `push-ztp-images`
```

---

## Non-negotiable

1. **No secrets in Git** — Vault plus ExternalSecret / PushSecret only.
2. **Never delete `sovereign-*` namespaces.**
3. **GitOps after Day 0** — `oc` for investigation (and tenant CRs while learning).
4. **No lab domains in Git** — the apps domain is discovered at runtime; see
   [docs/getting-started/lab-config.md](docs/getting-started/lab-config.md).

---

## Repository layout

| Path | What it is |
|------|------------|
| [`gitops/`](gitops/) | **The only runtime deploy path.** ArgoCD syncs this. |
| [`docs/`](docs/README.md) | All documentation |
| [`operator/`](operator/) | Ansible operator roles for every kind |
| [`eda/`](eda/) | The Ansible playbooks the operators launch via AAP |
| [`iaac/`](iaac/) | The config-as-code sync service |
| [`ui/`](ui/) | Dashboards and console plugins |
| [`samples/`](samples/README.md) | Reference CR examples |
| [`specs/`](specs/README.md) | One formal spec per feature |
| [`tests/`](tests/) | Holistic and functional test suites |
| [`bootstrap/`](bootstrap/README.md) | Pre-GitOps bring-up helpers |

Source lives in `operator/`, `ui/`, `eda/` and `iaac/`. **The runtime deploy
path is only `gitops/`.**

---

## Documentation

**[Start here → docs/README.md](docs/README.md)**

- [Getting started](docs/getting-started/README.md) — stand up a hub
- [Concepts](docs/concepts/README.md) — the model and the fabric design
- [Workshop](docs/workshop/README.md) — learn it by building a tenant
- [CRD reference](docs/reference/crds/README.md) — every field
- [How-to](docs/how-to/README.md) — onboard a specific cloud

## License

[Apache 2.0](LICENSE)
