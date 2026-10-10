# Spec 026: AAP Config as Code

**Spec ID**: `026-aap-config-as-code`
**API Group**: `N/A`
**Kind**: N/A
**Operator**: Ansible playbook
**Namespace**: `sovereign-cloud-jobs`

## Description

AAP controller and EDA configuration managed via infra.aap_configuration collection in aap-config/ directory.

## CRD Schema Summary

YAML inventories for credentials, projects, job templates, DEs, rulebook activations.

## Deployment Steps

1. Run aap-config/playbook.yml via sovereign Job after AAP license Jobs

## Testing Guide

- Verify job templates, projects, and EDA activations match config

## Security Considerations

- AAP credentials from Vault; no tokens in aap-config/

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
