# Hardening Check — Operators & events

**Retested**: 2026-09-25

| Check | Result | Notes |
|-------|--------|-------|
| Primary operator in `sovereign-cloud` | PASS | GitOps path |
| Kafka / AMQ publish | RETIRED | `amq_publish.yml` moved to `obsolete/`; `publish_operator_event.yml` no-op |
| Operators → AAP JobTemplates | PASS | Active path |
| IAAC git-sync (not Go plugin-iaac) | PASS | STS `iaac-git-sync` where enabled |

Historical Kafka rows (2026-07) are obsolete. See [`../../docs/flow.md`](../../docs/flow.md).
