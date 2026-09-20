# Point ArgoCD at gitops/

## Prerequisites (every cluster)

- OpenShift 4.x
- OpenShift GitOps (ArgoCD) installed
- Baseline services present (same as cluster-1): AAP Controller, RHBK, ODF/NooBaa, CNV, cert-manager

## One-time Application

Create (or use existing `field-content`) an Application:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: hybridsovereign-gitops
  namespace: openshift-gitops
spec:
  project: default
  source:
    repoURL: https://github.com/hybrid-sovereign-cloud/hybridcloud-demojam
    targetRevision: main
    path: gitops
  destination:
    server: https://kubernetes.default.svc
    namespace: openshift-gitops
  syncPolicy:
    automated:
      prune: false
      selfHeal: true
```

Do **not** put passwords in helm values. Secrets flow through `sovereign-secrets` and Vault PushSecrets.

## Verify

```bash
oc get applications -n openshift-gitops -l app.kubernetes.io/part-of=hybridsovereign-gitops
oc get ns -l hybridsovereign.redhat/gitops-owned=true
```

## Wipe gitops overlay only

Delete/prune Applications labeled `hybridsovereign.redhat/gitops-owned=true`. Never uninstall baseline AAP/RHBK/ODF/GitOps/CNV.
