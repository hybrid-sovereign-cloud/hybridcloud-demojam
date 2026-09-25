# Hardening Check — Quay

**Retested**: 2026-07-15

| Check | Result | Notes |
|-------|--------|-------|
| Charts enabled both clusters | PASS | values pins present |
| OCI used for Helm charts | PASS | ArgoCD pulls from `quay.example.com` |
| Robot read-only for pulls | PASS | Documented platform rule |
| Admin token only for push | PASS | Make upload targets |

Thin check — deep Clair/storage review deferred to Quay day-2 ops.
