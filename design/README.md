# Hybrid Fabric Design — Single Source

All Hybrid Fabric / Hybrid VPC networking design lives under **`design/`**.

| Document | Contents |
|----------|----------|
| [fabric.md](./fabric.md) | **Primary blueprint** — topology, threat model, Ansible L0–L5, CUDN/RHOSO, PlatformOpenshift fabric awareness (§15–§17), IPAM (§16), UI dropdowns console + standalone (§18) |
| [fabric-lifecycle.md](./fabric-lifecycle.md) | Admin create flow, entity tagging (`entityRefs`), tenant attachment catalog |
| [fabric-crds.md](./fabric-crds.md) | Redirect → fabric.md (CRD samples) |
| [fabric-realization.md](./fabric-realization.md) | Redirect → fabric.md (OCP/RHOSO realization) |
| [fabric-ui.md](./fabric-ui.md) | Redirect → fabric.md §12 / §18 |
| [fabic.md](./fabic.md) | Typo redirect → fabric.md |

Assets: [images/](./images/).

Do **not** add a parallel `designs/` tree — keep this directory as the only reference.
