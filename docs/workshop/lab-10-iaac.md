# Lab 10 — Iaac: config-as-code for everything you built

**Time:** ~10 minutes · **Prerequisite:** [Lab 2](lab-02-entity.md) (more
interesting after Labs 3–8)

Everything in the workshop so far was `oc apply`. This lab closes the loop:
the `Iaac` CR continuously exports the live state of every hybridsovereign CR
back into a Git repository, so the cluster's tenancy is reproducible from
source.

---

## What Iaac is — and what it is not

`Iaac` is the odd one out in this platform. Every other kind is reconciled by
an Ansible operator that drives an AAP job. Iaac is a **singleton Python
StatefulSet** that watches the API server directly:

```text
  iaac-git-sync StatefulSet  (sovereign-cloud-plugins)
        │
        │  every RECONCILE_INTERVAL (default 300s)
        ▼
  lists every hybridsovereign kind cluster-wide
        │
        ▼
  strips server-side noise
        (resourceVersion, uid, managedFields, status, …)
        │
        ▼
  writes one YAML file per CR into the Gitea repo,
  laid out by entity:
        entities/mycorp/Entity/mycorp.yaml
        entities/mycorp/Rbac/mycorp-developers.yaml
        entities/mycorp/Vault/mycorp-vault.yaml
        │
        ▼
  commits and pushes, then patches status back onto the Iaac CR
```

The CR's `spec` is intentionally empty — it is a **marker and a status
surface**, not a config surface. The sync engine is configured by the
StatefulSet's environment, because it is one cluster-wide singleton rather
than a per-CR reconciler. The CR exists so that ZTP, the UI and you have one
object to ask "is config-as-code healthy, and when did it last run?".

Files it writes are *redeployable*: status and server-populated metadata are
stripped, so you can `oc apply` the repo into a fresh hub.

---

## It is already running

ZTP provisions the whole chain for you — this is the `hs-iaac` application
at wave 52. It:

1. bootstraps a Gitea admin user headlessly and mints an API token,
2. creates the `tenancy_repo` repository,
3. stores the credentials in Secrets **and** Vault (`hybridsovereign/gitea-admin`),
4. builds the sync image in-cluster from `iaac/`,
5. runs the StatefulSet and applies the `Iaac` CR.

```bash
oc get application hs-iaac -n openshift-gitops
oc get iaac -A
oc get statefulset iaac-git-sync -n sovereign-cloud-plugins
```

---

## Read the status

```bash
oc get iaac iaac -n sovereign-cloud-plugins
```

```text
NAME   READY   LAST SYNC              CRS SYNCED   ERRORS   AGE
iaac   true    2026-10-10T13:40:11Z   48           0        12m
```

Those printer columns come straight from what the sync loop reported:

| Column | Status field | Meaning |
|--------|--------------|---------|
| READY | `status.ready` | last sync completed with no errors |
| LAST SYNC | `status.lastSyncTime` | when the loop last finished |
| CRS SYNCED | `status.totalCRsSynced` | how many CRs are in the repo |
| ERRORS | `status.syncErrors` | per-file failures in the last pass |

Per-kind detail, which is the useful view after a workshop:

```bash
oc get iaac iaac -n sovereign-cloud-plugins -o jsonpath='{.status.syncedKinds}' \
  | python3 -I -m json.tool
```

---

## Prove it captured your work

```bash
# Gitea URL and credentials (never in Git — read them from the cluster)
oc -n gitea get route gitea -o jsonpath='https://{.spec.host}{"\n"}'
oc -n sovereign-secrets get secret gitea-admin \
  -o jsonpath='{.data.username}' | base64 -d; echo
oc -n sovereign-secrets get secret gitea-admin \
  -o jsonpath='{.data.password}' | base64 -d; echo
```

Log in, open `gitea_admin/tenancy_repo`, and browse to
`entities/mycorp/`. Every CR you created in Labs 2–8 is there as committed
YAML, with a commit per sync pass.

Now force a round trip:

```bash
# Change something
oc patch project mycorp-storefront -n entity-mycorp --type=merge \
  -p '{"spec":{"description":"Storefront — rebranded"}}'

# Wait for the next pass (or watch the log)
oc logs -n sovereign-cloud-plugins statefulset/iaac-git-sync -f --tail=20
```

Within one interval the commit appears in Gitea with the new description.
Delete a CR and the file is removed as an orphan on the next pass.

**Pass:** `status.ready=true`, `totalCRsSynced` matches roughly what
`oc get <all hybridsovereign kinds> -A` returns, and your edit shows up as a
Gitea commit.

---

## Why this is the real "sovereign" argument

The platform's claim is that tenancy is *portable*: no state is trapped in a
vendor console. Iaac is the evidence. The repo it maintains is a complete,
redeployable description of who the tenants are, what they own and who may
touch it — readable without the platform running at all.

---

## Troubleshooting

```bash
oc logs -n sovereign-cloud-plugins statefulset/iaac-git-sync --tail=100
oc get iaac iaac -n sovereign-cloud-plugins -o jsonpath='{.status.message}{"\n"}'
```

| Symptom | Cause |
|---------|-------|
| `ready=false`, errors > 0 | Gitea token expired or repo deleted. Re-run the bootstrap: `oc -n openshift-gitops patch app hs-iaac --type=merge -p '{"operation":{"sync":{}}}'` |
| StatefulSet `ImagePullBackOff` | First build still running. `oc -n sovereign-cloud get builds -l buildconfig=iaac-git-sync` |
| No `Iaac` CR at all | `provision.iaac` is false in the ArgoCD root values |

---

→ [Lab 11 — The same thing through the console](lab-11-ui.md)
