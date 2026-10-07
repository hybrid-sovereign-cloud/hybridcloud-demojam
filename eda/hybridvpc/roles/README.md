# eda/hybridvpc/roles — symlinks only

The Hybrid VPC fabric roles live in **`eda/rulebooks/roles/`** (the tree AAP runs:
`eda/rulebooks/<kind>-{provision,teardown}-playbook.yml` resolve their adjacent
`roles/` directory first).

Until 2026-10-07 this directory held a byte-identical copy of those roles. It now
holds symlinks to the canonical tree so that anything still using
`roles_path = eda/hybridvpc/roles` (repo-root `ansible.cfg`, `eda/ansible.cfg`,
`eda/hybridvpc/rulebooks/*.yml`) keeps working without a second copy drifting.

Edit roles under `eda/rulebooks/roles/` only.
