"""Local real-stack acceptance and full-database restore; no provider calls.

Run with the UI virtualenv, COMBINED_DATABASE_URL pointing at an empty, disposable
combined_test database, and an already built web/dist. Use PostgreSQL client tools
matching the test server. The harness never drops databases or existing data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

import httpx
from combined_checks import (
    ADMIN_EMAIL,
    ADMIN_NEW_PASSWORD,
    ADMIN_PASSWORD,
    UI_URL,
    database_evidence,
    expect,
    login,
    seed_ui_batch,
    verify_api_and_roles,
    verify_database_permissions,
    verify_saved_state,
)
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

UI_ROOT = Path(__file__).resolve().parents[1]
API_URL = "http://127.0.0.1:18000"


def checked_url(value: str, database: str):
    url = make_url(value)
    if url.database != database or url.host not in {"127.0.0.1", "localhost"}:
        raise ValueError(f"Only the local disposable {database} database is allowed")
    return url


def url_string(url) -> str:
    return url.render_as_string(hide_password=False)


def private_json(path: Path, value: dict) -> None:
    path.touch(mode=0o600, exist_ok=True)
    path.chmod(0o600)
    path.write_text(json.dumps(value, indent=2))


def run(command: list[str], cwd: Path, environment: dict, log: Path) -> None:
    with log.open("ab") as stream:
        result = subprocess.run(
            command, cwd=cwd, env=environment, stdout=stream, stderr=subprocess.STDOUT
        )
    if result.returncode:
        raise RuntimeError(f"Command failed; inspect {log}")


def wait_ready(url: str, process: subprocess.Popen, log: Path) -> None:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Service exited; inspect {log}")
        try:
            if httpx.get(url + "/readyz", timeout=2).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.2)
    raise RuntimeError(f"Service readiness failed; inspect {log}")


def start(command: list[str], cwd: Path, environment: dict, log: Path):
    with log.open("ab") as stream:
        return subprocess.Popen(
            command, cwd=cwd, env=environment, stdout=stream, stderr=subprocess.STDOUT
        )


def stop(processes: list[subprocess.Popen]) -> None:
    for process in reversed(processes):
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    processes.clear()


def create_restore_target(owner_url) -> None:
    database = "combined_restore_test"
    admin_url = owner_url.set(database="postgres")
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as connection:
            exists = connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname=:name"),
                {"name": database},
            )
            if not exists:
                connection.execute(text('CREATE DATABASE "combined_restore_test"'))
    finally:
        engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend", type=Path, default=UI_ROOT.parent / "multi-agent-article"
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--prepared", action="store_true", help="Use an existing seeded manifest"
    )
    parser.add_argument("--postgres-tools-directory", type=Path)
    args = parser.parse_args()
    owner = checked_url(os.environ["COMBINED_DATABASE_URL"], "combined_test")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    output.chmod(0o700)
    backend = args.backend.resolve()
    backend_python = str(backend / ".venv/bin/python")
    ui_python = sys.executable
    environment = dict(
        os.environ,
        PLATFORM_ENV_FILE="/dev/null",
        DATABASE_URL=url_string(owner),
        ARTIFACT_STORE_URL=(output / "artifacts").as_uri(),
        LOG_LEVEL="WARNING",
    )
    service_password = os.environ.get(
        "COMBINED_SERVICE_PASSWORD"
    ) or secrets.token_urlsafe(32)
    for role in ("API", "MAINTENANCE", "FINDER", "SECTIONS", "DISCOVERY", "ANALYSIS"):
        environment[f"{role}_DATABASE_PASSWORD"] = service_password
    environment.update(
        UI_DATABASE_PASSWORD=service_password,
        UI_DATABASE_URL=url_string(owner),
        SESSION_SECRET=secrets.token_urlsafe(40),
        PIPELINE_API_URL=API_URL,
        PIPELINE_OPERATOR_KEY="pending",
        PIPELINE_READER_KEY="pending",
        UI_BOOTSTRAP_ADMIN_EMAIL=ADMIN_EMAIL,
        UI_BOOTSTRAP_ADMIN_PASSWORD=ADMIN_PASSWORD,
        UI_PUBLIC_URL=UI_URL,
        UI_SECURE_COOKIES="false",
    )
    if args.postgres_tools_directory:
        for tool in ("PG_DUMP", "PG_RESTORE"):
            environment[f"{tool}_BINARY"] = str(
                args.postgres_tools_directory / tool.lower()
            )
    manifest_path = output / "manifest.json"
    if not args.prepared:
        run(
            [backend_python, "-m", "cli.bootstrap"],
            backend,
            environment,
            output / "bootstrap.log",
        )
        run(
            [
                backend_python,
                "-m",
                "benchmarks.ui_acceptance_seed",
                "--database-url",
                url_string(owner),
                "--artifact-dir",
                str(output / "artifacts"),
                "--manifest",
                str(manifest_path),
            ],
            backend,
            environment,
            output / "seed.log",
        )
    manifest = json.loads(manifest_path.read_text())
    manifest.update(
        company_state=manifest.get("state", "FL"),
        admin_email=ADMIN_EMAIL,
        admin_password=ADMIN_PASSWORD,
        admin_new_password=ADMIN_NEW_PASSWORD,
    )
    private_json(manifest_path, manifest)
    run(
        [ui_python, "-m", "scout_bff.bootstrap"],
        UI_ROOT,
        environment,
        output / "ui-bootstrap.log",
    )
    environment["API_BOOTSTRAP_KEY"] = secrets.token_urlsafe(40)
    api_command = [
        backend_python,
        "-m",
        "uvicorn",
        "api.app:create_app",
        "--factory",
        "--host",
        "127.0.0.1",
        "--port",
        "18000",
    ]
    ui_command = [
        ui_python,
        "-c",
        "from pathlib import Path; import uvicorn; "
        "from scout_bff.app import create_app; "
        "uvicorn.run(create_app(static_directory=Path('web/dist')), "
        "host='127.0.0.1',port=18080)",
    ]
    processes = []
    try:
        api_environment = dict(
            environment,
            DATABASE_URL=url_string(
                owner.set(username="app_api", password=service_password)
            ),
        )
        processes.append(
            start(api_command, backend, api_environment, output / "api.log")
        )
        wait_ready(API_URL, processes[-1], output / "api.log")
        with httpx.Client(
            base_url=API_URL, headers={"X-API-Key": environment["API_BOOTSTRAP_KEY"]}
        ) as api:
            for role in ("reader", "operator"):
                record = expect(
                    api.post(
                        "/v1/api-keys",
                        json={"name": f"acceptance-{role}", "role": role},
                    ),
                    201,
                )
                environment[f"PIPELINE_{role.upper()}_KEY"] = record["key"]
        ui_environment = dict(
            environment,
            UI_DATABASE_URL=url_string(
                owner.set(username="app_ui", password=service_password)
            ),
        )
        processes.append(start(ui_command, UI_ROOT, ui_environment, output / "ui.log"))
        wait_ready(UI_URL, processes[-1], output / "ui.log")
        browser_environment = dict(
            environment, COMBINED_UI_URL=UI_URL, COMBINED_MANIFEST=str(manifest_path)
        )
        run(
            [
                "npx",
                "--yes",
                "--package=node@22",
                "--package=pnpm@10.28.0",
                "--",
                "pnpm",
                "--dir",
                "web",
                "exec",
                "playwright",
                "test",
                "--config",
                "playwright.combined.config.ts",
            ],
            UI_ROOT,
            browser_environment,
            output / "browser.log",
        )
        seed_ui_batch(owner, manifest)
        private_json(manifest_path, manifest)
        verify_api_and_roles(manifest)
        original_evidence = database_evidence(owner)
        verify_database_permissions(owner)
        maintenance_url = owner.set(
            username="app_maintenance", password=service_password
        )
        dump_environment = dict(
            environment,
            DATABASE_URL=url_string(maintenance_url),
            ACCEPTANCE_DUMP=str(output / "database.dump"),
        )
        run(
            [
                backend_python,
                "-c",
                "import asyncio,os; from pathlib import Path; "
                "from services.maintenance.backup import dump_database; "
                "asyncio.run(dump_database(os.environ['DATABASE_URL'],Path(os.environ['ACCEPTANCE_DUMP'])))",
            ],
            backend,
            dump_environment,
            output / "backup.log",
        )
        stop(processes)
        create_restore_target(owner)
        archive = output / "database.dump"
        restore_url = owner.set(database="combined_restore_test")
        checked_url(url_string(restore_url), "combined_restore_test")
        restored_environment = dict(
            environment, RESTORE_DATABASE_URL=url_string(restore_url)
        )
        run(
            [
                backend_python,
                "-m",
                "cli.restore",
                "--archive",
                str(archive),
                "--sha256",
                hashlib.sha256(archive.read_bytes()).hexdigest(),
            ],
            backend,
            restored_environment,
            output / "restore.log",
        )
        run(
            [ui_python, "-m", "scout_bff.bootstrap"],
            UI_ROOT,
            dict(environment, UI_DATABASE_URL=url_string(restore_url)),
            output / "restore-ui.log",
        )
        api_environment["DATABASE_URL"] = url_string(
            restore_url.set(username="app_api", password=service_password)
        )
        ui_environment["UI_DATABASE_URL"] = url_string(
            restore_url.set(username="app_ui", password=service_password)
        )
        processes.append(
            start(api_command, backend, api_environment, output / "restored-api.log")
        )
        wait_ready(API_URL, processes[-1], output / "restored-api.log")
        processes.append(
            start(ui_command, UI_ROOT, ui_environment, output / "restored-ui.log")
        )
        wait_ready(UI_URL, processes[-1], output / "restored-ui.log")
        with login(ADMIN_NEW_PASSWORD) as restored:
            verify_saved_state(restored, manifest)
        verify_database_permissions(restore_url)
        restored_evidence = database_evidence(restore_url)
        assert original_evidence == restored_evidence
        (output / "result.json").write_text(
            json.dumps(
                {
                    "browser": "passed",
                    "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                    "original": original_evidence,
                    "restored": restored_evidence,
                    "api_and_roles": "passed",
                    "backup_role": "app_maintenance",
                    "restored_database": "combined_restore_test",
                    "restored_ui_and_artifacts": "passed",
                },
                indent=2,
            )
        )
        print(f"Combined acceptance and restore passed: {output / 'result.json'}")
    finally:
        stop(processes)


if __name__ == "__main__":
    main()
