# Lab 0 — Guardrails

## Non-negotiable

- Credentials only via Secret → Vault (PushSecret). **Never commit** `clouds.yaml`, kubeconfigs or AWS keys.
- Do not delete namespaces named `sovereign-*`.
- After hub bootstrap, change platform objects via **Git + ArgoCD**. Lab tenant CRs (Cloud\*, Platform\*, Assignment, HybridNetwork, NetworkPlacement) may use `oc apply`.
- Platform objects live in `sovereign-cloud` and are created by platform admins only: `CloudInfrastructure`, `HybridFabric`, `CloudGateway`. Tenants work in their `entity-<name>` namespace.

## Tenants cannot attach their own clusters to the fabric

The hybrid fabric is one shared EVPN underlay per hub. Tenants get VRFs on it (a `HybridNetwork` = VNI + route target allocated by the platform) and place them on **cloud projects**: CloudOSO (OpenStack), CloudVirt (VMs on the hub) or CloudAWS. A tenant's own OpenShift cluster (`PlatformOpenshift`, for example a hosted cluster) is **never** a fabric member.

Why: a tenant cluster-admin controls that cluster's network operator, OVN-Kubernetes and FRR. On the shared underlay they could create a ClusterUserDefinedNetwork with any VNI or route target, announce routes into another tenant's VRF, or send VXLAN with a foreign VNI. The platform-owned spokes (hub nodes, EDPM computes) are not reachable by tenant admins, so the route-target allow-list on the border gateway and the per-site RT policy hold. Clusters still get their own pod and service ranges and run normally; they just do not carry fabric VRFs. The conditions under which cluster attachment could come back (a PE/CE design with per-cluster underlay segments and BGW-enforced filtering) are recorded in [fabric-design.md](../concepts/fabric-design.md#15-platformopenshift-and-the-fabric).

## Fresh hub only

If this cluster is not yet GitOps-bootstrapped:

1. Day-0 secrets: [workshop-tutorials](../concepts/workshop-tutorials.md)
2. ZTP contract: [workshop-tutorials](../concepts/workshop-tutorials.md)
3. Point OpenShift GitOps at repo path `gitops/` @ `main` — see [docs/ztp.md](../getting-started/ztp.md)

## Check you are ready for Lab 1

```bash
oc whoami
oc get applications -n openshift-gitops | head
oc get crd cloudinfrastructures.hybridsovereign.redhat \
  cloudawss.hybridsovereign.redhat cloudosos.hybridsovereign.redhat cloudvirts.hybridsovereign.redhat
```

All four CRDs must exist. Then continue → [Lab 1](lab-01-verify-platform.md).
