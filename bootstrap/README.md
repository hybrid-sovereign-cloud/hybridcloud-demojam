# Bootstrap (legacy / chart build)

**Runtime install path is [`../gitops/`](../gitops/) — see [`../docs/gitops-install.md`](../docs/gitops-install.md).**

This directory still holds Helm charts, make targets, and helpers used to **build and push** OCI artifacts. It is **not** the dual central+services installer anymore. One OpenShift **hub** runs everything; spokes are PlatformOpenshift clusters.

---

## Prerequisites

### 1. Environment Variables

Export before `make` targets that build/push charts. Run `make check-env` where applicable.

#### Hub (OpenShift)

| Variable | Description |
|---|---|
| `OCP_CENTRAL_SERVER` | Hub API URL (legacy name; single cluster) |
| `OCP_CENTRAL_USERNAME` | OpenShift username |
| `OCP_CENTRAL_PASSWORD` | OpenShift password |

> `OCP_SERVICES_*` variables are **legacy dual-cluster** leftovers — unused for single-hub GitOps. Prefer hub vars only.

#### OCI / Quay Registry — Admin Token

| Variable | Description |
|---|---|
| `OCI_REGISTRY` | Registry URL or hostname |
| `OCI_REGISTRY_TOKEN` | Admin bearer token |

#### OCI / Quay Registry — Robot (Read-Only)

| Variable | Description |
|---|---|
| `OCI_ROBOT_USERNAME` | Robot account username |
| `OCI_ROBOT_PASSWORD` | Robot account token |

#### Image Registry (Red Hat)

| Variable | Description |
|---|---|
| `IMAGE_REGISTRY` | Container image registry |
| `IMAGE_REGISTRY_USERNAME` | Registry login username |
| `IMAGE_REGISTRY_PASSWORD` | Registry login password/token |

#### Git

| Variable | Description |
|---|---|
| `GITHUB_URL` | Repository base URL |
| `GITHUB_TOKEN` | Personal access token with `repo` scope |

### 2. Cluster Requirements

| Requirement | Notes |
|---|---|
| **OpenShift 4.x hub** | Single cluster with GitOps, AAP, RHBK, ODF, CNV, cert-manager (baseline) |
| **ArgoCD** | Root Application → `gitops/` @ `main` |

### 3. Quay Robot Account

OCI robot has **read-only** access; admin token used for writes.

---

## Make Targets (chart / image build)

| Target | Description |
|---|---|
| `make check-env` | Verify env vars + logins |
| `make upload-*-chart` | Push Helm charts to OCI |
| `make ansible-runner` | Build ansible-runner image |

Prefer documenting new day-2 flows under [`../docs/`](../docs/).

---

## Related

- [docs/README.md](../docs/README.md)
- [gitops/ZTP.md](../gitops/ZTP.md)
- Obsolete dual-cluster notes: [`../obsolete/`](../obsolete/)
