# Hardening Check — ODF / Noobaa

**Retested**: 2026-07-15

| Check | Result | Notes |
|-------|--------|-------|
| Chart present both clusters | PASS | `bootstrap/helm/charts/odf` + values |
| Object storage for Quay | PASS | Platform design |
| Certified operator channel | PASS | Per chart |

Capacity / encryption at rest: REVIEW per site.
