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
from watcher import CRWatcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("iaac")


def main() -> None:
    settings = Settings.from_env()
    engine = GitSyncEngine(settings)
    engine.initialize_repo()
    reporter = IaacStatusReporter(settings)

    def sync_and_report() -> None:
        reporter.report(engine.full_sync())

    watcher = CRWatcher(settings, on_change=sync_and_report)
    stop = False

    def handle_signal(_signum, _frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    logger.info("IAAC sync starting; reconcile interval=%ss", settings.reconcile_interval)
    sync_and_report()

    while not stop:
        watcher.poll_once()
        time.sleep(settings.reconcile_interval)

    logger.info("IAAC sync shutting down")


if __name__ == "__main__":
    sys.exit(main())
