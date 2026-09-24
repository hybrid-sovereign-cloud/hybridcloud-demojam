# Spec 008: CloudAWS

**Spec ID**: `008-cloud-aws`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: CloudAWS
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

CloudAWS provisions an AWS account environment for the entity. Creates AWSHelper type:environmentprep Job on central cluster.

Credentials are supplied either via UI (stored as a namespaced `Secret`, referenced by `spec.credentialsSecretRef`) or via Vault (`spec.vaultPath`). Credentials are never inlined on the CR.

## CRD Schema Summary

`spec.account`, `spec.baseDomain`, `spec.credentialsSecretRef` or `spec.vaultPath`, `spec.landingzone`, `spec.toolRbac` for IAM role mappings.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `spec.account` | string | 12-digit AWS account ID |
| `spec.baseDomain` | string | Parent DNS domain |
| `spec.credentialsSecretRef.name` | string | Secret in the entity namespace with keys `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (optional `ACCOUNT_ID`) |
| `spec.vaultPath` | string | Vault path for AWS credentials (fallback when credentialsSecretRef is unset) |
| `spec.toolRbac.accountAdminRbac` | []string | AdministratorAccess Rbac refs |

## UI / Console

Create CloudAWS forms accept AWS access key ID + secret access key. On submit the UI creates `{name}-aws-credentials` Secret in the entity namespace, then sets `spec.credentialsSecretRef.name` on the CR.

## Deployment Steps

1. Apply CloudAWS CR (with credentialsSecretRef or vaultPath); verify AWSHelper Job on central

## Testing Guide

- Apply `samples/cloudaws/cloudaws-dev.yaml` with sanitized account ID
- From UI: create CloudAWS with keys; confirm Secret exists and CR references it

## Security Considerations

- Never commit AWS credentials; UI path stores them only as `kind: Secret` in the entity namespace
- Vault + ExternalSecret remains the fallback path

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
