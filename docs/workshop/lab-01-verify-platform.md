# Lab 1 — Verify platform

## Checks

```bash
# Operators
oc get deploy -n sovereign-cloud
oc get pods -n sovereign-cloud | head -40

# Sample entity (often acme-corp)
oc get entity -n sovereign-cloud
oc get ns | grep entity-

# AAP reachable (JobTemplates exist)
oc get automationcontroller -A 2>/dev/null || true

# Local CloudVirt (hub CNV) if smoke app synced
oc get cloudvirt -A
```

## Pass criteria

- At least one Entity (e.g. `acme-corp`) and namespace `entity-acme-corp`.
- Namespace operator Running in that entity NS.
- CRDs for CloudAWS / CloudOSO / CloudVirt / PlatformOpenshift present.

If Entity missing, create from UI or `samples/entity/acme-corp.yaml` (adjust to your lab), then continue.

→ [Lab 2](lab-02-register-cloud.md)
