"""Read and role checks for the local combined acceptance harness."""

from contextlib import contextmanager

import httpx
from sqlalchemy import create_engine, text

UI_URL = "http://127.0.0.1:18080"
ADMIN_EMAIL = "acceptance@example.test"
ADMIN_PASSWORD = "Acceptance-initial-123!"
ADMIN_NEW_PASSWORD = "Acceptance-updated-123!"


@contextmanager
def login(password: str, email: str = ADMIN_EMAIL):
    client = httpx.Client(base_url=UI_URL, timeout=30)
    response = client.post(
        "/app/auth/login",
        json={"email": email, "password": password},
        headers={"X-Requested-With": "scout"},
    )
    response.raise_for_status()
    client.headers.update(
        {"X-Requested-With": "scout", "X-CSRF-Token": response.json()["csrf_token"]}
    )
    try:
        yield client
    finally:
        client.close()


def expect(response: httpx.Response, status: int = 200) -> dict:
    if response.status_code != status:
        raise AssertionError(
            f"{response.request.method} {response.request.url.path}: "
            f"expected {status}, got {response.status_code}"
        )
    return response.json() if response.content else {}


def verify_saved_state(client: httpx.Client, manifest: dict) -> None:
    for path, name in (
        ("/app/sources", "Combined acceptance source"),
        ("/app/scouts", "Combined acceptance Scout"),
        ("/app/views?route=/signals", "Combined acceptance signals"),
    ):
        body = expect(client.get(path))
        items = body.get("items", body) if isinstance(body, dict) else body
        assert any(row["name"] == name for row in items), path
    expect(client.get(f"/v1/articles/{manifest['article_id']}"))
    text_response = client.get(f"/v1/articles/{manifest['article_id']}?include=text")
    assert text_response.status_code == 200 and manifest["quote"] in text_response.text
    expect(
        client.get(f"/v1/articles/{manifest['expired_article_id']}?include=text"), 410
    )
    memberships = expect(
        client.get(
            "/app/batches",
            params={
                "job_ids": ",".join(manifest["job_ids"]),
            },
        )
    )["batches"]
    assert set(memberships) == set(manifest["job_ids"])
    assert all(row["batch_id"] == manifest["batch_id"] for row in memberships.values())
    batch = expect(client.get(f"/app/batches/{manifest['batch_id']}"))
    assert {row["job_id"] for row in batch["jobs"]} == set(manifest["job_ids"])
    assert all(row["status"] for row in batch["jobs"])
    for job_id in manifest["job_ids"]:
        assert expect(client.get(f"/v1/jobs/{job_id}"))["id"] == job_id
    assert expect(client.get("/readyz"))["status"] == "ready"


def verify_api_and_roles(manifest: dict) -> None:
    with login(ADMIN_NEW_PASSWORD) as admin:
        verify_saved_state(admin, manifest)
        rows = expect(
            admin.get("/app/signals", params={"company_key": manifest["company_key"]})
        )
        assert len(rows["items"]) == 3
        summary = expect(admin.get("/app/signals/summary"))
        assert summary["signals"] == 3 and summary["jobs"] == 2
        csv = admin.get("/app/signals/export.csv")
        assert csv.status_code == 200 and len(csv.text.splitlines()) == 4
        keys = expect(admin.get("/v1/api-keys"))
        assert all("key" not in row and "key_hash" not in row for row in keys["items"])
        for role in ("viewer", "operator"):
            email = f"acceptance-{role}@example.test"
            expect(
                admin.post(
                    "/app/users",
                    json={
                        "email": email,
                        "name": role,
                        "role": role,
                        "password": ADMIN_NEW_PASSWORD,
                    },
                ),
                201,
            )
            with login(ADMIN_NEW_PASSWORD, email) as user:
                # New users must change their password before normal API access.
                me = expect(user.get("/app/auth/me"))
                if me["user"]["must_change_password"]:
                    expect(
                        user.post(
                            "/app/auth/password",
                            json={
                                "current_password": ADMIN_NEW_PASSWORD,
                                "new_password": "Acceptance-role-updated-123!",
                            },
                        ),
                        204,
                    )
                    me = expect(user.get("/app/auth/me"))
                    user.headers["X-CSRF-Token"] = me["csrf_token"]
                expect(user.get("/v1/jobs"))
                expect(user.get("/v1/api-keys"), 403)
                expect(
                    user.get("/v1/access-policies"), 403 if role == "viewer" else 200
                )
                expect(
                    user.post("/v1/access-policies/example.com/reset"),
                    403 if role == "viewer" else 200,
                )
                if role == "viewer":
                    expect(user.post("/v1/jobs", json={}), 403)


def verify_database_permissions(owner_url):
    engine = create_engine(owner_url)
    try:
        with engine.begin() as connection:
            assert (
                connection.scalar(
                    text(
                        "SELECT count(*) FROM ui.audit_log "
                        "WHERE path='/v1/access-policies/example.com/reset' AND status=200"
                    )
                )
                >= 1
            )
            assert connection.scalar(
                text(
                    "SELECT has_table_privilege('app_maintenance', 'ui.users','SELECT')"
                )
            )
            assert not connection.scalar(
                text(
                    "SELECT has_table_privilege('app_maintenance', 'ui.users','UPDATE')"
                )
            )
            assert not connection.scalar(
                text("SELECT has_table_privilege('app_ui', 'platform.jobs','SELECT')")
            )
            connection.execute(
                text("CREATE TABLE ui.acceptance_grant_probe (id bigint)")
            )
            assert connection.scalar(
                text(
                    "SELECT has_table_privilege('app_maintenance', "
                    "'ui.acceptance_grant_probe','SELECT')"
                )
            )
            connection.execute(text("DROP TABLE ui.acceptance_grant_probe"))
    finally:
        engine.dispose()


def seed_ui_batch(owner_url, manifest):
    """Fixture writes stay in ui; existing job identities come through the API."""
    import json
    from uuid import uuid4

    batch_id = str(uuid4())
    with login(ADMIN_NEW_PASSWORD) as client:
        jobs = [
            expect(client.get(f"/v1/jobs/{job_id}")) for job_id in manifest["job_ids"]
        ]
    engine = create_engine(owner_url)
    try:
        with engine.begin() as connection:
            scout_id = connection.scalar(
                text("SELECT id FROM ui.scouts WHERE name='Combined acceptance Scout'")
            )
            user_id = connection.scalar(
                text("SELECT id FROM ui.users WHERE email=:email"),
                {"email": ADMIN_EMAIL},
            )
            connection.execute(
                text(
                    "INSERT INTO ui.batches "
                    "(id,scout_id,run_number,requested,created_by) "
                    "VALUES(:id,:scout,1,CAST(:requested AS jsonb),:user)"
                ),
                {
                    "id": batch_id,
                    "scout": scout_id,
                    "user": user_id,
                    "requested": json.dumps({"fixture": True}),
                },
            )
            for position, job in enumerate(jobs):
                connection.execute(
                    text(
                        "INSERT INTO ui.batch_jobs "
                        "(batch_id,position,industry,job_id,client_reference) "
                        "VALUES(:batch,:position,:industry,:job,:reference)"
                    ),
                    {
                        "batch": batch_id,
                        "position": position,
                        "industry": job["input"].get("industry"),
                        "job": job["id"],
                        "reference": job["client_reference"],
                    },
                )
            manifest.update(batch_id=batch_id, scout_id=str(scout_id))
    finally:
        engine.dispose()


def database_evidence(owner_url):
    engine = create_engine(owner_url)
    try:
        with engine.connect() as connection:
            return {
                "migration_heads": {
                    schema: connection.scalar(
                        text(f"SELECT version_num FROM {schema}.alembic_version")
                    )
                    for schema in ("public", "ui")
                },
                "row_counts": {
                    table: connection.scalar(text(f"SELECT count(*) FROM {table}"))
                    for table in (
                        "ui.users",
                        "ui.scouts",
                        "ui.sources",
                        "ui.saved_views",
                        "ui.batches",
                        "ui.batch_jobs",
                        "platform.jobs",
                        "platform.artifacts",
                        "analysis.company_mentions",
                    )
                },
            }
    finally:
        engine.dispose()
