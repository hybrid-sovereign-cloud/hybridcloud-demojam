# Hardening checks

Retested **2026-07-15** against lab clusters:

- Central: `api.central.lab.example.com`
- Services: `api.services.lab.example.com`

## Current set

| File | Scope |
|------|-------|
| [security-state.md](security-state.md) | Holistic posture (start here) |
| [vault.md](vault.md) | Vault HA both clusters |
| [rhbk.md](rhbk.md) | Keycloak |
| [rhacm.md](rhacm.md) | RHACM |
| [quay.md](quay.md) | Quay |
| [odf.md](odf.md) | ODF / Noobaa |
| [crunchy-postgres.md](crunchy-postgres.md) | PGO |
| [sovereign-namespaces.md](sovereign-namespaces.md) | Namespace topology |
| [ocp-base.md](ocp-base.md) | Spoke base chart |
| [plugin-vault.md](plugin-vault.md) | Per-entity Vault CRs |
| [006-platform-eda-rebuild.md](006-platform-eda-rebuild.md) | EDA / Kafka path (updated) |
| [009-virtualization-vmware.md](009-virtualization-vmware.md) | CNV / MTV |
| [010-cloudoso-vrf-openstack-migration.md](010-cloudoso-vrf-openstack-migration.md) | CloudOSO / migration |
| [ui.md](ui.md) | Dashboards + console plugins |
| [operators-events.md](operators-events.md) | Primary operator + Kafka publish |
| [aap-split.md](aap-split.md) | Central EDA vs services controller |

Historical / obsolete checklists: [archive/](archive/).

## Retest method

```bash
# ArgoCD apps (central only)
oc get applications.argoproj.io -n openshift-gitops -o custom-columns=NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status

# Placement smoke
oc get ns aap gitea amq-streams central-vault --context=<central>
oc get ns aap services-vault sovereign-cloud sovereign-cloud-plugins --context=<services>
oc get kafka -n amq-streams --context=<central>
oc get sts iaac-git-sync -n sovereign-cloud-plugins --context=<services>
oc get deploy -n sovereign-cloud --context=<services> | grep -E 'dashboard|plugin|primary-operator'
```

Update the matching file and `security-state.md` date when findings change.
