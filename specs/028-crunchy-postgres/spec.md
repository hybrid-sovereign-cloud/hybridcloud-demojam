# Spec 028: Crunchy Postgres

**Spec ID**: `028-crunchy-postgres`
**API Group**: `postgres-operator.crunchydata.com/v1beta1`
**Kind**: PostgresCluster
**Operator**: PGO
**Namespace**: `openshift-operators`

## Description

Crunchy Postgres Operator providing HA Postgres for Keycloak, Quay, Gitea, and AAP.

## CRD Schema Summary

PostgresCluster CR: instances, backups, pgBouncer, monitoring.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `PostgresCluster.spec.instances` | []Instance | HA replica configuration |

## Deployment Steps

1. Phase A2: Deploy PGO (sync-wave 11) on the hub

## Testing Guide

- Verify PostgresCluster Ready; connectivity from dependent services

## Security Considerations

- Postgres passwords via ExternalSecret; encrypted storage

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
