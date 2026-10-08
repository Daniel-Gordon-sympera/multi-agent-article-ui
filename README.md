# Sympera Scout

Sympera Scout is the operator console for the Sympera AI article pipeline. It lets
you run jobs, inspect signals and their evidence, manage Scouts and news sources,
and control user access.

**Release: 2.1.0.** Use matching **v2.1.0** backend and UI checkouts. The API paths
remain `/v1`, and the integration contract marker remains **1**. The BFF checks the
backend contract and its API-key access before reporting ready.

## Start here

The shared [system guide](https://github.com/Daniel-Gordon-sympera/multi-agent-article/blob/main/GUIDE.md)
is the main guide for both repositories: local Docker setup, configuration,
first sign-in, operation, backup, and upgrades.

Keep the repositories side by side. The supported local setup uses the backend's
`.env.platform` for both services and serves the UI at `http://localhost:8080`.
`PLATFORM_ENV_FILE` selects another platform file; process variables take precedence.
Local HTTP uses `UI_SECURE_COOKIES=false`. Caddy is optional.

## How it works

- A React SPA talks to a same-origin FastAPI BFF.
- The BFF holds pipeline API keys and forwards allowed `/v1` requests by user role.
- Jobs and results stay in the backend; users, Scouts, sources and views use PostgreSQL's `ui` schema.
- Signals keep a separate row for each job and mention. Filters, summary counts and CSV exports use the backend's complete matching results.

## UI development

Use Node 22, pnpm 10, Python 3.12 and uv.

```bash
# From this repository, install the two toolchains.
uv sync --frozen
cd web
pnpm install --frozen-lockfile
pnpm dev:mock    # isolated UI with test fixtures
# Or: pnpm dev  # real local BFF at localhost:8080
```

Vite disables automatic `.env*` loading. It reads only `VITE_BFF_URL` from the
selected platform file for its development proxy; backend secrets stay on the server.

```bash
# From web/
pnpm check
pnpm build
pnpm e2e

# From the repository root
uv run ruff check .
uv run ruff format --check .
uv run lint-imports
uv run pytest -q
```

BFF integration tests require `UI_TEST_DATABASE_URL` pointing to a disposable
database. `pnpm e2e` runs mock browser and accessibility tests. The separate
[real-stack acceptance harness](scripts/combined_acceptance.py) documents its local
disposable database and build requirements. Generated API files are refreshed with
`pnpm gen:api`.

## More detail

- [v2.1.0 release notes](docs/releases/v2.1.0.md): changes, compatibility and verification.
- [Operator HOWTO](HOWTO.md): jobs, results, sources, settings and daily tasks.
- [Developer runbook](docs/dev/runbook.md): diagnostics and service operations.
- [Engineering contract](docs/dev/engineering-contract.md): API, security and development rules.
- [Integration decisions](docs/dev/decisions.md): design decisions and tradeoffs.
- [Pipeline API snapshot](docs/api/openapi-pipeline.json) and [BFF API snapshot](docs/api/openapi-bff.json).
