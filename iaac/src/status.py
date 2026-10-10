"""Write sync results back onto the Iaac CRs.

Without this the Iaac CR is inert: the StatefulSet does the work but nothing
ever sets `status.ready`, so the CR can never go healthy and ZTP has no signal
to gate on. Every Iaac CR in the cluster gets the same cluster-wide result —
the sync engine is a singleton StatefulSet, not a per-CR reconciler.
"""

from __future__ import annotations

import datetime
import logging

from kubernetes import client
from kubernetes.client.rest import ApiException

from config import Settings

logger = logging.getLogger(__name__)

IAAC_PLURAL = "iaacs"


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class IaacStatusReporter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.custom = client.CustomObjectsApi()

    def _condition(self, ready: bool, message: str) -> dict:
        return {
            "type": "Ready",
            "status": "True" if ready else "False",
            "reason": "SyncSucceeded" if ready else "SyncFailed",
            "message": message,
            "lastTransitionTime": _now(),
        }

    def report(self, result: dict) -> None:
        """Patch status onto every Iaac CR. Never raises — status is best effort."""
        errors = result.get("errors") or []
        synced = result.get("synced", 0)
        ready = not errors
        if ready:
            message = f"Synced {synced} CRs to {self.settings.gitea_repo_owner}/{self.settings.gitea_repo_name}"
        else:
            message = f"Synced {synced} CRs with {len(errors)} error(s): {errors[0]}"

        # Field names and printer columns are fixed by crd-iaac.yaml — keep them in step.
        now = _now()
        status = {
            "ready": ready,
            "status": "ready" if ready else "error",
            "message": message,
            "lastSyncTime": now,
            "lastReconciledAt": now,
            "totalCRsSynced": synced,
            "syncErrors": len(errors),
            "syncedKinds": result.get("kinds") or [],
            "repository": (
                f"{self.settings.gitea_url.rstrip('/')}/"
                f"{self.settings.gitea_repo_owner}/{self.settings.gitea_repo_name}"
            ),
            "conditions": [self._condition(ready, message)],
        }

        for obj in self._list_iaacs():
            meta = obj.get("metadata", {})
            name, namespace = meta.get("name"), meta.get("namespace")
            if not name or not namespace:
                continue
            try:
                self.custom.patch_namespaced_custom_object_status(
                    group=self.settings.api_group,
                    version=self.settings.api_version,
                    namespace=namespace,
                    plural=IAAC_PLURAL,
                    name=name,
                    body={"status": status},
                )
                logger.info("status updated on Iaac/%s in %s (ready=%s)", name, namespace, ready)
            except ApiException as exc:
                logger.warning("status patch on Iaac/%s in %s failed: %s", name, namespace, exc)

    def _list_iaacs(self) -> list[dict]:
        try:
            return self.custom.list_cluster_custom_object(
                group=self.settings.api_group,
                version=self.settings.api_version,
                plural=IAAC_PLURAL,
            ).get("items", [])
        except ApiException as exc:
            logger.warning("list iaacs failed: %s", exc)
            return []
