#!/bin/bash
# Install the latest erebe/wstunnel linux_amd64 release into /usr/local/bin.
set -euo pipefail
url=$(curl -fsSL https://api.github.com/repos/erebe/wstunnel/releases/latest | python3 -c 'import json,sys;d=json.load(sys.stdin);print([a["browser_download_url"] for a in d["assets"] if a["name"].startswith("wstunnel_") and a["name"].endswith("_linux_amd64.tar.gz")][0])')
echo "wstunnel asset: $url"
tmp=$(mktemp -d); cd "$tmp"
curl -fsSL -o w.tgz "$url"
tar xzf w.tgz
install -m 0755 wstunnel /usr/local/bin/wstunnel
/usr/local/bin/wstunnel --version || true
rm -rf "$tmp"
