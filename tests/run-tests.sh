#!/usr/bin/env bash
# =============================================================================
# run-tests.sh — driver for the HybridSovereign test suite.
#
# Sources tests/.env, validates that the required variables are present
# (never printing any value), and runs the selected suites, collecting
# pass/fail for all of them before reporting.
#
# See README.md for the full documentation.
# =============================================================================
set -euo pipefail

# Always operate from the directory this script lives in, so it can be invoked
# from anywhere and still find .env, ansible.cfg, inventory/ and the playbooks.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# -----------------------------------------------------------------------------
# Suite registry: short pokemon name -> playbook filename.
# Order here is the default run order (health first, then the stack).
# -----------------------------------------------------------------------------
SUITE_NAMES=(
  mewtwo
  lapras
  gengar
  ditto
  porygon
  pikachu
  bulbasaur
  squirtle
  charmander
  eevee
  snorlax
  machamp
)

suite_playbook() {
  case "$1" in
    mewtwo)    echo "test-mewtwo-platform-health.yaml" ;;
    lapras)    echo "test-lapras-platform-config.yaml" ;;
    gengar)    echo "test-gengar-fabric-infra.yaml" ;;
    ditto)     echo "test-ditto-iaac.yaml" ;;
    porygon)   echo "test-porygon-uihealth.yaml" ;;
    pikachu)   echo "test-pikachu-tenancy.yaml" ;;
    bulbasaur) echo "test-bulbasaur-hybridnetwork.yaml" ;;
    squirtle)  echo "test-squirtle-ocp-plain.yaml" ;;
    charmander) echo "test-charmander-ocp-hybrid.yaml" ;;
    eevee)     echo "test-eevee-openstack-network.yaml" ;;
    snorlax)   echo "test-snorlax-openstack-vm.yaml" ;;
    machamp)   echo "test-machamp-openstack-migration.yaml" ;;
    *)         return 1 ;;
  esac
}

suite_summary() {
  case "$1" in
    mewtwo)    echo "read-only platform / pod / ArgoCD health" ;;
    lapras)    echo "RbacConfig, AAPConfig, QuayConfig singletons, tested in place" ;;
    gengar)    echo "CloudInfrastructure, HybridFabric, CloudGateway, TransportLink, tested in place" ;;
    ditto)     echo "IaaC resource, tested in place (never created or deleted)" ;;
    porygon)   echo "UIHealthChecker lifecycle on a probe target discovered from the cluster" ;;
    pikachu)   echo "full tenancy stack: Entity, Rbac, Team, Project, Persona, AAPOrg, QuayOrg, Vault, VaultKV" ;;
    bulbasaur) echo "hybrid fabric + hybrid network on the hub (CloudVirt backend)" ;;
    squirtle)  echo "OCP cluster with NO hybrid network (control case)" ;;
    charmander) echo "OCP cluster joined to a hybrid network" ;;
    eevee)     echo "OpenStack tenant network only, no OCP" ;;
    snorlax)   echo "small OpenStack VM proving the hybrid network carries traffic" ;;
    machamp)   echo "OpenstackMigration via MTV; self-skips until MTV is installed" ;;
    *)         echo "" ;;
  esac
}

# -----------------------------------------------------------------------------
# Usage
# -----------------------------------------------------------------------------
usage() {
  cat <<'EOF'
Usage: run-tests.sh [-t TAGS] [-s SUITE ...] [-l] [-k] [-h]

  -t TAGS   Comma-separated Ansible tags. Default: "test"
  -s SUITE  Suite to run, by pokemon short name (e.g. pikachu). Repeatable.
            May be given once per suite; default is every suite.
  -l        List the available suites and exit.
  -k        Keep resources on failure (exports HS_KEEP_ON_FAILURE=true).
  -h        Show this help and exit.

TAGS — what each tag does:

  test      READ-ONLY. Logs in to the real tools (Keycloak, AAP, Quay, Vault,
            OpenStack, ACM) and asserts the expected state is present. It
            creates and deletes nothing. This is the safe default.

  create    MUTATES THE LIVE PLATFORM. Creates the test custom resources and
            waits for them to become Ready.

  destroy   MUTATES THE LIVE PLATFORM. Deletes the test custom resources and
            asserts the remote objects were reclaimed.

Three suites ignore 'create' and 'destroy' entirely and are always read-only:
lapras, gengar and ditto. The resources they cover (the RbacConfig/AAPConfig/
QuayConfig singletons, the CloudInfrastructure sites, the HybridFabric and its
gateways, and the IaaC export) are shared platform config that the whole lab
depends on, so those suites assert against the live objects in place and their
create/destroy tags are explicit no-ops.

Because 'create' and 'destroy' change the live platform, this script asks for
a typed confirmation when either appears in TAGS and stdin is a terminal. Set
HS_ASSUME_YES=true to skip the prompt (use this in CI only).

Examples:
  ./run-tests.sh                              # read-only sweep of every suite
  ./run-tests.sh -s pikachu                   # read-only, one suite
  ./run-tests.sh -t create,test,destroy -s pikachu
  ./run-tests.sh -t destroy -s pikachu -s bulbasaur
  HS_ASSUME_YES=true ./run-tests.sh -t create -s bulbasaur
EOF
}

list_suites() {
  printf '%-12s %-38s %s\n' "SUITE" "PLAYBOOK" "COVERS"
  printf '%-12s %-38s %s\n' "-----" "--------" "------"
  local s
  for s in "${SUITE_NAMES[@]}"; do
    printf '%-12s %-38s %s\n' "$s" "$(suite_playbook "$s")" "$(suite_summary "$s")"
  done
}

# -----------------------------------------------------------------------------
# Arguments
# -----------------------------------------------------------------------------
TAGS="test"
SELECTED=()
KEEP_ON_FAILURE="false"

while getopts ":t:s:lkh" opt; do
  case "$opt" in
    t) TAGS="$OPTARG" ;;
    s)
      if ! suite_playbook "$OPTARG" >/dev/null 2>&1; then
        echo "ERROR: unknown suite '$OPTARG'." >&2
        echo "Run 'run-tests.sh -l' to list the available suites." >&2
        exit 1
      fi
      SELECTED+=("$OPTARG")
      ;;
    l) list_suites; exit 0 ;;
    k) KEEP_ON_FAILURE="true" ;;
    h) usage; exit 0 ;;
    :) echo "ERROR: option -$OPTARG requires an argument." >&2; usage >&2; exit 1 ;;
    \?) echo "ERROR: unknown option -$OPTARG." >&2; usage >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

if [[ $# -gt 0 ]]; then
  echo "ERROR: unexpected argument '$1'. Suites are selected with -s." >&2
  usage >&2
  exit 1
fi

if [[ ${#SELECTED[@]} -eq 0 ]]; then
  SELECTED=("${SUITE_NAMES[@]}")
fi

# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------
if [[ ! -f .env ]]; then
  cat >&2 <<EOF
ERROR: $SCRIPT_DIR/.env not found.

The test suite reads every credential from tests/.env. Create it from the
documented template and fill it in:

    cp .env.example .env
    \${EDITOR:-vi} .env

tests/.env is gitignored and must never be committed.
EOF
  exit 1
fi

# Export everything defined in .env for Ansible's env lookups.
set -a
# shellcheck disable=SC1091  # .env is user-supplied and not in the repo.
source ./.env
set +a

# Presence-only validation. Never print a value.
missing=()
[[ -n "${OCP_CENTRAL_SERVER:-}" ]]   || missing+=("OCP_CENTRAL_SERVER")
[[ -n "${OCP_CENTRAL_USERNAME:-}" ]] || missing+=("OCP_CENTRAL_USERNAME")
[[ -n "${OCP_CENTRAL_PASSWORD:-}" ]] || missing+=("OCP_CENTRAL_PASSWORD")

if [[ ${#missing[@]} -gt 0 ]]; then
  {
    echo "ERROR: required variable(s) not set in $SCRIPT_DIR/.env:"
    printf '  - %s\n' "${missing[@]}"
    echo
    echo "These identify the hub ('central') OpenShift cluster that runs the"
    echo "HybridSovereign operators. See SECTION 1 of .env.example."
  } >&2
  exit 1
fi

# The openstack.cloud collection locates clouds.yaml via OS_CLIENT_CONFIG_FILE.
if [[ -n "${OSO_CLOUDS:-}" ]]; then
  export OS_CLIENT_CONFIG_FILE="$OSO_CLOUDS"
fi

if [[ "$KEEP_ON_FAILURE" == "true" ]]; then
  export HS_KEEP_ON_FAILURE=true
fi

# -----------------------------------------------------------------------------
# Destructive-tag guard
# -----------------------------------------------------------------------------
destructive=()
IFS=',' read -r -a _tag_list <<< "$TAGS"
for t in "${_tag_list[@]}"; do
  t="${t// /}"
  case "$t" in
    create|destroy) destructive+=("$t") ;;
  esac
done

if [[ ${#destructive[@]} -gt 0 ]]; then
  if [[ "${HS_ASSUME_YES:-false}" == "true" ]]; then
    echo "NOTE: HS_ASSUME_YES=true — skipping the confirmation prompt for: ${destructive[*]}"
  elif [[ -t 0 ]]; then
    echo
    echo "=============================================================="
    echo " WARNING: these tags MUTATE THE LIVE PLATFORM: ${destructive[*]}"
    echo "=============================================================="
    echo " Hub cluster : ${OCP_CENTRAL_SERVER}"
    echo " Tags        : ${TAGS}"
    echo " Suites      : ${SELECTED[*]}"
    echo
    printf 'Type exactly "yes, mutate the platform" to continue: '
    read -r confirmation
    if [[ "$confirmation" != "yes, mutate the platform" ]]; then
      echo "Aborted — no changes made." >&2
      exit 1
    fi
  else
    echo "ERROR: tags '${destructive[*]}' mutate the live platform, but stdin is" >&2
    echo "not a terminal so you cannot be prompted. Set HS_ASSUME_YES=true to" >&2
    echo "run non-interactively." >&2
    exit 1
  fi
fi

# -----------------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------------
mkdir -p reports

results=()
overall_rc=0

for suite in "${SELECTED[@]}"; do
  playbook="$(suite_playbook "$suite")"

  echo
  echo "=============================================================="
  echo " SUITE: $suite  ($playbook)   tags: $TAGS"
  echo "=============================================================="

  if [[ ! -f "$playbook" ]]; then
    echo "SKIP: $playbook does not exist."
    results+=("$suite|SKIP|$playbook (not found)")
    continue
  fi

  started=$SECONDS
  if ansible-playbook "$playbook" --tags "$TAGS"; then
    results+=("$suite|PASS|$((SECONDS - started))s")
  else
    results+=("$suite|FAIL|$((SECONDS - started))s")
    overall_rc=1
  fi
done

echo
echo "=============================================================="
echo " SUMMARY   (tags: $TAGS)"
echo "=============================================================="
printf '%-12s %-6s %s\n' "SUITE" "RESULT" "DETAIL"
printf '%-12s %-6s %s\n' "-----" "------" "------"
for row in "${results[@]}"; do
  IFS='|' read -r name status detail <<< "$row"
  printf '%-12s %-6s %s\n' "$name" "$status" "$detail"
done
echo

if [[ $overall_rc -ne 0 ]]; then
  echo "One or more suites FAILED."
  echo "Leftover objects can be found with:"
  echo "  oc get <kind> -A -l hybridsovereign.redhat/test-suite=true"
else
  echo "All selected suites passed."
fi

exit $overall_rc
