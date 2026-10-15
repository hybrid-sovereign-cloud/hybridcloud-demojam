# HybridSovereign test suite

End-to-end tests for the HybridSovereign platform, written as Ansible
playbooks and driven by [`run-tests.sh`](./run-tests.sh).

The suite exists to answer one question that CR status conditions cannot:
**did the change actually land in the tool?** When an `Rbac` CR says
`Ready=true`, these tests log in to Keycloak and look for the group. When an
`AAPOrg` says it is reconciled, they log in to Ansible Automation Platform and
look for the organization. Same for Quay, Vault, OpenStack and ACM. A green
`status.conditions` block with an empty Keycloak realm behind it is exactly
the failure mode this suite is built to catch.

Each suite owns its own `Entity` and its own non-overlapping address space, so
suites are independent: one failed teardown never strands another suite's
resources.

---

## The three-tag model

Every playbook supports the same three tags, plus `always` for the
authentication/preflight step that all of them need.

| Tag | Mutates? | What it does |
|---|---|---|
| `test` | **No — read-only** | Logs in to Keycloak, AAP, Quay, Vault, OpenStack and ACM and asserts the expected objects exist there. Reads CRs too, but never trusts CR status alone. Creates and deletes nothing. This is the default. |
| `create` | **Yes** | Creates the test custom resources in dependency order and waits for each to reach `Ready`. |
| `destroy` | **Yes** | Deletes the test custom resources in reverse dependency order and asserts the remote objects in the tools were reclaimed too. |
| `always` | No | Preflight: validates credentials are present and resolves tool endpoints from the hub cluster. Runs on every invocation. |

A normal full lifecycle run is `-t create,test,destroy`. A normal CI or
smoke-check run is just `-t test` against an environment that is already
provisioned.

`run-tests.sh` refuses to run `create` or `destroy` without a typed
confirmation when attached to a terminal (see
[Usage](#usage)).

---

## The suites

| Pokémon | File | Covers | Mutates | Rough runtime | Prerequisites |
|---|---|---|---|---|---|
| **mewtwo** | `test-mewtwo-platform-health.yaml` | Operator deployments, pod health, ArgoCD application sync state across the hub | No (read-only in every tag) | 1–2 min | Hub credentials only |
| **ditto** | `test-ditto-iaac.yaml` | The `IaaC` resource, **tested in place** — never created, never deleted | No | 1–2 min | An existing `IaaC` resource on the hub |
| **pikachu** | `test-pikachu-tenancy.yaml` | Full tenancy stack: `Entity`, `Rbac`, `Team`, `Project`, `Persona`, `AAPOrg`, `QuayOrg`, `Vault`, `VaultKV`; verified in Keycloak, AAP, Quay and Vault | Yes (`create`/`destroy`) | 10–20 min | Keycloak, AAP, Quay and Vault reachable from the control node |
| **bulbasaur** | `test-bulbasaur-hybridnetwork.yaml` | Hybrid fabric plus a hybrid network on the hub, over the CloudVirt backend | Yes | 10–20 min | `platform-fabric` and the hub `CloudInfrastructure` Ready |
| **squirtle** | `test-squirtle-ocp-plain.yaml` | An OCP cluster with **no** hybrid network — the control case. Cluster builds, gets RBAC, registers with ACM; asserts no fabric attachment exists | Yes | 45–90 min | ACM/MCE and cluster-build capacity on the hub |
| **charmander** | `test-charmander-ocp-hybrid.yaml` | An OCP cluster joined to a hybrid network | Yes | 45–90 min | bulbasaur-style fabric Ready; cluster-build capacity |
| **eevee** | `test-eevee-openstack-network.yaml` | An OpenStack tenant network only — no OCP (lab capacity limit) | Yes | 5–10 min | `OSO_CLOUDS` set; OpenStack site Ready |
| **snorlax** | `test-snorlax-openstack-vm.yaml` | A small OpenStack VM proving the hybrid network actually carries traffic | Yes | 10–15 min | `OSO_CLOUDS` set; image/flavor/external network present |

Runtimes are for a healthy lab and are dominated by cluster builds; the two
OCP suites are by far the slowest. `--tags test` on its own is much faster
than the figures above, which assume a full `create,test,destroy` cycle.

---

## Setup

```bash
cd tests
cp .env.example .env
${EDITOR:-vi} .env
./run-tests.sh -l          # list the suites
./run-tests.sh             # read-only sweep of all of them
```

### The key design point: you normally only supply OpenShift credentials

The admin credentials for Keycloak (RHBK), AAP, Quay and Vault are **already
stored as Secrets on the hub cluster**. The `platform_auth` role reads them
from there at preflight. That means the only thing you must put in `.env` is
the hub OpenShift server and login.

Section 3 of `.env.example` exists purely as an escape hatch — for pointing a
run at an external or non-default instance of one of those tools. If you set a
tool's URL you must also set its credential; a half-configured override is
rejected at preflight rather than silently falling back to the cluster.

### Environment variables

Mirrors `.env.example` exactly.

#### Section 1 — hub ("central") OpenShift cluster

| Variable | Required | Purpose |
|---|---|---|
| `OCP_CENTRAL_SERVER` | **Yes** | API URL of the hub cluster running the HybridSovereign operators, e.g. `https://api.your-hub.example.com:6443` |
| `OCP_CENTRAL_USERNAME` | **Yes** | Hub cluster username |
| `OCP_CENTRAL_PASSWORD` | **Yes** | Hub cluster password |
| `OCP_CENTRAL_VALIDATE_CERTS` | No (default `false`) | Verify the hub API's TLS certificate. Lab clusters use self-signed certs, hence the default |

#### Section 2 — OpenStack (RHOSO) site

Needed only by **eevee** and **snorlax**. Leave `OSO_CLOUDS` empty to skip
both suites.

| Variable | Required | Purpose |
|---|---|---|
| `OSO_CLOUDS` | No | Path to a `clouds.yaml`. `run-tests.sh` exports it as `OS_CLIENT_CONFIG_FILE` so the `openstack.cloud` collection finds it. **Point at a path outside this repo** — never copy `clouds.yaml` into the working tree |
| `OS_CLOUD` | No (default `openstack`) | Which cloud entry in `clouds.yaml` to use |
| `OSO_TEST_IMAGE` | No (default `cirros`) | Image for the throwaway snorlax VM. Must already exist; the suite uploads nothing |
| `OSO_TEST_FLAVOR` | No (default `m1.tiny`) | Flavor for the snorlax VM |
| `OSO_EXTERNAL_NETWORK` | No (default `ext-net`) | External network used for the router uplink |

#### Section 3 — optional tool endpoint / credential overrides

Leave **all** of these empty to resolve from the hub cluster (recommended).

| Variable | Required | Purpose |
|---|---|---|
| `RHBK_URL` | No | Keycloak/RHBK base URL override |
| `RHBK_USERNAME` | No | Keycloak admin user (required if `RHBK_URL` is set) |
| `RHBK_PASSWORD` | No | Keycloak admin password (required if `RHBK_URL` is set) |
| `RHBK_REALM` | No (default `sso`) | Realm the `Rbac` groups are expected in |
| `AAP_URL` | No | Ansible Automation Platform base URL override |
| `AAP_USERNAME` | No | AAP admin user (required if `AAP_URL` is set) |
| `AAP_PASSWORD` | No | AAP admin password (required if `AAP_URL` is set) |
| `QUAY_URL` | No | Quay base URL override |
| `QUAY_USERNAME` | No | Quay admin user (required if `QUAY_URL` is set) |
| `QUAY_PASSWORD` | No | Quay admin password |
| `QUAY_TOKEN` | No | Quay OAuth token with at least `org:admin` scope. Only needed if the Quay API rejects basic auth for organization reads |
| `VAULT_ADDR` | No | Vault address override |
| `VAULT_TOKEN` | No | Vault token (required if `VAULT_ADDR` is set) |

#### Section 4 — test-run behaviour (not credentials)

| Variable | Required | Purpose |
|---|---|---|
| `HS_READY_TIMEOUT` | No (default `900`) | Seconds to wait for a CR to reach `Ready` before failing |
| `HS_DESTROY_TIMEOUT` | No (default `600`) | Seconds to wait for a CR to disappear after deletion |
| `HS_KEEP_ON_FAILURE` | No (default `false`) | Leave resources behind when a test fails, for debugging. Also settable with `run-tests.sh -k` |
| `HS_ASSUME_YES` | No (default unset) | Set to `true` to skip `run-tests.sh`'s typed confirmation for `create`/`destroy`. **CI only** |

---

## Usage

### `run-tests.sh`

```bash
./run-tests.sh -h                  # help, including what each tag does
./run-tests.sh -l                  # list suites and their playbooks

# Read-only sweep of everything (the default; safe to run any time)
./run-tests.sh

# Read-only, a single suite
./run-tests.sh -s pikachu

# Several suites, still read-only
./run-tests.sh -s pikachu -s bulbasaur

# Full lifecycle of one suite — prompts for confirmation
./run-tests.sh -t create,test,destroy -s pikachu

# Provision only, and keep what is created
./run-tests.sh -t create -s bulbasaur

# Tear down two suites
./run-tests.sh -t destroy -s pikachu -s bulbasaur

# Keep resources behind on failure, so you can inspect them
./run-tests.sh -t create,test,destroy -s charmander -k

# Non-interactive (CI): skip the confirmation prompt
HS_ASSUME_YES=true ./run-tests.sh -t create,test,destroy
```

The script runs every selected suite even if an earlier one fails, then prints
a summary table and exits non-zero if anything failed.

### Raw `ansible-playbook`

`run-tests.sh` is only a convenience wrapper: it sources `.env`, validates it,
exports `OS_CLIENT_CONFIG_FILE`, and guards the destructive tags. If you
export the variables yourself you can call Ansible directly.

```bash
set -a; source .env; set +a
export OS_CLIENT_CONFIG_FILE="$OSO_CLOUDS"

# Read-only full sweep
ansible-playbook site.yaml --tags test

# One suite, one tag
ansible-playbook test-pikachu-tenancy.yaml --tags test
ansible-playbook test-pikachu-tenancy.yaml --tags create
ansible-playbook test-pikachu-tenancy.yaml --tags destroy

# Full lifecycle of one suite
ansible-playbook test-bulbasaur-hybridnetwork.yaml --tags create,test,destroy

# Extra verbosity when something is failing opaquely
ansible-playbook test-pikachu-tenancy.yaml --tags test -vv
```

Note that `site.yaml` has **no** confirmation guard. `ansible-playbook
site.yaml --tags destroy` will tear down every suite's resources immediately.

---

## Secrets

**`tests/.env` is gitignored and must never be committed.**

- Every credential the suite uses comes from the environment. No credential is
  hardcoded in any playbook, role, or in `group_vars/all.yml`.
- **No credential is ever written to `tests/reports/`.** Report artifacts
  contain suite names, resource names, assertions and timings only. Tasks that
  touch a credential value run with `no_log`.
- `run-tests.sh` validates credentials by **presence only** and never echoes a
  value, not even in an error message.
- Never copy a `clouds.yaml`, kubeconfig, or token file into this repository.
  Point `OSO_CLOUDS` at a path outside the working tree.

Verify the ignore rule is actually in effect before you trust it:

```bash
git check-ignore -v tests/.env
```

That must print the `.gitignore` file and line that matches. If it prints
nothing, `.env` is **not** ignored — stop and fix that before writing anything
real into it.

Before pushing, a quick sanity check:

```bash
git status --porcelain tests/
git diff --cached --name-only | grep -F 'tests/.env' && echo "STOP: .env is staged"
```

**Rotate anything you have exposed.** If a token, password or kubeconfig has
been pasted into a terminal, a chat window, a ticket, a CI log, or a shell
history file, treat it as compromised and rotate it. This applies to
`QUAY_TOKEN` and `VAULT_TOKEN` in particular, which are long-lived and
broadly scoped.

---

## Known lab limitations

These are properties of the current lab, not bugs in the suite. The suite is
written to degrade honestly rather than to produce false greens.

**The OpenStack site cannot host a full OpenShift deployment.** There is not
enough capacity. That is why the OpenStack coverage is split into **eevee**
(tenant network only, no OCP) and **snorlax** (a small VM proving the hybrid
network carries traffic). There is deliberately no "OpenShift on OpenStack"
suite — it would fail for capacity reasons and tell you nothing about the
platform.

**The OpenStack fabric path is currently not Ready.** `CloudInfrastructure/oso1`,
both `CloudGateway` resources and the `TransportLink` all report `Ready=false`
at the time of writing. The OpenStack suites therefore **self-skip**: they
check those objects at preflight and skip cleanly with an explanatory message
rather than failing. A skip here is expected, not a regression. They also skip
when `OSO_CLOUDS` is unset. Once the site comes up, the same suites run
unchanged.

**Two RHDP sandboxes at the same site cannot reach each other's public VIPs.**
When the hub and the OpenStack cluster are both RHDP sandboxes on different
host clusters of the same site, TLS from one to the other's `*.apps` routes
times out in both directions (the return path inside the RHDP load balancers
is broken; the internet reaches both fine). `CloudInfrastructure/oso1` then
reports `CredentialsInvalid` with a Keystone timeout and the WireGuard
transport never comes up. [`rhdp-relay/`](./rhdp-relay/README.md) builds a
small SNI-routing TLS relay on an outside OpenStack cloud and the matching
DNS forwarders on both clusters. It is an environment fix, not a suite.

**The `IaaC` resource is only ever tested in place.** `test-ditto-iaac.yaml`
never creates and never deletes an `IaaC`; it asserts against whatever exists.
Running it with `--tags create` or `--tags destroy` is a no-op. This is
intentional — the `IaaC` resource is platform-owned and shared.

**Cluster builds dominate wall-clock time.** squirtle and charmander can take
well over an hour. `HS_READY_TIMEOUT` defaults to 900s, which is not enough for
a cluster build; the cluster suites set their own longer build timeouts.

---

## Troubleshooting

### Finding leftovers

Every object the suite creates carries the label
`hybridsovereign.redhat/test-suite=true`. A single selector finds everything a
crashed run left behind:

```bash
oc get entity,rbac,team,project,persona,aaporg,quayorg,vault,vaultkv \
   -A -l hybridsovereign.redhat/test-suite=true

# Anything at all, across every namespaced kind the platform defines:
for k in $(oc api-resources --api-group=hybridsovereign.redhat \
            --namespaced -o name); do
  oc get "$k" -A -l hybridsovereign.redhat/test-suite=true --no-headers 2>/dev/null
done

# The per-suite namespaces
oc get ns | grep -E 'entity-(pikachu|bulbasaur|charmander|squirtle|eevee|snorlax)'
```

### Re-running just the teardown

Destroy is idempotent and safe to repeat. If a run died halfway through
`create`, or you used `-k` / `HS_KEEP_ON_FAILURE=true`:

```bash
./run-tests.sh -t destroy -s pikachu
./run-tests.sh -t destroy                 # every suite
```

Destroy deletes in reverse dependency order and waits up to
`HS_DESTROY_TIMEOUT` for each object to disappear.

### Stuck finalizers

A teardown that hangs until `HS_DESTROY_TIMEOUT` and then fails usually means
a finalizer is not being removed — typically because the operator pod is down,
or because the remote tool (Keycloak, Quay, Vault) is unreachable so the
operator cannot complete its cleanup.

It looks like this: the object has a `deletionTimestamp` in the past but still
exists, and `metadata.finalizers` is non-empty:

```bash
oc get entity pikachu -o jsonpath='{.metadata.deletionTimestamp}{"\n"}{.metadata.finalizers}{"\n"}'
```

Diagnose before you reach for a workaround:

```bash
oc describe entity pikachu | tail -40
oc logs -n sovereign-cloud deploy/<operator-deployment> --tail=200
```

Fix the underlying cause — restore the operator, restore the tool endpoint —
and the finalizer clears on its own. Force-removing a finalizer deletes the CR
while leaving the real object orphaned in Keycloak/Quay/Vault, which produces
exactly the drift this suite is meant to detect. Only do it as a last resort
on a lab you are about to rebuild, and clean up the remote object by hand
afterwards.

### Other common failures

| Symptom | Likely cause |
|---|---|
| Preflight: `OCP_CENTRAL_* not all set` | `.env` missing or incomplete — `cp .env.example .env` |
| Preflight: `endpoint was overridden but its credential was not` | You set e.g. `AAP_URL` without `AAP_PASSWORD`. Set both, or neither |
| Preflight: CRD `entities.hybridsovereign.redhat` not found | Pointed at the wrong cluster, or the operators are not installed |
| OpenStack tasks error instead of skipping | `OSO_CLOUDS` points at a missing file, or `OS_CLIENT_CONFIG_FILE` was not exported — use `run-tests.sh`, which does it for you |
| `x509: certificate signed by unknown authority` | Set `OCP_CENTRAL_VALIDATE_CERTS=false` for a self-signed lab cluster |
| Keycloak/AAP/Quay/Vault assertion fails but the CR is `Ready` | This is the bug class the suite exists to find. Check the operator logs for a silently swallowed API error |

---

## Prerequisites

On the control node:

- **`ansible-core`** (2.15 or newer)
- Ansible collections:
  - `kubernetes.core`
  - `openstack.cloud`
  - `community.general`
  - `ansible.posix` (used for the `profile_tasks` callback configured in `ansible.cfg`)
- Python modules:
  - `kubernetes`
  - `jmespath`

```bash
ansible-galaxy collection install \
  kubernetes.core openstack.cloud community.general ansible.posix

pip install kubernetes jmespath openstacksdk
```

Plus network reachability from the control node to the hub OpenShift API and
to the Keycloak, AAP, Quay and Vault routes, and — for the OpenStack suites —
to the OpenStack API endpoints.

---

## Layout

```
tests/
├── .env.example                        # documented credential surface (committed)
├── .env                                # your filled-in copy (gitignored, never commit)
├── ansible.cfg
├── inventory/hosts.yml                 # localhost; everything runs against remote APIs
├── group_vars/all.yml                  # shared config; reads every secret from the env
├── roles/
│   ├── platform_auth/                  # preflight + resolve tool creds from hub Secrets
│   ├── cr_apply/  cr_wait_ready/  cr_destroy/
│   ├── verify_keycloak_group/  verify_aap_org/  verify_quay_org/
│   ├── verify_vault/  verify_hybrid_network/
│   └── assert_report/
├── reports/                            # run artifacts; never contains a credential
├── rhdp-relay/                         # TLS relay + DNS forwarders for two RHDP sandboxes (environment fix)
├── run-tests.sh                        # the driver — start here
├── site.yaml                           # all eight suites, in dependency order
└── test-<pokemon>-*.yaml               # the eight suites
```
