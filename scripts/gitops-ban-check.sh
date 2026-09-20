#!/usr/bin/env bash
# Fail CI / pre-push if banned patterns appear in gitops or active deploy paths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

check() {
  local pattern="$1"
  local msg="$2"
  if grep -RInE --exclude-dir=.git --exclude-dir=obsolete --exclude='*.md' \
      "$pattern" "$ROOT/gitops" "$ROOT/src" 2>/dev/null | grep -v TRACKING; then
    echo "BAN FAIL: $msg (pattern: $pattern)"
    FAIL=1
  fi
}

check 'quay\.signal9\.gg' 'external quay.signal9.gg must not appear in gitops/src'
check 'kind:[[:space:]]*Kafka($|[^a-zA-Z])' 'Kafka CRs banned'
check 'amq-streams' 'amq-streams banned in active gitops/src'

# Soft check: password keys in values (allow listed comments)
if grep -RnE '^\s+(password| Pal|secretKey|adminPassword):' "$ROOT/gitops" 2>/dev/null \
  | grep -v TRACKING | grep -v '#'; then
  echo "BAN FAIL: possible plaintext password keys under gitops/"
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
echo "gitops-ban-check: OK"
