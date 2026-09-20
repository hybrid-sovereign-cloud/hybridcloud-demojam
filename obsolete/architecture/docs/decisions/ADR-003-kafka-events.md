# ADR-003: Kafka Event Bus via AMQ Streams

**Status**: Phase 2 complete (EDA consumes Kafka; forwarder retired)  
**Date**: 2026-07-11  
**Updated**: 2026-07-14  
**Deciders**: Platform architecture team

---

## Context

The legacy event pipeline routed operator Kubernetes Events exclusively through the AAP EDA Event Stream HTTP endpoint on the central cluster:

```
Operator → K8s Event → Event Forwarder → HTTPS POST → EDA Event Stream → Rulebook
```

This design had limitations:

- **No durable buffer** — event stream downtime caused lost events
- **No replay** — debugging required reproducing CR changes
- **No audit trail** — events were ephemeral after EDA consumption
- **Single consumer** — only EDA could act on operator events
- **Tight coupling** — forwarder hardcoded to one central URL

---

## Decision

AMQ Streams (Strimzi Kafka) on the central cluster is the **primary and sole** automation event bus. Operators on the services cluster publish directly to Kafka; central EDA rulebooks consume via `ansible.eda.kafka`. The legacy HTTP event stream and event-forwarder are retired.

### Components

| Component | Cluster | Path |
|-----------|---------|------|
| AMQ Streams operator | Central | `bootstrap/helm/charts/amq-streams/` |
| Kafka cluster | Central (`amq-streams`) | `hybridsovereign-kafka`, external bootstrap Route |
| Topic `hybridsovereign-events` | Central | Operator and platform events |
| Topic `hybridsovereign-audit` | Central | Reserved for audit consumers |
| Operator Kafka producer | Services | `operator/roles/_common/tasks/amq_publish.yml` |
| EDA Kafka consumer | Central | `aap-config/eda/` + rulebooks in `eda.git` |
| Event Forwarder | **Retired** | `eventForwarder.enabled: false` |

### Event path

```
Operator (services) → Kafka (central, SASL_SSL) → EDA activation (central) → AAP job → CR status patch (services)
```

### Sync-wave ordering

- Wave 13: AMQ Streams Kafka cluster (central)
- Wave 14: `amqProducerInit` — Vault producer/consumer credentials
- Wave 30+: AAP central + `aapConfigAsCode` (Kafka credential, no HTTP stream)

### Security

- TLS on external bootstrap Route (port 443) and internal brokers
- Producer credentials: Vault `central/data/amq-producer` → services ExternalSecret
- Consumer credentials: Vault `central/data/amq-consumer` → aapConfigAsCode job env
- No tokens or passwords in Git or Helm values

---

## Consequences

### Positive

- Events survive EDA downtime; consumers can catch up
- Future consumers (metrics, SIEM, audit dashboard) can subscribe without modifying forwarder
- Replay enables integration testing without CR mutation
- Decouples event production from EDA availability

### Negative

- Additional infrastructure: 3 Kafka brokers + ZooKeeper on central cluster
- Dual-publish adds latency and operational complexity during migration
- Kafka credential rotation requires forwarder pod restart

### Migration path (complete)

1. ~~**Phase 1**: Dual-publish to Kafka + EDA Event Stream~~
2. **Phase 2** (current): EDA rulebooks consume from Kafka; HTTP event stream retired
3. **Phase 3**: Event forwarder disabled; operators publish directly only

---

## References

- [c4/components/event-system.md](../c4/components/event-system.md)
- Spec 016: AMQ Streams (`hybridcloud/specs/016-amq-streams/spec.md`)
- Spec 015: Event Forwarder (`hybridcloud/specs/015-event-forwarder/spec.md`)
