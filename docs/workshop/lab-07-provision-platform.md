# Lab 7 — Provision PlatformOpenshift

Match the Cloud\* project from Lab 6. A PlatformOpenshift is a tenant cluster on that project; it does **not** join the hybrid fabric (no fabric or gateway step here, see [Lab 0](lab-00-guardrails.md#tenants-cannot-attach-their-own-clusters-to-the-fabric)). Tenant networks that must span sites are placed on cloud projects in [Lab 9](lab-09-hybrid-fabric.md).

## Shortcut: a hosted cluster already exists

ZTP provisions `PlatformOpenshift/ocp-hub-hosted` in `entity-acme-corp` — a
HyperShift control plane on the hub's own CloudVirt. It needs no external
cloud, so it is ready on any hub.

```bash
oc get platformopenshift ocp-hub-hosted -n entity-acme-corp
```

If you only want to reach [Lab 8](lab-08-assignment.md), use that cluster and
skip the tracks below. Build your own if you want to watch an install happen.

## Track A — AWS

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: workshop-ocp-aws
  namespace: entity-acme-corp
spec:
  type: aws
  aws:
    environment: workshop-aws
    region: us-east-1
    clusterType: standalone
    controlPlaneCount: 3
    workerCount: 2
```

## Track B — OpenStack

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: workshop-ocp-oso
  namespace: entity-acme-corp
spec:
  type: openstack
  openstack:
    environment: workshop-oso
    controlPlaneCount: 3
    workerCount: 3
    externalNetwork: internet
```

## Track C — Hosted on Virt

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: PlatformOpenshift
metadata:
  name: workshop-ocp-hosted
  namespace: entity-acme-corp
spec:
  type: hosted
  hosted:
    environment: local-virt          # or workshop-virt from Lab 6
    nodePoolReplicas: 2
```

Pod and service CIDRs: leave `spec.networking` out and they are allocated from the CloudInfrastructure's `hostedClusterCidrDefaults` (CG-NAT `100.64.0.0/10` on `hub-virt`) and checked against the hub and the other clusters; `status.networking` shows the result. `spec.fabric` and `spec.networking.allocateFromFabric` are deprecated and ignored.

## Monitor

```bash
oc apply -f platform.yaml
oc get platformopenshift -n entity-acme-corp -w
# also:
oc get clusterdeployment -A 2>/dev/null | head
oc get hostedcluster -A 2>/dev/null | head
oc get managedcluster | head
```

**Pass:** Platform shows ready / Provisioned; console or API URL in status when applicable.

Troubleshoot: `oc describe platformopenshift <name> -n entity-acme-corp` and AAP job output.

→ [Lab 8 — Assignment](lab-08-assignment.md)
