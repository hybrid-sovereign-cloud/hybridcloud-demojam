# Sample Custom Resources

Sanitized reference CRs, for **manual apply** and for reading. These files are
**not** the ZTP deploy path.

Most kinds are deployed for you by ArgoCD — see
[ZTP sample policy](../docs/getting-started/ztp.md#sample-policy) for exactly
which, and why `CloudOSO`, `CloudAWS` and `OpenStackMigration` are not. The
live manifests are under `gitops/apps/{samples,platform-smoke,platform-fabric}/`.

For a guided walk through these kinds in dependency order, use the
[workshop](../docs/workshop/README.md).

## Prerequisites

- Hybrid Sovereign operator deployed (`sovereign-cloud`, `sovereign-cloud-plugins`)
- Target entity namespace exists (e.g. `entity-acme-corp`) for namespace-scoped CRs
- Vault paths referenced in samples must exist with placeholder credentials

## Apply instructions

### Single sample

```bash
oc apply -f samples/entity/acme-corp.yaml --context=hub-admin
```

### All samples (kustomize)

```bash
oc apply -k samples/ --context=hub-admin
```

### Recommended apply order

1. **Entity** — creates entity namespace via primary operator
2. **RbacConfig** — cluster-wide Keycloak RBAC (plugins namespace)
3. **Rbac** — entity-scoped group definitions
4. **Team**, **Project**, **Persona**
5. **CloudInfrastructure** (platform, `sovereign-cloud`) — cloud sites with admin credentials
6. **CloudOSO** / **CloudAWS** / **CloudVirt** — tenant cloud projects (`spec.cloudRef` names the CloudInfrastructure)
7. **PlatformOpenshift** — after cloud env is `status.ready`
8. **Assignment** — binds teams to clusters
9. Plugin CRs: **AAPConfig**, **AAPOrg**, **QuayConfig**, **QuayOrg**, **Vault**, **VaultKV**
10. **OpenStackMigration**, **Iaac** (optional)

## Sanitization

The following were stripped or replaced in all samples:

- AWS account IDs → `000000000000`
- Real hostnames (`*.BASE_DOMAIN`, `*.opentlc.com`) → `*.example.com`
- Environment-specific Vault paths (`shc_admin`) → `example-admin`
- Credential fields → `REDACTED`

## Sample inventory

**Total samples:** 123

| Kind | Count |
|------|-------|
| `aapconfig/` | 1 |
| `aaporg/` | 5 |
| `assignment/` | 15 |
| `cloudaws/` | 4 |
| `cloudinfrastructure/` | 3 |
| `cloudoso/` | 8 |
| `entity/` | 3 |
| `iaac/` | 1 |
| `openstackmigration/` | 4 |
| `persona/` | 7 |
| `platformopenshift/` | 10 |
| `project/` | 4 |
| `quayconfig/` | 1 |
| `quayorg/` | 5 |
| `rbac/` | 38 |
| `rbacconfig/` | 1 |
| `team/` | 4 |
| `vault/` | 3 |
| `vaultkv/` | 6 |

## Directory layout

```
samples/
├── kustomization.yaml
├── README.md
├── entity/
├── team/
├── assignment/
└── ...
```

