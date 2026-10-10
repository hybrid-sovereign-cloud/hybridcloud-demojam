"""Gitea REST API client."""

from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any
from urllib.parse import quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Transport-level retry. During ZTP the sync pod routinely starts before Gitea
# is serving, so connection errors and 5xx/429 are expected rather than
# exceptional and must not surface as per-file sync failures.
_RETRY = Retry(
    total=5,
    connect=5,
    read=5,
    status=5,
    backoff_factor=1.0,  # 0s, 1s, 2s, 4s, 8s
    status_forcelist=(429, 500, 502, 503, 504),
    allowed_methods=frozenset(["GET", "PUT", "POST", "DELETE"]),
    raise_on_status=False,
)


class GiteaClient:
    def __init__(self, base_url: str, token: str, owner: str, repo: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.owner = owner
        self.repo = repo
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"token {token}"})
        self.session.verify = False  # internal lab certs
        adapter = HTTPAdapter(max_retries=_RETRY)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # Probe session deliberately has no transport retry: wait_until_ready
        # is itself the retry loop, and a 30s retrying probe would blow past
        # its own timeout.
        self.probe_session = requests.Session()
        self.probe_session.headers.update({"Authorization": f"token {token}"})
        self.probe_session.verify = False

    def ping(self) -> bool:
        """True when Gitea answers and the token is accepted for this repo."""
        try:
            resp = self.probe_session.get(
                f"{self.base_url}/api/v1/repos/{self.owner}/{self.repo}", timeout=10
            )
        except requests.RequestException as exc:
            logger.info("gitea not reachable yet: %s", exc)
            return False
        if resp.status_code == 200:
            return True
        logger.info(
            "gitea repo %s/%s not usable yet (HTTP %s)",
            self.owner,
            self.repo,
            resp.status_code,
        )
        return False

    def wait_until_ready(self, timeout: float = 600.0) -> bool:
        """Block until the repo is reachable, or give up and let the caller retry.

        Returning False is not fatal: the caller reports a degraded status and
        tries again on the next pass, so a Gitea that appears late in a ZTP run
        is picked up without the pod crash-looping.
        """
        deadline = time.monotonic() + timeout
        delay = 5.0
        while time.monotonic() < deadline:
            if self.ping():
                return True
            time.sleep(delay)
            delay = min(delay * 2, 60.0)
        logger.warning(
            "gitea %s/%s still not ready after %.0fs; will retry next pass",
            self.owner,
            self.repo,
            timeout,
        )
        return False

    def _contents_url(self, path: str) -> str:
        return f"{self.base_url}/api/v1/repos/{self.owner}/{self.repo}/contents/{quote(path, safe='/')}"

    def get_file(self, path: str) -> dict[str, Any] | None:
        resp = self.session.get(self._contents_url(path), timeout=30)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def upsert_file(self, path: str, content: str, message: str) -> None:
        existing = self.get_file(path)
        payload = {
            "content": base64.b64encode(content.encode()).decode(),
            "message": message,
        }
        if existing:
            payload["sha"] = existing["sha"]
            resp = self.session.put(self._contents_url(path), json=payload, timeout=30)
        else:
            resp = self.session.post(self._contents_url(path), json=payload, timeout=30)
        resp.raise_for_status()

    def delete_file(self, path: str, message: str) -> None:
        existing = self.get_file(path)
        if not existing:
            return
        payload = {"sha": existing["sha"], "message": message}
        resp = self.session.delete(self._contents_url(path), json=payload, timeout=30)
        resp.raise_for_status()
