# CloudAWS

Registers an **AWS account** for an entity: creates Route53 child zone / slug via helper + AAP, stores creds in Vault.

## Flow

```text
Secret (AWS keys) in entity NS
        → CloudAWS (credentialsSecretRef or vaultPath)
        → AAP provision job
        → status.slug + status.domain + status.ready
        → PlatformOpenshift type=aws can use it
```

## Minimal example (Secret ref — preferred)

```yaml
# 1) Secret (do not commit)
apiVersion: v1
kind: Secret
metadata:
  name: aws-account-new
  namespace: entity-acme-corp
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: "AKIA..."
  AWS_SECRET_ACCESS_KEY: "..."
  ACCOUNT_ID: "123456789012"   # optional if spec.account set
---
# 2) CloudAWS
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudAWS
metadata:
  name: workshop-aws
  namespace: entity-acme-corp
spec:
  account: "123456789012"
  baseDomain: sandbox1022.opentlc.com   # parent Route53 zone you control
  credentialsSecretRef:
    name: aws-account-new
  # vaultPath: aws/accounts/workshop-aws   # optional if Secret used
```

## Important fields

| Field | Required | Meaning |
|-------|----------|---------|
| `spec.account` | yes | AWS account ID |
| `spec.baseDomain` | yes | Parent DNS domain |
| `spec.credentialsSecretRef.name` | preferred | Secret with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| `spec.vaultPath` | alt | Existing Vault KV for those keys |

## Status to wait for

- `status.ready: true`
- `status.domain` = `<slug>.<baseDomain>`
- `status.route53ZoneId` set

```bash
oc get cloudaws workshop-aws -n entity-acme-corp -o yaml
```

## Next

Create [PlatformOpenshift](platformopenshift.md) with `spec.type: aws` and `spec.aws.environment: workshop-aws`.

Full procedure: [how-to/add-cloudaws.md](../../how-to/add-cloudaws.md).
