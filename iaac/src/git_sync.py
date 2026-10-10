"""Git clone + Gitea sync engine."""

from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path

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

    def initialize_repo(self) -> None:
        clone_path = Path(self.settings.git_clone_path)
        clone_path.parent.mkdir(parents=True, exist_ok=True)
        if not (clone_path / ".git").exists():
            remote = (
                f"{self.settings.gitea_url.rstrip('/')}/"
                f"{self.settings.gitea_repo_owner}/{self.settings.gitea_repo_name}.git"
            )
            subprocess.run(
                ["git", "clone", remote, str(clone_path)],
                check=False,
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
            )

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

    def _git_commit_push(self) -> None:
        repo = self.settings.git_clone_path
        subprocess.run(["git", "-C", repo, "add", "-A"], check=False)
        subprocess.run(
            ["git", "-C", repo, "commit", "-m", "iaac auto-sync", "--allow-empty"],
            check=False,
        )
        subprocess.run(["git", "-C", repo, "push"], check=False)
