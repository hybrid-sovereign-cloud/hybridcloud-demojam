# Workshop — Day 0 secrets (only manual step)

This is the **only** human step before ArgoCD owns the cluster. Everything after goes through Git → `gitops/`.

## Rules

1. Source **uncommented** exports from `~/.bashrc` only (ignore `#` commented lines).
2. Never commit secret values to Git. Never script bashrc → Git.
3. Upload into namespace `sovereign-secrets` only.
4. Between 50+ clusters, **only** OCP/AWS/OSO login credentials differ.

## Required variables

| Purpose | Preferred | Accepted aliases |
|---------|-----------|------------------|
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID` | `AWS_ACCESSKEY`, `AWS_SECRET_KEY`, `AWS_ACCOUNT` |
| OpenStack | `OSO_CLOUDS` (path to `clouds.yaml`) | — |
| Cluster seed | `OCP_SERVICES_SERVER`, `OCP_SERVICES_USERNAME`, `OCP_SERVICES_PASSWORD` | — |

## Create Secrets

```bash
oc -n sovereign-secrets create secret generic aws-credentials \
  --from-literal=AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  --from-literal=ACCOUNT_ID="$AWS_ACCOUNT_ID"

oc -n sovereign-secrets create secret generic oso-clouds \
  --from-file=clouds.yaml="$OSO_CLOUDS"

API_HOST=$(printf '%s' "$OCP_SERVICES_SERVER" | sed -E 's|https?://||')
oc -n sovereign-secrets create secret generic openshift-kubeadmin-seed \
  --from-literal=api_host="$API_HOST" \
  --from-literal=username="$OCP_SERVICES_USERNAME" \
  --from-literal=password="$OCP_SERVICES_PASSWORD"
```

Do **not** label these `hybridsovereign.redhat/gitops-owned=true`.  
`scripts/ztp-wipe.sh` **preserves** these three names across full wipe.

## What happens next

1. Root Argo Application syncs `gitops/` @ `main`.
2. `hs-security` PushSecrets copy seeds into Vault KV (`aws/accounts/*`, `oso/accounts/*`, …).
3. Sample CRs reference `vaultPath` only — no credentials and no cluster URLs in Git.

Full contract: [gitops/ZTP.md](../../../gitops/ZTP.md).
