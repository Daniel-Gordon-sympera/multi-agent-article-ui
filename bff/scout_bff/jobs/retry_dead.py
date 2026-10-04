"""`POST /app/jobs/{id}/retry-dead` (contract §4.3).

With capability `retry_dead` the call is forwarded to `POST /v1/jobs/{id}/retry-dead`
(B3). Without it the BFF walks `GET /v1/jobs/{id}/tasks?status=dead` and retries each
task with `POST /v1/tasks/{id}/retry`, collecting successes and the 409s of tasks that
changed state meanwhile.
"""

from __future__ import annotations

from typing import Any

from scout_bff.pipeline_client import PipelineClient, problem_from_response

TASK_PAGE_SIZE = 1000
MAX_TASK_PAGES = 10


def normalise_result(body: Any, requested: list[int] | None = None) -> dict[str, Any]:
    """`{retried, task_ids, skipped_task_ids}` from whatever shape the API answers."""
    data = body if isinstance(body, dict) else {}
    task_ids = [int(value) for value in data.get("task_ids") or [] if _is_int(value)]
    if not task_ids and requested and data.get("retried") == len(requested):
        task_ids = list(requested)
    retried = data.get("retried")
    if not _is_int(retried):
        retried = len(task_ids)
    skipped = [int(v) for v in data.get("skipped_task_ids") or [] if _is_int(v)]
    return {"retried": int(retried), "task_ids": task_ids, "skipped_task_ids": skipped}


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


async def retry_dead_via_api(pipeline: PipelineClient, job_id: str) -> dict[str, Any]:
    response = await pipeline.request("POST", f"/v1/jobs/{job_id}/retry-dead")
    try:
        body = response.json()
    except ValueError:
        body = {}
    return normalise_result(body)


async def list_dead_task_ids(pipeline: PipelineClient, job_id: str) -> list[int]:
    ids: list[int] = []
    async for task in pipeline.iter_items(
        f"/v1/jobs/{job_id}/tasks",
        max_pages=MAX_TASK_PAGES,
        status="dead",
        limit=TASK_PAGE_SIZE,
    ):
        task_id = task.get("id") if isinstance(task, dict) else None
        if _is_int(task_id) and task_id not in ids:
            ids.append(task_id)
    return ids


async def retry_dead_by_looping(
    pipeline: PipelineClient, job_id: str
) -> dict[str, Any]:
    """The bounded fallback: every dead task of the job, one retry call each."""
    retried: list[int] = []
    skipped: list[int] = []
    for task_id in await list_dead_task_ids(pipeline, job_id):
        response = await pipeline.request(
            "POST", f"/v1/tasks/{task_id}/retry", accept_statuses=(409,)
        )
        if response.status_code == 409:
            skipped.append(task_id)
            continue
        if response.is_error:
            raise problem_from_response(response)
        retried.append(task_id)
    return {"retried": len(retried), "task_ids": retried, "skipped_task_ids": skipped}
