# Hardening Check — Sovereign Namespaces

**Retested**: 2026-07-15

| Cluster | Required namespaces | Result |
|---------|---------------------|--------|
| Central | `sovereign-cloud-jobs`, `sovereign-cloud-helpers` | PASS (via sovereignNamespaces chart) |
| Services | `sovereign-cloud`, `sovereign-cloud-plugins`, jobs, helpers | PASS |
| Entity | `entity-*` created by primary operator | PASS pattern |

**Never delete** `sovereign-*` namespaces. Component namespaces (`aap`, `gitea`, `central-vault`, …) are owned by their charts — do not also declare them in the namespaces chart (ownership conflicts).
