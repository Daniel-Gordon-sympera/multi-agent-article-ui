"""Mutating routes of the stub pipeline API: jobs, cancel, retry, API keys."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import httpx

from tests.pipeline_fixtures import PROMPT_VERSION
from tests.pipeline_support import problem


class MutationRoutesMixin:
    """Mixed into PipelineStub; relies on its state, _gate and _authenticate."""

    def _create_job(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        try:
            body = json.loads(request.content or b"{}")
        except ValueError:
            body = None
        required = {"kind", "county", "state"}
        if not isinstance(body, dict) or not required <= set(body):
            return problem(
                request,
                422,
                "validation_error",
                "Request validation failed.",
                errors=[
                    {"location": ["body"], "message": "kind, county, state required"}
                ],
            )
        reference = body.get("client_reference")
        if reference:
            for job in self.state["jobs"].values():
                if job.get("client_reference") == reference:
                    return problem(
                        request,
                        409,
                        "client_reference_exists",
                        "This client_reference already identifies a job.",
                        job_id=job["id"],
                        job_status=job["status"],
                        links={"self": f"/v1/jobs/{job['id']}"},
                    )
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        job_input = {
            name: body[name]
            for name in ("url", "seeds", "location", "industry")
            if name in body
        }
        job = {
            "id": job_id,
            "kind": body["kind"],
            "input": job_input,
            "county": body["county"],
            "state_code": body["state"],
            "settings": body.get("settings", {}),
            "prompt_version": PROMPT_VERSION,
            "status": "queued",
            "stop_reason": None,
            "client_reference": reference,
            "created_by": "ui",
            "created_at": now,
            "started_at": None,
            "deadline_at": None,
            "finished_at": None,
            "summary": None,
            "sessions": [],
            "progress": {},
            "costs": [],
        }
        self.state["jobs"][job_id] = job
        self.created_jobs.append(body)
        return httpx.Response(
            202,
            json={
                "job_id": job_id,
                "status": "queued",
                "prompt_version": PROMPT_VERSION,
                "links": {
                    "self": f"/v1/jobs/{job_id}",
                    "summary": f"/v1/jobs/{job_id}/summary",
                },
            },
        )

    def _cancel_job(self, request: httpx.Request, job_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        job, missing = self._job_or_404(request, job_id)
        if missing:
            return missing
        if job["status"] not in {
            "completed",
            "partial",
            "failed",
            "cancelled",
            "cancelling",
        }:
            job["status"] = "cancelling"
        return httpx.Response(202, json={"job_id": job_id, "status": job["status"]})

    def _retry_task(self, request: httpx.Request, task_id: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        task = self.state["tasks"].get(int(task_id))
        if task is None:
            return problem(
                request, 404, "resource_not_found", "The task does not exist."
            )
        if task["status"] != "dead":
            return problem(
                request, 409, "task_not_dead", "Only dead tasks can be retried."
            )
        task["status"], task["attempts"] = "queued", 0
        return httpx.Response(
            202, json={"task_id": int(task_id), "status": "queued", "attempts": 0}
        )

    def _create_key(self, request: httpx.Request) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        body = json.loads(request.content or b"{}")
        name = body.get("name")
        if not name:
            return problem(
                request, 422, "validation_error", "Request validation failed."
            )
        if name in self.state["api_keys"]:
            return problem(
                request, 409, "key_name_exists", "This API key name already exists."
            )
        row = {
            "id": len(self.state["api_keys"]) + 1,
            "name": name,
            "role": body.get("role", "reader"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.state["api_keys"][name] = row
        return httpx.Response(
            201,
            json={**row, "key": "sympera_new-key-" + uuid.uuid4().hex},
            headers={"Cache-Control": "no-store"},
        )

    def _revoke_key(self, request: httpx.Request, name: str) -> httpx.Response:
        self._gate(request)
        if denied := self._authenticate(request, operator=True):
            return denied
        if name not in self.state["api_keys"]:
            return problem(
                request, 404, "key_not_found", "The API key name does not exist."
            )
        del self.state["api_keys"][name]
        return httpx.Response(204)
