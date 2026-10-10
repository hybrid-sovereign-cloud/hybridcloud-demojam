# Iaac

Continuously exports every `hybridsovereign.redhat` custom resource to a Gitea
repository as redeployable YAML, so the hub's tenancy is reproducible from
source.

Namespace: `sovereign-cloud-plugins`. One per hub.

## How it differs from every other kind

Iaac is **not** reconciled by an Ansible operator. It is a singleton Python
StatefulSet (`iaac-git-sync`) that watches the API server directly and writes
status back onto the CR. Consequences:

- `spec` is empty and reserved. The sync engine is configured by the
  StatefulSet's environment, not by the CR, because it is one cluster-wide
  process rather than a per-object reconciler.
- The CR is a **marker and a status surface**: it gives ZTP, the UI and you
  one object to ask whether config-as-code is healthy.
- More than one Iaac CR is allowed but pointless — all of them receive the
  same cluster-wide result.

## Minimal example

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Iaac
metadata:
  name: iaac
  namespace: sovereign-cloud-plugins
spec: {}
```

Applied for you by the `hs-iaac` GitOps application (wave 52).

## Status

| Field | Printer column | Meaning |
|-------|----------------|---------|
| `status.ready` | READY | last sync pass completed with no per-file errors |
| `status.lastSyncTime` | LAST SYNC | when that pass finished |
| `status.totalCRsSynced` | CRS SYNCED | number of CRs currently in the repo |
| `status.syncErrors` | ERRORS | per-file failures in the last pass |
| `status.syncedKinds` | — | array of `{kind, count}` |
| `status.repository` | — | the Gitea repo being written |
| `status.message` | — | human summary, or the first error |

```bash
oc get iaac -A
oc get iaac iaac -n sovereign-cloud-plugins \
  -o jsonpath='{.status.syncedKinds}' | python3 -I -m json.tool
```

## What ends up in the repo

One file per CR, laid out by entity:

```text
entities/<entity>/<Kind>/<name>.yaml
```

Server-side noise (`resourceVersion`, `uid`, `managedFields`, `creationTimestamp`,
`status`) is stripped, so the files can be `oc apply`-ed into a fresh hub.
CRs removed from the cluster are deleted from the repo as orphans on the next
pass.

## What drives it

| Setting | Env var on the StatefulSet | Default |
|---------|---------------------------|---------|
| Gitea endpoint | `GITEA_URL` | `http://gitea-http.gitea.svc:3000` (in-cluster Service, so sync does not depend on ingress) |
| Repo | `GITEA_REPO_OWNER` / `GITEA_REPO_NAME` | `gitea_admin` / `tenancy_repo` |
| Token | `GITEA_TOKEN` from Secret `gitea-admin-token` | created by the ZTP bootstrap job |
| Interval | `RECONCILE_INTERVAL` | `300` seconds |

Override through the `iaac` block in the GitOps root values
(`gitops/values.yaml`), never by editing the StatefulSet — self-heal reverts it.

## Credentials

The Gitea admin user, password and API token are created headlessly by the
`hs-iaac-gitea-bootstrap` PreSync job and stored in:

- Secret `gitea-admin-token` in `sovereign-cloud-plugins` (the token only)
- Secret `gitea-admin` in `sovereign-secrets` (username, password, token, url)
- Vault at `hybridsovereign/gitea-admin`

The job is idempotent: a re-run reuses the existing password and token rather
than rotating them out from under the running StatefulSet.

## Troubleshooting

```bash
oc logs -n sovereign-cloud-plugins statefulset/iaac-git-sync --tail=100
oc get iaac iaac -n sovereign-cloud-plugins -o jsonpath='{.status.message}{"\n"}'
```

| Symptom | Cause |
|---------|-------|
| `ready=false`, errors > 0 | token expired or repo deleted — re-sync `hs-iaac` to re-run the bootstrap |
| `ImagePullBackOff` | the first in-cluster build has not finished: `oc -n sovereign-cloud get builds -l buildconfig=iaac-git-sync` |
| no CR at all | `provision.iaac` is false in the GitOps root values |

## Related

- Workshop: [Lab 10](../../workshop/lab-10-iaac.md)
- Source: [`iaac/`](../../../iaac/)
- Spec: [014-iaac-git-sync](../../../specs/014-iaac-git-sync/spec.md)
