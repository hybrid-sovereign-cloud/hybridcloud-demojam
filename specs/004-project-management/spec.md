# Spec 004: Project Management

**Spec ID**: `004-project-management`
**API Group**: `hybridsovereign.redhat/v1alpha1`
**Kind**: Project
**Operator**: namespace
**Namespace**: `entity-<name>`

## Description

Project CRs define logical application groupings within an entity with optional team associations.

## CRD Schema Summary

`spec.description`, `spec.teams` list linking projects to Team CRs.

## API Reference

| Field | Type | Description |
|-------|------|-------------|
| `metadata.name` | string | Project name |
| `spec.description` | string | Project description |
| `spec.teams` | []string | Associated Team CR names |

## Deployment Steps

1. Apply Project CR after Teams exist in entity namespace

## Testing Guide

- Apply `samples/project/website.yaml` and verify status.ready

## Security Considerations

- ProjectAdmin/ProjectView enforced via Entity namespaceRbac

## Related Samples

See [`samples/`](../../samples/) for sanitized CR examples.
See [`tests/`](../../tests/) for holistic test specs.
