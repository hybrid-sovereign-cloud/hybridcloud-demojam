# Hardening Check: OpenShift Virtualization + VMware Integration (Feature 009)

**Component**: OpenShift Virtualization (CNV) + Migration Toolkit for Virtualization (MTV)  
**Feature Branch**: `009-install-virtualization-vmware`  
**Date**: 2026-06-18  
**Retested**: 2026-07-15 — CNV/MTV Argo apps Synced/Healthy on central; content still applicable  
**Reviewer**: platform-team

---

## Secrets Handling

| Check | Status | Notes |
|---|---|---|
| No VMware credentials committed to Git | ✅ | `vmware-bootstrap-credentials` Secret created only via helm `--set` in `make init-central-argo`; no values in any YAML file |
| All credential tasks in `vmware-init` role use `no_log: true` | ✅ | All 4 credential-touching tasks have `no_log: true` |
| VMware credentials delivered via ExternalSecret from Vault | ✅ | `vmware-vcenter-es` ExternalSecret in `openshift-mtv` pulls from Vault `central/vmware-credentials` |
| Vault path `central/data/vmware-credentials` written by Ansible Job (not manually) | ✅ | `vmwareInit` sovereignJob handles the write |
| MTV Provider secret `vmware-vcenter-secret` has `creationPolicy: Owner` | ✅ | ExternalSecret spec sets `creationPolicy: Owner` |

## Network / Least Privilege

| Check | Status | Notes |
|---|---|---|
| MTV namespace `openshift-mtv` isolated from tenant namespaces | ✅ | No entity labels; operator only runs in its own namespace |
| VMware provider connection outbound only (central → vCenter) | ✅ | MTV controller initiates connection; no inbound from vCenter required |
| OLM Subscriptions restricted to `redhat-operators` source | ✅ | Both CNV and MTV subscriptions use `source: redhat-operators` |
| ForkliftController and virt-api/virt-controller use OLM-managed RBAC | ✅ | No custom ClusterRoles added; OLM manages RBAC for both operators |

## HA and Availability

| Check | Status | Notes |
|---|---|---|
| PodDisruptionBudget `virt-api-pdb` with `minAvailable: 1` | ✅ | Defined in `openshift-cnv/templates/pdb.yaml` |
| PodDisruptionBudget `virt-controller-pdb` with `minAvailable: 1` | ✅ | Defined in `openshift-cnv/templates/pdb.yaml` |
| PodDisruptionBudget `mtv-controller-pdb` with `minAvailable: 1` | ✅ | Defined in `openshift-mtv/templates/pdb.yaml` |
| MTV ForkliftController: `controller_replicas: 2`, `ui_replicas: 2` | ✅ | Set in `openshift-mtv/values.yaml` and central values |

## GitOps / Deployment Discipline

| Check | Status | Notes |
|---|---|---|
| All resources deployed via ArgoCD Applications (`cnv`, `mtv`) | ✅ | Both Applications defined in `bootstrap/helm/central/templates/centralCluster/` |
| `selfHeal: true` and `prune: true` on both Applications | ✅ | Both Application templates include these sync policies |
| `SkipDryRunOnMissingResource` on CRD-dependent resources | ✅ | `HyperConverged`, `ForkliftController`, `Provider` templates have this annotation |
| No Helm tarballs committed | ✅ | `make upload-cnv-chart` and `make upload-mtv-chart` push to OCI; only chart source YAML in Git |
| No `oc apply` or `oc create` used for any resource in this feature | ✅ | All resources flow through ArgoCD |

## Deviations

| Deviation | WHY | WHERE | REMEDIATION |
|---|---|---|---|
| HELPEROSO/HELPERAWS SAs disabled | User confirmed helper_CloudOSO and helper_CloudAWS operators are obsolete; no active tenants depend on them | `vaultCentralNamespace.centralServiceAccounts` in `values.yaml` | If helper operators are reintroduced, create dedicated Helm charts and re-enable |
| MTV `cacert` field left empty by default (insecure vCenter TLS in lab) | Lab environments typically use self-signed certificates; providing empty string means insecure connection | `openshift-mtv/values.yaml`, `vmware-bootstrap-secret.yaml` | In production, set `VMWARE_CACERT_PEM` env var and pass via `--set vmware.cacert=$(VMWARE_CACERT_PEM)` |
| VMware bootstrap Secret persists after Vault write | Platform pattern: init chart bootstrap Secrets are not cleaned up (consistent with `gitea-admin-credentials`) | `vmware-bootstrap-credentials` in `sovereign-cloud-jobs` | Acceptable; Secret contains no long-lived credentials if vCenter password is rotated and Vault is re-seeded |

## CIS / NIST Compliance Notes

- **CIS OCP Benchmark 4.1**: VMware credentials stored in Vault (not ConfigMaps or unencrypted Secrets) — PASS
- **NIST SP 800-53 AC-3**: Access to `central/vmware-credentials` Vault path controlled by Kubernetes auth role `external-secrets` — requires verification that Vault policy restricts this path to the `openshift-mtv` service account only
- **NIST SP 800-53 SC-8**: Traffic between MTV controller and vCenter should use TLS; production deployments MUST set `vmware.cacert` to the vCenter CA certificate
- **NIST SP 800-53 SI-7**: All operator images sourced from `redhat-operators` catalog (Red Hat-signed) — PASS

## Vault Policy Gap (P1 Defect — Track for Next Iteration)

**Finding**: The `vault-backend` ClusterSecretStore currently uses a Vault role that grants broad `central/*` read access to External Secrets Operator. The MTV ExternalSecret can read `central/vmware-credentials`, but so can any other ExternalSecret in any namespace that also references `vault-backend`. A dedicated Vault policy restricting `central/vmware-credentials` reads to the `openshift-mtv` service account is needed in production.

**Remediation**: Create a Vault policy `mtv-vmware-reader` scoped to `central/data/vmware-credentials` and bind it to a new Vault Kubernetes auth role for `openshift-mtv/external-secrets`. Update the MTV ExternalSecret to reference a dedicated ClusterSecretStore for this policy. This is a P1 hardening gap and must be resolved before production deployment.

---

**Hardening Status**: PASS with P1 gap documented (Vault policy scoping). Acceptable for lab/dev. Not production-ready until Vault policy gap is resolved.
