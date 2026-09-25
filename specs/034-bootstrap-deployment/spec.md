# Spec 034: Bootstrap Deployment

**Spec ID**: `034-bootstrap-deployment`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Helm init chart
**Namespace**: `openshift-gitops`

## Description

Phased ArgoCD bootstrap deploying all platform components across hub clusters with sync-wave ordering and verification gates.

## CRD Schema Summary

bootstrap/helm/init seeds ArgoCD app-of-apps; central/values.yaml drives all Application CRs with sync-wave annotations.

## Deployment Steps

1. make check-env && cd bootstrap && make upload-all-charts
2. make init-central-argo (bootstrap entry point)
3. Monitor ArgoCD sync through Mega-Phases A→J

## Testing Guide

- oc get applications -n openshift-gitops — all Synced/Healthy
- Run global_tests suite after each mega-phase gate

## Security Considerations

- Bootstrap seeds secrets from env vars only (one-time)
- All post-bootstrap secrets via Vault + ESO
- Never oc apply after init-central-argo

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
