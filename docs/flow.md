# Platform flow (simple)

## Layers

| Layer | What it is | Examples |
|-------|------------|----------|
| **Cloud** | Where compute lives | `CloudAWS`, `CloudOSO`, `CloudVirt` |
| **Platform** | A Kubernetes/OpenShift cluster on that cloud | `PlatformOpenshift`, `PlatformAKS`, `PlatformEKS` |
| **Entity** | A tenant (company / org) | `Entity` → `entity-<name>` namespace |
| **Team** | Group of users in an entity | `Team` |
| **Assignment** | Who can use which platform (and which NS) | `Assignment` |
| **Plugins** | Optional products on platforms | GitLab, Quay, ACS, Ansible, … |

## Happy path (provision)

```text
1. Secret with cloud creds  →  Vault (PushSecret)  →  never in Git
2. CloudAWS / CloudOSO / CloudVirt
3. PlatformOpenshift (refs cloud + releaseImage / domain)
4. AAP Job: DNS + Hive ClusterDeployment / HostedCluster
5. Spoke Ready → ACM import → policies / agents
6. Entity + Team + Assignment → spoke namespace + RBAC
```

## Happy path (deprovision)

```text
1. Delete Assignment(s) using the platform
2. Delete Platform* CR  →  AAP teardown job
3. (Optional) Delete Cloud* when no platforms remain
4. Rotate / remove Vault path for that account
```

## Who does what

| Actor | Role |
|-------|------|
| **ArgoCD** | Deploys operators, charts, UI from Git |
| **Primary operator** | Watches `sovereign-cloud` + plugin CRs |
| **Namespace operator** | One per `entity-*`; watches tenant CRs there |
| **AAP** | Runs Ansible (cluster build, DNS, teardown) |
| **Hive / MCE / ACM** | Spoke lifecycle and management |
| **Vault** | Credentials |

## Status fields to watch

| CR | Ready when… |
|----|-------------|
| Cloud\* | `status.conditions` Ready / Synced; Vault path populated |
| PlatformOpenshift | `status.phase` ≈ Provisioned; kubeconfig available |
| Entity | Namespace `entity-<name>` exists; operator Deployment up |
| Assignment | Spoke NS exists; RoleBindings present |

## Related

- CRD usage: [usage/crds/README.md](usage/crds/README.md)
- Workshop: [workshop/README.md](workshop/README.md)
