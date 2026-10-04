"""The pipeline's maintenance schedule (plan: single maintenance instance, scheduler lock).

The API exposes neither the schedule nor the last results, so this table is static and
every row carries `last_result: null`; the note on the response says so.
"""

from __future__ import annotations

from typing import Any

MAINTENANCE_NOTE = (
    "Schedule from the pipeline plan; last results are not exposed by the pipeline API "
    "yet. Check the maintenance worker's logs for outcomes."
)

MAINTENANCE_JOBS: tuple[dict[str, Any], ...] = (
    {
        "name": "sweep_jobs",
        "cadence": "every 60 s",
        "description": "Finalises jobs whose tasks are done and enforces deadlines.",
    },
    {
        "name": "expire_artifacts",
        "cadence": "hourly",
        "description": "Deletes saved article text and exports past their retention.",
    },
    {
        "name": "purge_work_items",
        "cadence": "daily 03:00 UTC",
        "description": "Drops old work-item partitions.",
    },
    {
        "name": "backup_database",
        "cadence": "daily 02:00 UTC",
        "description": "Dumps the pipeline database to the artifact store.",
    },
    {
        "name": "export_dataset",
        "cadence": "on demand",
        "description": "Builds dataset exports requested through POST /v1/exports.",
    },
)


def maintenance_schedule() -> dict[str, Any]:
    return {
        "items": [{**job, "last_result": None} for job in MAINTENANCE_JOBS],
        "note": MAINTENANCE_NOTE,
    }
