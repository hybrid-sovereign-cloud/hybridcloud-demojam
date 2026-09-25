# CIS OpenShift Container Platform Benchmark — Checklist

**Platform**: OpenShift 4.x (central + services clusters)  
**Reference**: [CIS Red Hat OpenShift Container Platform Benchmark](https://www.cisecurity.org/benchmark/red_hat)  
**Scope**: Hybrid Sovereign bootstrap and tenant operator layers

Mark each control **Implemented**, **Partial**, **Planned**, or **Out of Scope** with remediation owner.

---

## 1. Cluster Configuration

| CIS Ref | Control | Hybrid Sovereign Implementation | Status |
|---------|---------|--------------------------------|--------|
| 1.1.1 | API server anonymous auth disabled | OCP default; verify `oc get cm -n openshift-kube-apiserver` | ☐ |
| 1.1.9 | API server audit logging enabled | OCP audit operator; event-forwarder consumes audit stream | ☐ |
| 1.2.1 | Kubelet anonymous auth disabled | OCP managed | ☐ |
| 1.2.6 | Kubelet cert rotation enabled | OCP managed | ☐ |
| 1.3.2 | Controller manager service account credentials | OCP managed | ☐ |
| 1.4.1 | etcd encryption at rest | Verify `EncryptionConfiguration` on cluster | ☐ |

## 2. RBAC and Service Accounts

| CIS Ref | Control | Hybrid Sovereign Implementation | Status |
|---------|---------|--------------------------------|--------|
| 2.1.1 | Cluster-admin role restricted | Limit bindings; use Keycloak OIDC groups | ☐ |
| 2.2.1 | Default service account not used for workloads | All charts specify `serviceAccountName` | ☐ |
| 2.3.1 | Automount SA token disabled where not needed | Operator + job templates | ☐ |
| 2.4.1 | Wildcard RBAC avoided | Entity 14-role matrix; per-CR viewer roles | ☐ |

## 3. Pod Security

| CIS Ref | Control | Hybrid Sovereign Implementation | Status |
|---------|---------|--------------------------------|--------|
| 3.1.1 | Privileged containers prohibited | Operator securityContext audit | ☐ |
| 3.2.1 | Host network namespaces prohibited | Helm template grep | ☐ |
| 3.2.2 | Host PID namespaces prohibited | Helm template grep | ☐ |
| 3.2.3 | Host IPC namespaces prohibited | Helm template grep | ☐ |
| 3.3.1 | Default namespace not used for workloads | sovereign-cloud, entity-*, openshift-* only | ☐ |
| 3.4.1 | Seccomp profile RuntimeDefault | Namespace operator deployment | ☐ |
| 3.5.1 | CPU limits defined | All platform Deployments | ☐ |
| 3.5.2 | Memory limits defined | All platform Deployments | ☐ |

## 4. Secrets Management

| CIS Ref | Control | Hybrid Sovereign Implementation | Status |
|---------|---------|--------------------------------|--------|
| 4.1.1 | Secrets not stored in Git | Constitution gate I; SECURITY_REVIEW §1 | ☐ |
| 4.1.2 | Secrets encrypted at rest (etcd) | OCP etcd encryption | ☐ |
| 4.2.1 | External secret store for credentials | Vault + ESO ClusterSecretStore | ☐ |
| 4.2.2 | Secret rotation supported | ESO `refreshInterval`; Vault rotation policy | ☐ |

## 5. Network

| CIS Ref | Control | Hybrid Sovereign Implementation | Status |
|---------|---------|--------------------------------|--------|
| 5.1.1 | Network policies in place | Default deny + allow per namespace (target) | ☐ |
| 5.2.1 | Ingress TLS termination | Routes use edge/re-encrypt TLS | ☐ |
| 5.3.1 | Egress restricted for sensitive workloads | Vault, Kafka, Quay egress policies | ☐ |

## 6. Platform-Specific (Hybrid Sovereign)

| Control | Description | Status |
|---------|-------------|--------|
| HS-6.1 | GitOps-only post-bootstrap (no `oc apply`) | ArgoCD app-of-apps | ☐ |
| HS-6.2 | sovereign-* namespace deletion prohibited | Operator teardown roles | ☐ |
| HS-6.3 | HA ≥2 replicas + PDB for platform Deployments | CNV, MTV, operators, dashboards | ☐ |
| HS-6.4 | ACS Central deployed and scanning both clusters | ACS Helm chart + acs-config Job | ☐ |
| HS-6.5 | Kafka TLS for event bus | AMQ Streams + event-forwarder TLS path | ☐ |
| HS-6.6 | Vault OIDC via RHBK (no static admin tokens in UI) | vault-oidc-auth Job | ☐ |

---

## Verification Commands

```bash
# Pod security contexts (sample)
oc get deploy -n sovereign-cloud -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.securityContext.runAsNonRoot}{"\n"}{end}'

# ExternalSecrets inventory
oc get externalsecret -A --no-headers | wc -l

# ClusterRoleBindings to cluster-admin
oc get clusterrolebinding -o json | jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name'
```

## Remediation Priority

1. **P0**: Secrets in Git, missing TLS on Kafka, wildcard RBAC
2. **P1**: NetworkPolicies, resource limits, PDB coverage
3. **P2**: Audit log retention tuning, etcd encryption verification
