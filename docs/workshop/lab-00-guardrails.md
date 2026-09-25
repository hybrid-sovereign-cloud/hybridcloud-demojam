# Lab 0 — Guardrails

## Non-negotiable

- Credentials only via Secret → Vault (PushSecret). **Never commit** `clouds.yaml` or AWS keys.
- Do not delete namespaces named `sovereign-*`.
- After hub bootstrap, change platform via **Git + ArgoCD**. Lab CRs (Cloud\*, Platform\*, Assignment) may use `oc apply`.

## Fresh hub only

If this cluster is not yet GitOps-bootstrapped:

1. Day-0 secrets: [architecture/docs/workshop-tutorials.md](../../architecture/docs/workshop-tutorials.md)
2. ZTP contract: [architecture/docs/workshop-tutorials.md](../../architecture/docs/workshop-tutorials.md)
3. Point OpenShift GitOps at repo path `gitops/` @ `main` — see [gitops/ZTP.md](../../gitops/ZTP.md)

## Check you are ready for Lab 1

```bash
oc whoami
oc get applications -n openshift-gitops | head
oc get crd cloudawss.hybridsovereign.redhat cloudosos.hybridsovereign.redhat cloudvirts.hybridsovereign.redhat
```

All three CRDs must exist. Then continue → [Lab 1](lab-01-verify-platform.md).
