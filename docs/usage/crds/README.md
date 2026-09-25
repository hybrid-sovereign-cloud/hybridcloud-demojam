# CRD usage guide

API group: `hybridsovereign.redhat/v1alpha1`  
Where CRs live: `entity-<name>` namespaces (tenant) or `sovereign-cloud` / `sovereign-cloud-plugins` (platform).

## Order of operations

```text
Entity → Rbac / Persona → Cloud* → Platform* → Team → Project → Assignment → Plugins
```

## Catalog

| Kind | Purpose | Guide |
|------|---------|-------|
| **Entity** | Tenant + `entity-*` namespace | [entity.md](entity.md) |
| **Rbac** / **Persona** | Groups and people | [rbac-persona.md](rbac-persona.md) |
| **CloudAWS** | AWS account + DNS slug | [cloudaws.md](cloudaws.md) |
| **CloudOSO** | RHOSO / OpenStack cloud | [cloudoso.md](cloudoso.md) |
| **CloudVirt** | CNV / virt cluster target | [cloudvirt.md](cloudvirt.md) |
| **PlatformOpenshift** | Spoke OpenShift cluster | [platformopenshift.md](platformopenshift.md) |
| **Team** | Team features (Istio/Argo flags) | [team-project-assignment.md](team-project-assignment.md) |
| **Project** | App project name | [team-project-assignment.md](team-project-assignment.md) |
| **Assignment** | Team → platform + NS + RBAC | [team-project-assignment.md](team-project-assignment.md) |
| **Plugins** | AAPOrg, QuayOrg, Vault, … | [plugins.md](plugins.md) |

## Credentials rule

Never put keys in CR YAML in Git.

1. Create a Secret in the entity namespace (or seed Vault).
2. Point the Cloud\* CR at it with `spec.credentialsSecretRef.name`, **or** set `spec.vaultPath` to an existing Vault KV path.
3. Operators PushSecret → Vault for Job consumption.

## Watch status

```bash
oc get cloudaws,cloudoso,cloudvirt,platformopenshift -n entity-acme-corp
oc describe platformopenshift <name> -n entity-acme-corp
```

Ready signals: `status.ready=true`, `status.status=ready`, or `status.provisionStatus` / Hive phase **Provisioned**.

## How-tos for new accounts / clusters

- [Add CloudAWS](../../how-to/add-cloudaws.md)
- [Add CloudOSO](../../how-to/add-cloudoso.md)
- [Add CloudVirt](../../how-to/add-cloudvirt.md)
