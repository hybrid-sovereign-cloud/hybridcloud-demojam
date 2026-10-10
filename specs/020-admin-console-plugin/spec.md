# Spec 020: Admin Console Plugin

**Spec ID**: `020-admin-console-plugin`
**API Group**: `console.openshift.io/v1`
**Kind**: ConsolePlugin
**Operator**: Helm chart
**Namespace**: `sovereign-cloud`

## Description

OpenShift console plugin embedding admin dashboard pages with PatternFly 5 dark/light mode.

## CRD Schema Summary

ConsolePlugin CR: proxy endpoints, service reference, display metadata.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `ConsolePlugin.spec.proxy` | []Proxy | Backend service proxy config |

## Deployment Steps

1. Deploy sovereign-admin-plugin chart; enable in console operator config

## Testing Guide

- Open console; verify Hybrid Sovereign nav section loads

## Security Considerations

- Console proxy uses user token; CSP headers configured

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
