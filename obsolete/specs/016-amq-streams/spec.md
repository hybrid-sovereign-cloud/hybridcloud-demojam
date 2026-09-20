# Spec 016: AMQ Streams

**Spec ID**: `016-amq-streams`
**API Group**: `kafka.strimzi.io/v1beta2`
**Kind**: Kafka (Strimzi)
**Operator**: OLM Subscription
**Namespace**: `amq-streams`

## Description

AMQ Streams provides the Kafka event bus replacing direct EDA event streams. Topics: hybridsovereign-events, hybridsovereign-audit.

## CRD Schema Summary

Kafka cluster CR: 3 brokers, 3 ZooKeeper; KafkaTopic CRs for event routing.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `Kafka.spec.kafka.replicas` | integer | Broker count |
| `KafkaTopic.spec.partitions` | integer | Topic partitions |

## Deployment Steps

1. Install AMQ Streams operator via OLM; create Kafka cluster and topics

## Testing Guide

- Verify Kafka cluster Ready; produce/consume test message

## Security Considerations

- TLS encryption; mutual auth for producers/consumers

## Related Samples

See [`samples/`](../samples/) for sanitized CR examples.
See [`tests/`](../tests/) for holistic test specs.
