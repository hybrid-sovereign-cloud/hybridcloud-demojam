# Hybrid Sovereign Cloud — Architecture

**Day-2 usage:** [`../docs/README.md`](../docs/README.md)

## Runtime

```text
One OpenShift hub → ArgoCD (gitops/) → Operators → AAP JobTemplates → spokes
```

## Documents

| Doc | Path |
|-----|------|
| C4 | [docs/c4.md](docs/c4.md) |
| Concepts | [docs/concepts.md](docs/concepts.md) |
| Technical | [docs/technical.md](docs/technical.md) |
| Workshop & tutorials | [docs/workshop-tutorials.md](docs/workshop-tutorials.md) |
| Index | [docs/architecture.md](docs/architecture.md) |
| UI mocks | [mocks/](mocks/) |

## Non-negotiables

No secrets in Git · never delete `sovereign-*` namespaces · platform via GitOps only.
