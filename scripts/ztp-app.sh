#!/usr/bin/env bash
# scripts/ztp-app.sh — Per-Application ZTP lifecycle (no full wipe).
#
# Use this to validate each hs-* app in wave order. On failure: cleanup that
# app only, fix git, push, redeploy that app. Full ./scripts/ztp-wipe.sh only
# after every app is independently Healthy.
#
# Usage:
#   ./scripts/ztp-app.sh list
#   ./scripts/ztp-app.sh status [APP]
#   ./scripts/ztp-app.sh wait APP [--timeout SECS]
#   ./scripts/ztp-app.sh wait-all [--timeout SECS]   # parallel wait every catalog app
#   ./scripts/ztp-app.sh cleanup APP
#   ./scripts/ztp-app.sh redeploy APP
#   ./scripts/ztp-app.sh redeploy-wave WAVE          # parallel cleanup+redeploy same-wave apps
#   ./scripts/ztp-app.sh validate-sequence [--from WAVE] [--to WAVE] [--parallel]
#   ./scripts/ztp-app.sh catalog
set -euo pipefail

NS_ARGO=openshift-gitops
ROOT_APP=field-content

# wave|app|git_path|cleanup_namespaces (comma)|notes
CATALOG=$(cat <<'EOF'
5|hs-argocd-capacity|gitops/infrastructure/argocd-capacity||idempotent tune Job
10|hs-eso|gitops/operators/eso|external-secrets|OLM + operand; never empty SA wipe
15|hs-builds|gitops/builds|sovereign-cloud|BuildConfigs/ImageStreams only
20|hs-vault|gitops/infrastructure/vault|vault|STS + init + unseal CronJob
22|hs-security|gitops/infrastructure/security|sovereign-secrets|needs Vault unsealed
24|hs-mce|gitops/infrastructure/mce|multicluster-engine|MCE Subscription before ACM hub
26|hs-acm|gitops/infrastructure/acm|open-cluster-management,openshift-acm|ACM hub after MCE
30|hs-quay|gitops/infrastructure/quay|quay|needs ODF NooBaa
31|hs-gitea|gitops/infrastructure/gitea|gitea|
35|hs-aap-config|gitops/infrastructure/aap|aap|adopt AAP; JobTemplates
38|hs-crds|gitops/custom-operators/crds||CRDs only (no Deployments)
40|hs-operators|gitops/custom-operators|sovereign-cloud|needs operator image + CRDs
42|hs-platform-configs|gitops/apps/platform-configs|sovereign-cloud-plugins|ZTP prereq: RbacConfig+AAPConfig+QuayConfig ready
46|hs-platform-smoke|gitops/apps/platform-smoke|sovereign-cloud,entity-acme-corp|always-on ACME smoke CRs
50|hs-ui|gitops/apps/ui|sovereign-ui|needs UI ImageStreams
60|hs-samples|gitops/apps/samples|sovereign-cloud|needs CRDs + operators
EOF
)

usage() {
  sed -n '2,18p' "$0"
  exit 2
}

app_row() {
  local app="$1"
  echo "$CATALOG" | awk -F'|' -v a="$app" '$2==a {print}'
}

list_apps() {
  echo "$CATALOG" | awk -F'|' '{printf "wave=%-3s %-22s %s\n", $1, $2, $5}'
}

status_one() {
  local app="$1"
  oc -n "$NS_ARGO" get application.argoproj.io "$app" \
    -o custom-columns=NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status,MSG:.status.health.message \
    --no-headers 2>/dev/null || echo "$app  MISSING  -  -"
}

status_all() {
  oc -n "$NS_ARGO" get applications.argoproj.io \
    -o custom-columns=NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status \
    --no-headers 2>/dev/null | grep -E '^(field-content|hs-)' || true
}

wait_app() {
  local app="$1" timeout="${2:-900}" start quiet="${3:-0}"
  start=$(date +%s)
  [ "$quiet" = "1" ] || echo "Waiting for $app Synced+Healthy (timeout ${timeout}s)..."
  while true; do
    local sync health
    sync=$(oc -n "$NS_ARGO" get application.argoproj.io "$app" -o jsonpath='{.status.sync.status}' 2>/dev/null || echo Missing)
    health=$(oc -n "$NS_ARGO" get application.argoproj.io "$app" -o jsonpath='{.status.health.status}' 2>/dev/null || echo Missing)
    [ "$quiet" = "1" ] || echo "  $(date -u +%H:%M:%SZ) sync=$sync health=$health"
    if [ "$sync" = "Synced" ] && [ "$health" = "Healthy" ]; then
      echo "OK $app"
      return 0
    fi
    if [ $(( $(date +%s) - start )) -ge "$timeout" ]; then
      echo "TIMEOUT $app sync=$sync health=$health" >&2
      oc -n "$NS_ARGO" get application.argoproj.io "$app" -o jsonpath='{.status.conditions[*].message}{"\n"}' 2>/dev/null || true
      return 1
    fi
    sleep 15
  done
}

# Wait many apps concurrently (one poller per app).
wait_apps_parallel() {
  local timeout="${1:-900}"; shift
  local apps=("$@") pids=() app rc=0 failed=()
  [ "${#apps[@]}" -gt 0 ] || return 0
  echo "Parallel wait (${#apps[@]} apps, timeout ${timeout}s): ${apps[*]}"
  for app in "${apps[@]}"; do
    ( wait_app "$app" "$timeout" 1 ) &
    pids+=("$!")
  done
  local i=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      rc=1
      failed+=("${apps[$i]}")
    fi
    i=$((i + 1))
  done
  if [ "$rc" -ne 0 ]; then
    echo "FAIL parallel wait: ${failed[*]}" >&2
    return 1
  fi
  echo "OK parallel wait (${#apps[@]} apps)"
}

wait_all_apps() {
  local timeout="${1:-1200}"
  local apps=()
  while IFS='|' read -r _wave app _path _ns _notes; do
    [ -n "${app:-}" ] || continue
    apps+=("$app")
  done <<< "$CATALOG"
  wait_apps_parallel "$timeout" "${apps[@]}"
}

# Scoped cleanup — never delete sovereign-* namespace shells, never touch baseline.
cleanup_app() {
  local app="$1"
  local row namespaces path
  row=$(app_row "$app")
  [ -n "$row" ] || { echo "unknown app: $app" >&2; exit 2; }
  namespaces=$(echo "$row" | awk -F'|' '{print $4}')
  path=$(echo "$row" | awk -F'|' '{print $3}')
  echo "== cleanup $app (path=$path) =="

  # Delete Application WITHOUT cascade finalizer so parent Namespaces survive.
  if oc -n "$NS_ARGO" get application.argoproj.io "$app" >/dev/null 2>&1; then
    oc -n "$NS_ARGO" patch application.argoproj.io "$app" --type=json \
      -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true
    oc -n "$NS_ARGO" delete application.argoproj.io "$app" --wait=false 2>/dev/null || true
    for i in $(seq 1 30); do
      oc -n "$NS_ARGO" get application.argoproj.io "$app" >/dev/null 2>&1 || break
      sleep 2
    done
  fi

  # App-specific leftovers not owned solely by Argo cascade
  case "$app" in
    hs-mce)
      oc -n multicluster-engine delete subscription,installplan,csv,operatorgroup --all --wait=false 2>/dev/null || true
      for obj in $(oc get multiclusterengine -o name 2>/dev/null || true); do
        oc patch "$obj" --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true
        oc delete "$obj" --wait=false 2>/dev/null || true
      done
      for obj in $(oc get clustermanager.operator.open-cluster-management.io -o name 2>/dev/null || true); do
        oc patch "$obj" --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true
        oc delete "$obj" --wait=false 2>/dev/null || true
      done
      # ZTP-019: NS leftover blocks ManagedCluster recreate
      if oc get ns local-cluster >/dev/null 2>&1; then
        oc delete managedclusteraddon,manifestwork --all -n local-cluster --wait=false 2>/dev/null || true
        oc delete ns local-cluster --wait=false 2>/dev/null || true
      fi
      ;;
    hs-acm)
      oc -n open-cluster-management delete subscription,installplan,csv,operatorgroup --all --wait=false 2>/dev/null || true
      for obj in $(oc get multiclusterhub -n open-cluster-management -o name 2>/dev/null || true); do
        oc -n open-cluster-management patch "$obj" --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true
        oc -n open-cluster-management delete "$obj" --wait=false 2>/dev/null || true
      done
      for mc in $(oc get managedcluster -o name 2>/dev/null || true); do
        oc patch "$mc" --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true
        oc delete "$mc" --wait=false 2>/dev/null || true
      done
      if oc get ns local-cluster >/dev/null 2>&1; then
        oc delete ns local-cluster --wait=false 2>/dev/null || true
      fi
      ;;
    hs-quay)
      oc -n quay delete quayregistry,subscription,installplan,csv,objectbucketclaim --all --wait=false 2>/dev/null || true
      ;;
    hs-vault)
      oc -n vault delete cronjob,job,sts,svc,secret,cm --all --wait=false 2>/dev/null || true
      ;;
    hs-security)
      oc delete clustersecretstores.external-secrets.io --all --wait=false 2>/dev/null || true
      oc delete pushsecrets.external-secrets.io -A --all --wait=false 2>/dev/null || true
      oc -n sovereign-secrets delete job,secret --all --wait=false 2>/dev/null || true
      ;;
    hs-crds)
      for crd in $(oc get crd -o name 2>/dev/null | grep '\.hybridsovereign\.redhat$' || true); do
        oc patch "$crd" --type=json -p='[{"op":"remove","path":"/metadata/finalizers"}]' 2>/dev/null || true
        oc delete "$crd" --wait=false 2>/dev/null || true
      done
      ;;
    hs-operators)
      oc -n sovereign-cloud delete deploy,job -l app.kubernetes.io/part-of=hybridsovereign-gitops --wait=false 2>/dev/null || true
      oc -n sovereign-cloud delete deploy -l hybridsovereign.redhat/gitops-owned=true --wait=false 2>/dev/null || true
      # Also remove hybridsovereign-* operator deploys
      for d in $(oc -n sovereign-cloud get deploy -o name 2>/dev/null | grep hybridsovereign || true); do
        oc -n sovereign-cloud delete "$d" --wait=false 2>/dev/null || true
      done
      ;;
    hs-builds)
      oc -n sovereign-cloud delete bc,is,build --all --wait=false 2>/dev/null || true
      ;;
    hs-ui)
      oc -n sovereign-ui delete deploy,svc,route,cm,secret --all --wait=false 2>/dev/null || true
      ;;
    hs-samples)
      for crd in $(oc get crd -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep '\.hybridsovereign\.redhat$' || true); do
        oc delete "${crd}" --all -A --wait=false 2>/dev/null || true
      done
      ;;
    hs-eso)
      echo "  note: ESO operand NS kept; only delete Application (OLM Subscriptions may remain)"
      ;;
  esac

  # Optional empty of content in listed namespaces (never delete NS shell)
  if [ -n "$namespaces" ]; then
    IFS=',' read -ra NSS <<< "$namespaces"
    for n in "${NSS[@]}"; do
      [ -n "$n" ] || continue
      case "$n" in
        external-secrets)
          echo "  skip emptying $n (ESO operand)"
          continue
          ;;
        aap|keycloak|openshift-*)
          echo "  skip emptying protected/baseline-ish $n"
          continue
          ;;
      esac
      if oc get ns "$n" >/dev/null 2>&1; then
        echo "  empty leftover Jobs/Pods in $n (NS retained)"
        oc -n "$n" delete job,pod --field-selector=status.phase!=Running --wait=false 2>/dev/null || true
      fi
    done
  fi
  echo "cleanup done: $app"
}

# Recreate Application by forcing parent field-content sync (app-of-apps).
redeploy_app() {
  local app="$1"
  cleanup_app "$app"
  echo "== redeploy $app via parent $ROOT_APP =="
  # Ensure parent still wants this child (provision flags in git)
  oc -n "$NS_ARGO" patch application.argoproj.io "$ROOT_APP" --type=merge -p="{
    \"operation\": {
      \"initiatedBy\": {\"username\": \"ztp-app\"},
      \"sync\": {\"revision\": \"main\", \"prune\": true, \"syncStrategy\": {\"hook\": {}}}
    }
  }"
  wait_app "$app" 1200
}

validate_sequence() {
  local from_wave="${1:-5}" to_wave="${2:-60}" parallel="${3:-0}"
  echo "== validate-sequence waves ${from_wave}→${to_wave} parallel=${parallel} =="
  local wave_apps=() cur_wave=""
  flush_wave() {
    [ "${#wave_apps[@]}" -eq 0 ] && return 0
    echo ""
    echo "### wave ${cur_wave} :: ${wave_apps[*]}"
    local a
    for a in "${wave_apps[@]}"; do
      if ! oc -n "$NS_ARGO" get application.argoproj.io "$a" >/dev/null 2>&1; then
        echo "  Application $a missing — triggering parent sync"
        oc -n "$NS_ARGO" patch application.argoproj.io "$ROOT_APP" --type=merge -p="{
          \"operation\": {
            \"initiatedBy\": {\"username\": \"ztp-app\"},
            \"sync\": {\"revision\": \"main\", \"prune\": true}
          }
        }"
        break
      fi
    done
    if [ "$parallel" = "1" ]; then
      if ! wait_apps_parallel 1200 "${wave_apps[@]}"; then
        echo "FAIL wave ${cur_wave}: ${wave_apps[*]}" >&2
        return 1
      fi
    else
      for a in "${wave_apps[@]}"; do
        if ! wait_app "$a" 1200; then
          echo "FAIL $a — run: ./scripts/ztp-app.sh cleanup $a && fix git && ./scripts/ztp-app.sh redeploy $a" >&2
          return 1
        fi
      done
    fi
    wave_apps=()
  }
  while IFS='|' read -r wave app path ns notes; do
    [ -n "$wave" ] || continue
    if [ "$wave" -lt "$from_wave" ] || [ "$wave" -gt "$to_wave" ]; then
      continue
    fi
    if [ -n "$cur_wave" ] && [ "$wave" != "$cur_wave" ]; then
      flush_wave || return 1
    fi
    cur_wave="$wave"
    wave_apps+=("$app")
  done <<< "$CATALOG"
  flush_wave || return 1
  echo ""
  echo "SEQUENCE OK ${from_wave}→${to_wave}"
}

redeploy_wave() {
  local wave="$1"
  local apps=()
  while IFS='|' read -r w app _path _ns _notes; do
    [ "$w" = "$wave" ] || continue
    apps+=("$app")
  done <<< "$CATALOG"
  [ "${#apps[@]}" -gt 0 ] || { echo "no apps in wave $wave" >&2; return 2; }
  echo "== redeploy-wave $wave parallel: ${apps[*]} =="
  local app pids=() rc=0
  for app in "${apps[@]}"; do
    ( cleanup_app "$app" ) &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do wait "$pid" || rc=1; done
  [ "$rc" -eq 0 ] || return 1
  oc -n "$NS_ARGO" patch application.argoproj.io "$ROOT_APP" --type=merge -p="{
    \"operation\": {
      \"initiatedBy\": {\"username\": \"ztp-app\"},
      \"sync\": {\"revision\": \"main\", \"prune\": true}
    }
  }"
  wait_apps_parallel 1200 "${apps[@]}"
}

cmd="${1:-}"
shift || true
case "$cmd" in
  list|catalog) list_apps ;;
  status)
    if [ "${1:-}" = "" ]; then status_all; else status_one "$1"; fi
    ;;
  wait)
    app="${1:?app required}"; shift || true
    timeout=900
    while [ $# -gt 0 ]; do
      case "$1" in
        --timeout) timeout="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    wait_app "$app" "$timeout"
    ;;
  wait-all)
    timeout=1200
    while [ $# -gt 0 ]; do
      case "$1" in
        --timeout) timeout="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    wait_all_apps "$timeout"
    ;;
  cleanup)
    cleanup_app "${1:?app required}"
    ;;
  redeploy)
    redeploy_app "${1:?app required}"
    ;;
  redeploy-wave)
    redeploy_wave "${1:?wave required}"
    ;;
  validate-sequence)
    from=5; to=60; parallel=1
    while [ $# -gt 0 ]; do
      case "$1" in
        --from) from="$2"; shift 2 ;;
        --to) to="$2"; shift 2 ;;
        --parallel) parallel=1; shift ;;
        --serial) parallel=0; shift ;;
        *) shift ;;
      esac
    done
    validate_sequence "$from" "$to" "$parallel"
    ;;
  -h|--help|"") usage ;;
  *) echo "unknown: $cmd" >&2; usage ;;
esac
