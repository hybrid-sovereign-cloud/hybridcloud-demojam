# CRD usage guide

API group: `hybridsovereign.redhat/v1alpha1`  
Where CRs live: `entity-<name>` namespaces (tenant) or `sovereign-cloud` / `sovereign-cloud-plugins` (platform).

For the guided, CR-by-CR version of this reference, work through the
[workshop](../../workshop/README.md) — it introduces these kinds in exactly
the order below.

## Order of operations

```text
CloudInfrastructure (platform) → Entity → Rbac / Persona → Team → Project
  → Plugins (Vault/VaultKV, AAPOrg, QuayOrg) → Cloud* (cloudRef)
  → PlatformOpenshift → Assignment

HybridFabric (platform) → CloudInfrastructure (platform) → Cloud* (tenant)
  → CloudGateway (platform, cloudRef) → HybridNetwork → NetworkPlacement
```

NetworkPlacement backends are CloudOSO, CloudVirt and CloudAWS projects. PlatformOpenshift clusters do not join the fabric ([fabric.md](fabric.md), [design §15](../../concepts/fabric-design.md#15-platformopenshift-and-the-fabric)).

## Catalog

| Kind | Purpose | Guide |
|------|---------|-------|
| **CloudInfrastructure** | Platform cloud site (OpenStack, hub virt, AWS) | [cloudinfrastructure.md](cloudinfrastructure.md) |
| **Entity** | Tenant + `entity-*` namespace | [entity.md](entity.md) |
| **Rbac** / **Persona** | Groups and people | [rbac-persona.md](rbac-persona.md) |
| **CloudAWS** | AWS account + DNS slug | [cloudaws.md](cloudaws.md) |
| **CloudOSO** | Tenant OpenStack project | [cloudoso.md](cloudoso.md) |
| **CloudVirt** | Tenant project on OpenShift Virtualization | [cloudvirt.md](cloudvirt.md) |
| **HybridFabric** / **CloudGateway** / **TransportLink** | Platform EVPN fabric and site attachments | [fabric.md](fabric.md) |
| **HybridNetwork** / **NetworkPlacement** | Tenant VRF and its placements | [fabric.md](fabric.md) |
| **PlatformOpenshift** | Spoke OpenShift cluster (not a fabric member) | [platformopenshift.md](platformopenshift.md) |
| **Team** | Team features (Istio/Argo flags) | [team-project-assignment.md](team-project-assignment.md) |
| **Project** | App project name | [team-project-assignment.md](team-project-assignment.md) |
| **Assignment** | Team → platform + NS + RBAC | [team-project-assignment.md](team-project-assignment.md) |
| **Plugins** | AAPOrg, QuayOrg, Vault, … | [plugins.md](plugins.md) |
| **Iaac** | Config-as-code export of every CR to Gitea | [iaac.md](iaac.md) |

## Credentials rule

Never put keys in CR YAML in Git.

1. Site admin credentials belong on the platform [CloudInfrastructure](cloudinfrastructure.md) (`spec.credentialsRef`: a Vault path or a Secret in `sovereign-cloud`).
2. Tenant Cloud\* projects reference it with `spec.cloudRef`. The older per-project `spec.credentialsSecretRef` / `spec.vaultPath` still work while `cloudRef` is unset (deprecated for CloudOSO and CloudVirt).
3. Operators PushSecret → Vault for Job consumption.

## Watch status

```bash
oc get cloudinfrastructure,hybridfabric,cloudgateway -n sovereign-cloud
oc get cloudaws,cloudoso,cloudvirt,platformopenshift,hybridnetwork,networkplacement -n entity-example-corp
oc describe platformopenshift <name> -n entity-example-corp
```

Ready signals: `status.ready=true`, `status.status=ready`, or `status.provisionStatus` / Hive phase **Provisioned**.

## Walkthroughs

- [Workshop](../../workshop/README.md): [Lab 2](../../workshop/lab-06-register-cloud.md) registers CloudInfrastructure and tenant projects; [Lab 6](../../workshop/lab-09-hybrid-fabric.md) builds and verifies the fabric
- Fabric design and reference implementation: [fabric-design.md](../../concepts/fabric-design.md) · live record [fabric-verify.md](../../concepts/fabric-verify.md)

## How-tos for new accounts / clusters

- [Add CloudAWS](../../how-to/add-cloudaws.md)
- [Add CloudOSO](../../how-to/add-cloudoso.md)
- [Add CloudVirt](../../how-to/add-cloudvirt.md)

## Tightening validation

The fabric CRDs ship in a permissive form while live objects migrate to the CloudInfrastructure model: deprecated fields are still accepted, and the required fields, immutables and CEL rules for existing kinds are commented out. CloudInfrastructure and the new fields are validated already. Markers in `gitops/custom-operators/crds/crd-*.yaml`:

| Marker | Action |
|--------|--------|
| `# >>> TIGHTEN-LATER-ADD` … `# <<< TIGHTEN-LATER-ADD` | Uncomment the lines in between (required fields, immutables, CEL, narrowed enums) |
| `# >>> TIGHTEN-LATER-DROP` … `# <<< TIGHTEN-LATER-DROP` | Delete the block (deprecated fields) |
| line ending in `# TIGHTEN-LATER-REMOVE` | Delete the line (old enum, old `required`, lab-specific defaults) |

Apply them only after the live objects are migrated and no PlatformOpenshift-backed placement remains (cutover step "Tighten"):

```bash
cd gitops/custom-operators/crds
sed -i \
  -e '/# TIGHTEN-LATER-REMOVE$/d' \
  -e '/^ *# >>> TIGHTEN-LATER-DROP$/,/^ *# <<< TIGHTEN-LATER-DROP$/d' \
  -e '/^ *# >>> TIGHTEN-LATER-ADD$/,/^ *# <<< TIGHTEN-LATER-ADD$/{/TIGHTEN-LATER-ADD$/d;s/^\( *\)# /\1/}' \
  crd-*.yaml
```

To keep the deprecated fields for a while, leave out the `-e '…DROP…'` line. Then refresh the copies: `cp crd-*.yaml ../../../operator/config/crd/bases/` and regenerate `operator/primary/helm/templates/crds.yaml` (it is a concatenation of these files).
