# Workshop — Hybrid Sovereign Cloud

Hands-on lab: from zero cloud registration to a usable spoke and Assignment.

**Time:** ~2–4 hours (cluster install dominates).  
**Cluster:** one OpenShift hub with hybridcloud GitOps already synced (`gitops/`).

## Agenda

| Lab | Goal | Doc |
|-----|------|-----|
| 0 | Guardrails + Day-0 secrets (if fresh hub) | [lab-00](lab-00-guardrails.md) |
| 1 | Confirm platform healthy | [lab-01](lab-01-verify-platform.md) |
| 2 | Add CloudOSO **or** CloudAWS **or** CloudVirt | [lab-02](lab-02-register-cloud.md) |
| 3 | Provision PlatformOpenshift | [lab-03](lab-03-provision-platform.md) |
| 4 | Entity Team + Assignment cycle | [lab-04](lab-04-assignment.md) |
| 5 | (Optional) UI path | [lab-05](lab-05-ui.md) |

## Mental model (keep this visible)

```text
Secret → Cloud* → ready → PlatformOpenshift → Provisioned → Assignment → spoke access
```

Operators launch **AAP jobs** directly. No Kafka / EDA path.

## Rules

1. No secrets in Git.  
2. Never delete `sovereign-*` namespaces.  
3. Prefer Git for platform; `oc apply` OK for **lab tenant CRs** (Cloud\*, Platform\*, Assignment).  
4. Clean up Platforms before Cloud\* deletes.

## After the workshop

- How-tos: [add CloudAWS](../how-to/add-cloudaws.md) · [CloudOSO](../how-to/add-cloudoso.md) · [CloudVirt](../how-to/add-cloudvirt.md)  
- CRDs: [usage/crds](../usage/crds/README.md)  
- Flow: [flow.md](../flow.md)
