"""Git clone + Gitea sync engine."""

from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path
from urllib.parse import quote

import yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException

from config import WATCHED_KINDS, Settings
from gitea_client import GiteaClient
from strip import entity_from_namespace, gitea_path, strip_cr

logger = logging.getLogger(__name__)


class GitSyncEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.gitea = GiteaClient(
            settings.gitea_url,
            settings.gitea_token,
            settings.gitea_repo_owner,
            settings.gitea_repo_name,
        )
        self.tracked_paths: set[str] = set()
        try:
            config.load_incluster_config()
        except config.ConfigException:
            config.load_kube_config()
        self.custom = client.CustomObjectsApi()

    def _remote_url(self) -> str:
        """Clone/push URL with the API token embedded.

        The tenancy repo is created private, so an anonymous clone fails and
        leaves no working tree — every later commit/push then dies with
        "not a git repository".
        """
        base = self.settings.gitea_url.rstrip("/")
        scheme, _, host = base.partition("://")
        creds = f"{quote(self.settings.gitea_repo_owner, safe='')}:{quote(self.settings.gitea_token, safe='')}"
        return (
            f"{scheme}://{creds}@{host}/"
            f"{self.settings.gitea_repo_owner}/{self.settings.gitea_repo_name}.git"
        )

    def ensure_ready(self) -> bool:
        """Gate a sync pass on Gitea being usable.

        Called before every pass, not just at startup: during ZTP the sync pod
        can be running long before Gitea serves, and the repo may be created
        after the first pass has already failed.
        """
        if not self.gitea.ping():
            return False
        # Cheap no-op once the clone exists; retries it if an earlier attempt
        # failed because Gitea was not up.
        self.initialize_repo()
        return True

    def initialize_repo(self) -> None:
        """Make git_clone_path a working clone, whatever state it is in.

        Three cases, because a long-lived PVC sees all of them:
          - already a clone  -> nothing to do
          - empty directory  -> plain clone
          - files but no .git -> adopt them in place. An earlier build wrote
            the stripped YAML here while its unauthenticated clone was failing
            silently, so the PVC holds entity directories and `git clone`
            refuses with "destination path already exists and is not an empty
            directory" (rc 128) forever after.
        """
        clone_path = Path(self.settings.git_clone_path)
        clone_path.parent.mkdir(parents=True, exist_ok=True)

        if (clone_path / ".git").exists():
            return

        env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
        label = f"{self.settings.gitea_repo_owner}/{self.settings.gitea_repo_name}"

        def warn(step: str, rc: int) -> None:
            # Never log the URL or the command: both carry the token.
            logger.warning(
                "git %s for %s failed (rc=%s); the Gitea API path still commits "
                "every file, only the local mirror is unavailable",
                step, label, rc,
            )

        has_content = clone_path.exists() and any(clone_path.iterdir())
        if not has_content:
            rc = subprocess.run(
                ["git", "clone", self._remote_url(), str(clone_path)],
                check=False, capture_output=True, text=True, env=env,
            ).returncode
            if rc != 0:
                warn("clone", rc)
                return
        else:
            clone_path.mkdir(parents=True, exist_ok=True)
            for step, args in (
                ("init", ["init", "-q"]),
                ("remote", ["remote", "add", "origin", self._remote_url()]),
                ("fetch", ["fetch", "-q", "origin"]),
            ):
                rc = self._git(args)
                if rc != 0:
                    warn(step, rc)
                    return
            # Keep the files already on disk; just make them tracked against
            # the remote tip so the next commit is a normal delta.
            head = subprocess.run(
                ["git", "-C", str(clone_path), "symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
                check=False, capture_output=True, text=True, env=env,
            ).stdout.strip()
            branch = head.rsplit("/", 1)[-1] if head else "main"
            if self._git(["checkout", "-q", "-B", branch, f"origin/{branch}"]) != 0:
                # Remote may be an empty repo with no branches yet.
                self._git(["checkout", "-q", "-B", branch])
            logger.info("adopted existing contents of %s as a clone of %s", clone_path, label)

        self._git(["config", "user.email", "iaac@hybridsovereign.local"])
        self._git(["config", "user.name", "IaaC Git Sync"])

    def list_kind(self, plural: str) -> list[dict]:
        try:
            result = self.custom.list_cluster_custom_object(
                group=self.settings.api_group,
                version=self.settings.api_version,
                plural=plural,
            )
            return result.get("items", [])
        except ApiException as exc:
            logger.warning("list %s failed: %s", plural, exc)
            return []

    def full_sync(self) -> dict:
        expected: set[str] = set()
        total = 0
        errors: list[str] = []
        kinds: list[dict] = []

        for _kind, plural in WATCHED_KINDS:
            before = total
            for obj in self.list_kind(plural):
                stripped = strip_cr(obj)
                ns = obj.get("metadata", {}).get("namespace", "")
                name = obj.get("metadata", {}).get("name", "")
                kind = obj.get("kind", _kind)
                entity = entity_from_namespace(ns)
                path = gitea_path(entity, kind, name)
                content = yaml.safe_dump(stripped, sort_keys=False)
                try:
                    self.gitea.upsert_file(path, content, f"sync {kind}/{name}")
                    self._write_local(path, content)
                    expected.add(path)
                    total += 1
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"{path}: {exc}")
            kinds.append({"kind": _kind, "count": total - before})

        orphaned = self.tracked_paths - expected
        for path in orphaned:
            try:
                self.gitea.delete_file(path, f"remove orphan {path}")
                local = Path(self.settings.git_clone_path) / path
                if local.exists():
                    local.unlink()
            except Exception as exc:  # noqa: BLE001
                errors.append(f"delete {path}: {exc}")

        self.tracked_paths = expected
        self._git_commit_push()
        logger.info("sync complete: %d CRs, %d errors", total, len(errors))
        if errors:
            for err in errors[:10]:
                logger.error(err)
        return {"synced": total, "errors": errors, "kinds": kinds}

    def _write_local(self, path: str, content: str) -> None:
        local = Path(self.settings.git_clone_path) / path
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_text(content)

    def _git(self, args: list[str]) -> int:
        """Run a git command inside the clone, swallowing output."""
        return subprocess.run(
            ["git", "-C", self.settings.git_clone_path, *args],
            check=False,
            capture_output=True,
            text=True,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        ).returncode

    def _git_commit_push(self) -> None:
        # No clone (private repo unreachable at startup, or first run) — the
        # Gitea API has already committed every file, so skip quietly rather
        # than logging "not a git repository" on every pass.
        if not (Path(self.settings.git_clone_path) / ".git").exists():
            return
        self._git(["add", "-A"])
        self._git(["commit", "-m", "iaac auto-sync", "--allow-empty"])
        self._git(["push"])
