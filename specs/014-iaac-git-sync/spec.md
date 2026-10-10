# Spec 014: IAAC Git Sync

**Spec ID**: `014-iaac-git-sync`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Iaac
**Operator**: StatefulSet (Python)
**Namespace**: `sovereign-cloud`

> **Status (2026-07-15): UPDATE NEEDED**
>
> Live deployment is the Python StatefulSet `iaacGitSync` (`iaac/` + chart pin in central values).
> The Go `pluginIaac` operator chart remains in repo but `enabled: false`.

## Description

IAAC replaces the Go operator with a Python StatefulSet that watches all hybridsovereign CRDs and syncs them to a Gitea Git repository for config-as-code.

## CRD Schema Summary

Iaac CR configures git remote, branch, sync interval, and CRD filter.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `spec.repoUrl` | string | Gitea repository URL |
| `spec.branch` | string | Target branch |
| `spec.syncInterval` | string | Reconciliation interval |

## Deployment Steps

1. Deploy IAAC StatefulSet (sync-wave 40); apply Iaac CR

## Testing Guide

- Apply `samples/iaac/iaac.yaml`; verify git commits for CR changes

## Security Considerations

- Gitea token from Vault; no credentials in Iaac CR spec

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
