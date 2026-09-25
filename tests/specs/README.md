# Agent-Executable Test Specs

YAML specs under this directory define repeatable verification steps for Hybrid Sovereign rollout phases. Agents and CI runners execute them with `oc`, `curl`, Vault checks, and optional Playwright UI steps.

## Layout

| Directory | Scope |
|-----------|--------|
| `phase1-amq-events/` | Kafka bus, operator publish, central EDA |
| `phase2-virtualization/` | CNV, MTV, VMware provider |
| `phase3-ui-rbac/` | Dashboard RBAC visibility matrix |
| `phase4-platform-status/` | PlatformOpenshift Hive polling |
| `connectivity/` | Cross-cluster API, DNS, Kafka TLS |
| `security/` | No secrets in Git, Vault-only creds |
| `personas/` | Keycloak persona UI/API visibility |


## Spec format

Each spec references `_schema.yaml`. Required fields:

- `id`, `title`, `objective`, `severity`
- `prerequisites` — cluster contexts, Vault paths, healthy Argo apps
- `steps` — ordered commands with `command`, `expect`, `on_failure`
- `expected` — success criteria summary

## Execution

```bash
# Example: run Phase 1 smoke spec
cd hybridcloud/tests/specs
yq '.steps[].command' phase1-amq-events/smoke-team-cr.yaml | while read -r cmd; do eval "$cmd"; done
```

Prefer reusing roles from `tests/global_tests/` for complex Ansible assertions.

## Cluster contexts

| Alias | Context |
|-------|---------|
| `hub-admin` | Central management cluster |
| `hub-admin` | Services / tenant CR cluster |
