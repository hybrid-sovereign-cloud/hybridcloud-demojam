#!/usr/bin/env python3
"""Fail if any relative Markdown link in the repo points at a missing file.

Run after moving docs around: `python3 -I scripts/check-doc-links.py`.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINK = re.compile(r"\]\(([^)\s#]+)(?:#[^)\s]*)?\)")


def main() -> int:
    files = subprocess.check_output(["git", "-C", ROOT, "ls-files", "*.md"], text=True).split()
    broken: list[str] = []
    for rel_file in files:
        src_dir = os.path.dirname(rel_file)
        try:
            text = open(os.path.join(ROOT, rel_file), encoding="utf-8").read()
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        for target in LINK.findall(text):
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            resolved = os.path.normpath(os.path.join(ROOT, src_dir, target))
            if not os.path.exists(resolved):
                broken.append(f"{rel_file}: {target}")

    for item in broken:
        print(f"BROKEN {item}")
    print(f"\n{len(broken)} broken link(s) across {len(files)} markdown file(s)")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
