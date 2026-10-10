#!/usr/bin/env python3
"""IAAC Git sync — watches hybridsovereign CRs and syncs stripped YAML to Gitea."""

import logging
import os
import signal
import sys
import time

from config import Settings
from git_sync import GitSyncEngine
from status import IaacStatusReporter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("iaac")

# Back-off between consecutive failed passes, so a hub where Gitea arrives
# late does not spin at full rate and a permanent misconfiguration does not
# fill the log. Reset to BACKOFF_START after any successful pass.
BACKOFF_START = float(os.environ.get("BACKOFF_START", "15"))
BACKOFF_MAX = float(os.environ.get("BACKOFF_MAX", "300"))

# First-boot grace period. ZTP brings this app up close behind the Gitea
# bootstrap, so a few minutes of unavailability is normal, not an error.
STARTUP_WAIT = float(os.environ.get("STARTUP_WAIT", "600"))


def main() -> None:
    settings = Settings.from_env()
    engine = GitSyncEngine(settings)
    reporter = IaacStatusReporter(settings)

    stop = False

    def handle_signal(_signum, _frame):
        nonlocal stop
        stop = True
        logger.info("shutdown signal received")

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    def sleep_interruptibly(seconds: float) -> None:
        """Sleep in slices so SIGTERM is honoured promptly."""
        end = time.monotonic() + seconds
        while not stop:
            remaining = end - time.monotonic()
            if remaining <= 0:
                return
            time.sleep(min(1.0, remaining))

    # Wait for Gitea on first boot, but never exit if it misses the window —
    # the loop below keeps retrying for the life of the pod.
    if not engine.gitea.wait_until_ready(timeout=STARTUP_WAIT):
        reporter.report_waiting("waiting for Gitea to become available")

    logger.info("IAAC sync starting; reconcile interval=%ss", settings.reconcile_interval)

    backoff = BACKOFF_START
    while not stop:
        try:
            if engine.ensure_ready():
                reporter.report(engine.full_sync())
                ok = True
            else:
                reporter.report_waiting("Gitea not reachable; will retry")
                ok = False
        except Exception as exc:  # noqa: BLE001 — the loop must outlive any failure
            logger.exception("sync pass failed: %s", exc)
            reporter.report_error(exc)
            ok = False

        if stop:
            break
        if ok:
            backoff = BACKOFF_START
            sleep_interruptibly(settings.reconcile_interval)
        else:
            logger.info("retrying in %.0fs", backoff)
            sleep_interruptibly(backoff)
            backoff = min(backoff * 2, BACKOFF_MAX)

    logger.info("IAAC sync shutting down")


if __name__ == "__main__":
    sys.exit(main())
