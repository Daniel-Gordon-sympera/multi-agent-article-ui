"""The reference test for feature agents: signed-in client + stubbed pipeline API."""

from tests.conftest import fetch_all
from tests.pipeline_fixtures import JOB_ANALYSING, OPERATOR_KEY


async def test_signed_in_operator_reads_a_stubbed_job(operator_client, pipeline):
    response = await operator_client.get(f"/v1/jobs/{JOB_ANALYSING}")
    assert response.status_code == 200
    assert response.json()["status"] == "analysing"
    assert pipeline.calls.last.request.headers["X-API-Key"] == OPERATOR_KEY


async def test_viewer_sees_capabilities_and_rows_land_in_the_database(
    client_factory, engine, pipeline
):
    viewer = await client_factory("viewer", email="viewer@example.com")
    assert viewer.me["capabilities"]["signals_global"] is False
    pipeline.state["jobs"][JOB_ANALYSING]["status"] = "completed"  # mutate the stub
    job = await viewer.get(f"/v1/jobs/{JOB_ANALYSING}")
    assert job.json()["status"] == "completed"
    sessions = await fetch_all(engine, "SELECT user_id FROM ui.sessions")
    assert len(sessions) == 1
