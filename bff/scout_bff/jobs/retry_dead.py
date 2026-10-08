"""Forward the backend's atomic dead-task retry command unchanged."""

from typing import Any

from scout_bff.pipeline_client import PipelineClient


async def retry_dead_via_api(pipeline: PipelineClient, job_id: str) -> dict[str, Any]:
    response = await pipeline.request("POST", f"/v1/jobs/{job_id}/retry-dead")
    return response.json()
