#!/usr/bin/env bash
# scripts/ztp-wipe.sh — Full wipe of Hybrid Sovereign gitops-owned resources, then
# ONE Argo sync trigger on field-content. Safe for cold-cluster ZTP soak loops.
#
# NEVER deletes:
#   - OpenShift Project API (project.project.openshift.io) — that IS namespaces
#   - sovereign-* namespace shells (empty contents only)
#   - Baseline adoptees: aap, keycloak, openshift-storage, openshift-gitops,
#     openshift-cnv, cert-manager, openshift-operators, openshift-marketplace
#
# CRITICAL (ZTP-004): Always use FQ resource names:
#   <plural>.hybridsovereign.redhat
# Bare plurals like `projects` resolve to OpenShift Projects and destroy the cluster.
#
# Usage:
#   ./scripts/ztp-wipe.sh              # wipe + single field-content sync
#   ./scripts/ztp-wipe.sh --wipe-only  # wipe without trigger
#   ./scripts/ztp-wipe.sh --dry-run    # print planned actions
set -euo pipefail

MODE=wipe-and-trigger
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --wipe-only) MODE=wipe-only ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

LOG=/tmp/ztp-wipe-$(date +%Y%m%d-%H%M%S).log
exec > >(tee -a "$LOG") 2>&1
echo "=== ZTP wipe start $(date -u) mode=$MODE dry_run=$DRY_RUN log=$LOG ==="
oc whoami
oc whoami --show-server

OWNED='hybridsovereign.redhat/gitops-owned=true'
HS_GROUP='hybridsovereign.redhat'
# Namespaces we empty (never delete sovereign-* shells)
CLEAN_NS=(
  sovereign-cloud
  sovereign-cloud-plugins
  sovereign-ui
  sovereign-secrets
  vault
  gitea
  quay
  external-secrets
  open-cluster-management
  multicluster-engine
  openshift-acm
)
# Never touch these namespaces (baseline / platform)
PROTECTED_NS_RE='^(aap|keycloak|openshift-gitops|openshift-gitops-operator|openshift-storage|openshift-cnv|cert-manager|cert-manager-operator|openshift-operators|openshift-marketplace|openshift-ingress|openshift-authentication|openshift-oauth-apiserver|kube-|openshift-)$'

run() {
  if [ "$DRY_RUN" = 1 ]; then
    echo "DRY-RUN: $*"
  else
    "$@"
  fi
}

# Resolve CRD → fully-qualified resource name (plural.group). Refuse anything else.
fq_from_crd() {
  local crd_name="$1" # e.g. customresourcedefinition.apiextensions.k8s.io/projects.hybridsovereign.redhat
  local bare="${crd_name##*/}" # projects.hybridsovereign.redhat
  case "$bare" in
    *."$HS_GROUP")
      echo "$bare"
      ;;
    *)
      echo "REFUSING non-HS CRD: $bare" >&2
      return 1
      ;;
  esac
}

assert_not_openshift_project() {
  local res="$1"
  case "$res" in
    projects|project|project.project.openshift.io|projects.project.openshift.io)
      echo "FATAL: refusing OpenShift Project API resource '$res' (ZTP-004)" >&2
      exit 99
      ;;
  esac
  # Bare plural without group is forbidden for delete/patch of CRs
  if [[ "$res" != *.* ]]; then
    echo "FATAL: refusing bare resource name '$res' — must be plural.$HS_GROUP (ZTP-004)" >&2
    exit 99
  fi
  if [[ "$res" != *."$HS_GROUP" ]]; then
    echo "FATAL: refusing resource '$res' — not in group $HS_GROUP (ZTP-004)" >&2
    exit 99
  fi
}

echo "== Preflight: confirm we will never touch project.project.openshift.io =="
if oc api-resources --api-group=project.openshift.io -o name 2>/dev/null | grep -q .; then
  echo "OpenShift Project API present — wipe will NOT call it"
fi

echo "== A. Disable automation on field-content + hs-* apps =="
for app in $(oc -n openshift-gitops get applications.argoproj.io -o name 2>/dev/null || true); do
  run oc -n openshift-gitops patch "$app" --type=merge \
    -p='{"spec":{"syncPolicy":{"automated":null}}}' 2>/dev/null || true
done

echo "== B. Delete hs-* / gitops-owned Applications (keep field-content) =="
# Strip Argo resource finalizers so deletes do not hang (apps wait to prune children)
for app in $(oc -n openshift-gitops get applications.argoproj.io -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -E '^hs-' || true); do
  run oc -n openshift-gitops patch application.argoproj.io/"$app" --type=json \
    -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || \
  run oc -n openshift-gitops patch application.argoproj.io/"$app" --type=merge \
    -p='{"metadata":{"finalizers":null}}' 2>/dev/null || true
done
run oc -n openshift-gitops delete applications.argoproj.io -l "$OWNED" --wait=false 2>/dev/null || true
for app in $(oc -n openshift-gitops get applications.argoproj.io -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -E '^hs-' || true); do
  run oc -n openshift-gitops delete application.argoproj.io/"$app" --wait=false 2>/dev/null || true
done
[ "$DRY_RUN" = 1 ] || sleep 5

echo "== C. Delete hybridsovereign CRs (FQ names only) =="
for crd in $(oc get crd -o name 2>/dev/null | grep "\.${HS_GROUP}$" || true); do
  fq=$(fq_from_crd "$crd") || continue
  assert_not_openshift_project "$fq"
  echo "  delete $fq --all -A"
  # Strip finalizers via FQ resource only
  while IFS= read -r item; do
    [ -n "$item" ] || continue
    ns=${item%%/*}
    name=${item#*/}
    if [ "$ns" = "$name" ] || [ -z "$ns" ]; then
      run oc patch "$fq" "$name" --type=merge -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true
    else
      run oc -n "$ns" patch "$fq" "$name" --type=merge -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true
    fi
  done < <(oc get "$fq" -A -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  run oc delete "$fq" --all -A --wait=false 2>/dev/null || true
done

echo "== D. Delete entity-* namespaces only (never sovereign-*) =="
for ns in $(oc get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -E '^entity-' || true); do
  if echo "$ns" | grep -qE "$PROTECTED_NS_RE"; then
    echo "  skip protected $ns"
    continue
  fi
  echo "  delete ns/$ns"
  run oc delete ns "$ns" --wait=false 2>/dev/null || true
done

echo "== E. Empty gitops namespaces (keep sovereign-* shells) =="
for ns in "${CLEAN_NS[@]}"; do
  oc get ns "$ns" >/dev/null 2>&1 || continue
  if echo "$ns" | grep -qE "$PROTECTED_NS_RE"; then
    echo "  skip protected $ns"
    continue
  fi
  echo "--- empty $ns ---"
  run oc -n "$ns" delete quayregistry --all --wait=false 2>/dev/null || true
  run oc -n "$ns" delete objectbucketclaim --all --wait=false 2>/dev/null || true
  run oc -n "$ns" delete deploy,sts,ds,job,cronjob,bc,build,is,svc,route,ingress,networkpolicy,pvc,cm,secret,sa,role,rolebinding --all --wait=false 2>/dev/null || true
done

echo "== F. Cluster-scoped gitops leftovers (label / name scoped) =="
run oc delete clusterrole,clusterrolebinding -l "$OWNED" --wait=false 2>/dev/null || true
# Name-scoped deletes — never broad 'projects'
while IFS= read -r r; do
  [ -n "$r" ] || continue
  run oc delete "$r" --wait=false 2>/dev/null || true
done < <(oc get clusterrole,clusterrolebinding -o name 2>/dev/null | grep -E 'hybridsovereign|hs-aap-cred-sync|hs-ui-health|hs-plugin-cred' || true)
run oc delete clustersecretstore vault-backend --wait=false 2>/dev/null || true
run oc delete pushsecrets.external-secrets.io --all -A --wait=false 2>/dev/null || true
run oc delete externalsecrets.external-secrets.io --all -A --wait=false 2>/dev/null || true
while IFS= read -r r; do
  [ -n "$r" ] || continue
  run oc delete "$r" --wait=false 2>/dev/null || true
done < <(oc get oauthclient -o name 2>/dev/null | grep -iE 'sovereign|tenancy' || true)
while IFS= read -r r; do
  [ -n "$r" ] || continue
  run oc delete "$r" --wait=false 2>/dev/null || true
done < <(oc get consoleplugin -o name 2>/dev/null | grep sovereign || true)
run oc -n open-cluster-management delete multiclusterhub --all --wait=false 2>/dev/null || true

echo "== G. Delete hybridsovereign CRDs (FQ CRD names only) =="
while IFS= read -r crd; do
  [ -n "$crd" ] || continue
  case "$crd" in
    *."$HS_GROUP")
      echo "  delete crd/$crd"
      run oc delete crd "$crd" --wait=false 2>/dev/null || true
      ;;
    *)
      echo "  skip non-HS crd $crd"
      ;;
  esac
done < <(oc get crd -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep "\.${HS_GROUP}$" || true)

if [ "$DRY_RUN" = 1 ]; then
  echo "=== DRY-RUN complete. log=$LOG ==="
  exit 0
fi

echo "== H. Wait for entity-* ns + HS CRDs + hs-* apps gone (max ~8m) =="
for i in $(seq 1 48); do
  ents=$(oc get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -cE '^entity-' || true)
  crds=$(oc get crd -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -c "\.${HS_GROUP}$" || true)
  apps=$(oc -n openshift-gitops get applications.argoproj.io -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -cE '^hs-' || true)
  echo "t=${i} entity_ns=$ents hs_crds=$crds hs_apps=$apps"
  if [ "${ents:-0}" = "0" ] && [ "${crds:-0}" = "0" ] && [ "${apps:-0}" = "0" ]; then
    echo "WIPE CLEAN"
    break
  fi
  if [ "$i" -eq 16 ] || [ "$i" -eq 32 ]; then
    for ns in $(oc get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep -E '^entity-' || true); do
      oc get ns "$ns" -o json \
        | python3 -c 'import json,sys; n=json.load(sys.stdin); n["spec"]={"finalizers":[]}; json.dump(n,sys.stdout)' \
        | oc replace --raw "/api/v1/namespaces/$ns/finalize" -f - 2>/dev/null || true
    done
    for crd in $(oc get crd -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep "\.${HS_GROUP}$" || true); do
      oc patch crd "$crd" --type=merge -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true
    done
  fi
  sleep 10
done

echo "== I. Wipe summary =="
oc -n openshift-gitops get applications.argoproj.io 2>/dev/null || true
oc get crd 2>/dev/null | grep hybridsovereign || echo "no HS CRDs"
oc get ns 2>/dev/null | grep -E 'entity-|sovereign-|vault|gitea|quay' || true
# Safety check: core platform ns must still exist
for must in openshift-gitops default kube-system; do
  if ! oc get ns "$must" >/dev/null 2>&1; then
    echo "FATAL: required namespace missing after wipe: $must" >&2
    exit 98
  fi
done

if [ "$MODE" = "wipe-only" ]; then
  echo "=== WIPE DONE (no trigger) $(date -u) log=$LOG ==="
  exit 0
fi

echo "== J. SINGLE trigger: re-enable field-content automated sync + one sync op =="
oc -n openshift-gitops patch application.argoproj.io field-content --type=merge -p='{
  "spec": {
    "source": {"targetRevision": "main", "path": "gitops"},
    "syncPolicy": {
      "automated": {"prune": true, "selfHeal": true, "allowEmpty": false},
      "syncOptions": ["CreateNamespace=true","ServerSideApply=true","ApplyOutOfSyncOnly=true"]
    }
  }
}'
oc -n openshift-gitops patch application.argoproj.io field-content --type=merge -p='{
  "operation": {
    "initiatedBy": {"username": "ztp-wipe"},
    "sync": {"revision": "main", "prune": true, "syncStrategy": {"hook": {}}}
  }
}'

echo "=== WIPE DONE + SINGLE TRIGGER $(date -u) log=$LOG ==="
echo "MONITOR_ONLY from here — no patches, no refreshes, no mid-fixes."
