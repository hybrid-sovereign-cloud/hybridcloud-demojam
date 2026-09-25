# Services AAP Scope — AAPOrg Only

**Last updated:** 2026-07-14

---

## Summary

The **services cluster** runs AAP Controller for **tenant-facing AAPOrg workflows only**. All operator provisioning automation (Entity, Team, Project, PlatformOpenshift, plugins, etc.) runs on **central** AAP + EDA.

---

## Configuration (GitOps)

| Cluster | Helm key | `eda.enabled` | Purpose |
|---------|----------|---------------|---------|
| Services | `aap.values.eda` | `false` | Controller only; no EDA activations |
| Central | `aapCentral.values.eda` | `true` | EDA + Controller for all operator jobs |

Source: `bootstrap/helm/central/values.yaml`

---

## What runs where

| Workflow | AAP instance | Trigger |
|----------|--------------|---------|
| Entity/Team/Project/… provision | Central | Kafka → EDA → job template |
| AAPOrg tenancy (org + RBAC in services AAP) | Services | Kafka → central EDA → `plugin-aap` playbook calls **services** AAP API |
| AAP config-as-code | Central | `aapConfigAsCode` sovereignJob |

---

## Decommissioned on services

| Component | Status |
|-----------|--------|
| Event forwarder | `eventForwarder.enabled: false` |
| Legacy `edaConfig` job | `enabled: false` |
| EDA HTTP event stream | Retired; rulebooks use `ansible.eda.kafka` |
| Services-scoped EDA activations | None — central only |

---

## Verification

```bash
# Services: no EDA controller pods
oc get aap -n aap --context=services-admin -o yaml | grep -A2 'eda:'

# Central: EDA enabled
oc get aap -n aap --context=central-admin -o yaml | grep -A2 'eda:'

# No forwarder on services
oc get deploy -n sovereign-cloud-plugins --context=services-admin | grep event-forwarder || echo OK
```
