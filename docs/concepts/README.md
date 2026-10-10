# Concepts

How the platform is put together, and why it is shaped this way. Read
[flow.md](flow.md) first if you only have ten minutes.

## Start here

| Document | What it covers |
|----------|----------------|
| [flow.md](flow.md) | The end-to-end mental model in one page: Git → ArgoCD → operators → AAP → clouds |
| [concepts.md](concepts.md) | The vocabulary: entities, tenancy layers, the Config/Org split, how RBAC composes |
| [architecture.md](architecture.md) | Component overview and where each piece runs |
| [c4.md](c4.md) | C4 context / container / component diagrams |
| [technical.md](technical.md) | The long-form technical reference — every subsystem in detail |

## Hybrid networking

The EVPN fabric is the most intricate part of the platform and has its own
pair of documents:

| Document | What it covers |
|----------|----------------|
| [fabric-design.md](fabric-design.md) | The authoritative design: VRF model, VNI/route-target allocation, border gateway, site attachment, and the decisions that were tried and rejected |
| [fabric-verify.md](fabric-verify.md) | The live verification record from the reference hub — what was actually tested and what the results were |

The single most load-bearing decision: **a `PlatformOpenshift` cluster never
joins the fabric.** Tenant networks are placed on *cloud projects*
(`CloudOSO`, `CloudVirt`, `CloudAWS`), never on clusters, because a tenant
cluster-admin controls their own OVN-Kubernetes and FRR and could otherwise
forge VNIs and route targets on the shared underlay. The reasoning and the
conditions under which it could change are in
[fabric-design.md §15](fabric-design.md#15-platformopenshift-and-the-fabric).

## Tutorials

| Document | What it covers |
|----------|----------------|
| [workshop-tutorials.md](workshop-tutorials.md) | Long-form narrated walkthroughs, including Day-0 secret setup |

For the hands-on, CR-by-CR path, use the [workshop](../workshop/README.md)
instead — it is newer and ordered by dependency.

## Design artefacts

| Document | What it covers |
|----------|----------------|
| [design/ui-mockups](../design/ui-mockups/README.md) | Console and dashboard mockups, including the networking UI options |

## Related

- Per-kind field reference: [reference/crds](../reference/crds/README.md)
- Formal specs, one per feature: [specs/](../../specs/README.md)
- Change log and current platform state: [operations/tracking.md](../operations/tracking.md)
