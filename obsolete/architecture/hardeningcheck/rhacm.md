# Hardening Check — RHACM

**Retested**: 2026-07-15

| Check | Result | Notes |
|-------|--------|-------|
| Central only | PASS | MultiClusterHub on central |
| Channel | PASS | `release-2.16` in values |
| Services not hosting MCH | PASS | Managed cluster role |
| GitOpsCluster helper | REVIEW | `acmGitOpsCluster` may be disabled — confirm before relying on pull model |

Never install RHACM hub on the services cluster.
