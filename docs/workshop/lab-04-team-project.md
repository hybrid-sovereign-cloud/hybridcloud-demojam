# Lab 4 — Team and Project: organising the work

**Time:** ~10 minutes · **Prerequisite:** [Lab 3](lab-03-identity.md)

Two small CRs with one job between them: give the `Assignment` in
[Lab 8](lab-08-assignment.md) something to place onto a cluster.

---

## How they differ

```text
Rbac      "these people exist as a group"            ← identity (Lab 3)
Team      "these people work together"               ← organisation
Project   "this is a body of work"                   ← workload
Assignment "this Team, with these Projects, gets     ← placement (Lab 8)
           namespaces and roles on that cluster"
```

A `Team` is *not* a group. A group (`Rbac`) is an identity-provider concept;
a `Team` is a platform concept that carries feature flags and becomes a unit
of placement. They are deliberately separate so one team can be granted
different roles on different clusters — the mapping happens in the
`Assignment`, not in the `Team`.

A `Project` is a name for a body of work. On its own it does nothing. Its
whole purpose is to become a namespace on a spoke cluster when an Assignment
places it there — so `website-redesign` in the tenant becomes a
`website-redesign` namespace on the cluster, consistently, every time.

---

## Create them

```yaml
# lab-team-project.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Team
metadata:
  name: mycorp-platform-engineering
  namespace: entity-mycorp
spec:
  features:
    # Opt-in extras provisioned into the team's spoke namespaces.
    # Leave both false for the workshop; enabling them lengthens Lab 8.
    istio: false
    argo: false
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Project
metadata:
  name: mycorp-storefront
  namespace: entity-mycorp
spec:
  description: Customer-facing storefront
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Project
metadata:
  name: mycorp-payments
  namespace: entity-mycorp
spec:
  description: Payments service
```

```bash
oc apply -f lab-team-project.yaml
oc get team,project -n entity-mycorp
```

**Pass:** one Team and two Projects, all reporting ready.

```text
NAME                                                   ENTITY   ISTIO   ARGO
team.../mycorp-platform-engineering                    mycorp   false   false

NAME                           ENTITY   STATUS
project.../mycorp-storefront   mycorp   ready
project.../mycorp-payments     mycorp   ready
```

---

## Deprecated fields — do not use

`Team.spec.teamAdmin` and `Team.spec.rbacConfig` still parse but are ignored.
Access is granted at placement time through `Assignment.spec.toolRbac`, so
that the same team can be admin on one cluster and viewer on another. If you
copy an old sample, strip those two fields.

---

## Where this is going

Nothing has been created outside the hub yet. Hold that thought — these two
objects stay inert until Lab 8:

```text
Team mycorp-platform-engineering  ─┐
Project mycorp-storefront         ─┼─► Assignment ─► namespaces + RoleBindings
Project mycorp-payments           ─┤              on a PlatformOpenshift spoke
Rbac groups from Lab 3            ─┘
```

That is the whole point of splitting them: you define the organisation once,
then place it onto as many clusters as you like.

---

→ [Lab 5 — Tenant plugins: Vault, AAP, Quay](lab-05-plugins.md)
