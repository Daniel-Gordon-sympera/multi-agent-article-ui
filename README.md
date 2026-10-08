# Sympera Scout

Sympera Scout is the operator console for the Sympera AI news multi-agent article
pipeline ([`multi-agent-article`](https://github.com/Daniel-Gordon-sympera/multi-agent-news-article)).
It is for the people who run the pipeline: launch a run for a county, state and
industry (or a site, or a list of seeds) and watch it progress stage by stage;
open any job and see its site runs, tasks, costs and events; read every result —
signals with their verbatim evidence, companies with their flags, summaries,
articles with the saved text; explore signals across jobs with filters and saved
views; curate the list of local news sources; manage API keys, workers, exports
and the console's own users. It replaces `curl`, `psql` and `python -m cli.main`
for day-to-day operation. Current version: **0.1.0** (`bff/scout_bff/version.py`).

## Status

The console connects to the pipeline API contract version **1**. Deploy the matching
backend and UI together. The API provides global signals and tasks, source acceptance
statistics, recorded model-cost estimates, job filters and the API-key inventory.
The BFF checks required paths, fields and authenticated key access in `/readyz`.
Missing or incompatible APIs produce a clear error; bounded result fallbacks have
been removed.

Local Docker is the supported integration setup. VM deployment is outside this work.

## Architecture

```
 browser (SPA) ──HTTP localhost:8080──► ui (FastAPI BFF, :8080)
   React 19 · TanStack Router/Query/Table        │  GET /            static SPA (built by Vite)
   shadcn/ui · Tailwind v4 · Lucide              │  /app/*           UI-owned API: auth, scouts, batches, sources, views, prefs
   polling 5 s / 30 s · ETag                     │  /v1/*            reverse proxy → api:8000, injects X-API-Key by role
                                                 │  /healthz /readyz
                                                 ▼
                             ┌────────────────────────────────┐        ┌──────────────────────────┐
                             │ PostgreSQL 16 (existing)       │        │ api (existing FastAPI)   │
                             │  ui.*  users · sessions ·      │◄─SQL───┤ platform.* finder.* …    │
                             │        scouts · batches ·      │        │ contract version 1 reads      │
                             │        sources · saved_views · │        └──────────────────────────┘
                             │        preferences · audit_log │
                             └────────────────────────────────┘
 The UI never reads the pipeline schemas directly; everything about jobs and results comes through /v1.
```

Rules: the browser calls exactly one origin (the BFF); the BFF holds the pipeline
keys; `ui.*` is the only schema the UI writes (role `svc_ui`, login `app_ui`); the UI
stores references to pipeline rows (job ids, article ids, company keys, domains), never
copies of result data, except the finder facts a promoted source keeps. A **job** is
one pipeline run; a **Scout** is a saved setup owned by the UI; running a Scout
creates one job per industry (a **batch**, coupled to the API only through
`client_reference = ui:<batch_id>:<industry>`).

## Features

Every screen uses the real API through the same-origin BFF. MSW remains available for isolated UI tests.

| Screen | Route | Phase | Status |
|---|---|---|---|
| Sign-in | `/sign-in` | U0/U1 | done |
| Change password (forced after bootstrap or admin reset) | `/account/password` | U1 | done |
| Overview — tiles, active runs, needs attention, workers, recent signals | `/` | U5 | done — global task counts and recorded daily statistics |
| Jobs › Runs — filters, polling, cancel / resume / re-run, batch chips, CSV of the page | `/jobs` | U2 | done — server search, running-state group and filters; newest jobs first |
| Jobs › Scouts — saved setups, run (one job per industry), last run + signals, edit / archive | `/jobs/scouts` | U3 | done — ⋯ › Duplicate starts a new Scout from the saved setup ("<name> (copy)") |
| New run / Scout — mode toggle, fan-out preview, advanced settings, save as Scout | `/jobs/new` | U2 · U3 | done — `?scout=` edits / runs a Scout, `?from=` re-runs a job, `?mode=seeds&source=` pre-ticks a seed; estimate from comparable completed jobs with complete recorded model cost |
| Job › Overview — header, stepper, counters, site runs, cost by stage, settings | `/jobs/$jobId` | U2 | done — "—" where the API has no fact |
| Job › Signals (shared SignalsTable + drawer, server filters, `signals.csv`) | `/jobs/$jobId/signals` (`?detail=` opens the drawer) | U2 | done |
| Job › Companies (flags switch) · Summaries · Articles | `/jobs/$jobId/{companies,summaries,articles}` | U2 | done — keyset paging, URL-bound filters, CSV per table |
| Job › Site runs (+ finder sources and ranking) · Sections · Tasks (tree, retry, retry all dead) · Events | `/jobs/$jobId/{site-runs,sections,tasks,events}` | U2 | done — atomic retry action; events are paged oldest first (API order) |
| Signals explorer — filters, chips, saved views, column chooser, drawer, CSV | `/signals` (`?detail=<id>&detail_job=<job_id>`) | U4 | done — every matching job; list, summary and CSV share filters |
| Data Sources — curated list, add / edit / remove / restore, CSV import, finder suggestions, promote / dismiss, CSV export | `/sources` | U3 | done — article acceptance rate; incomplete candidate history is unavailable |
| Settings › API keys (admin) · Website access (operator) · Workers & health · Stats & costs · Exports · System · Preferences · Users (admin) | `/settings/{keys,access-policies,workers,stats,exports,system,preferences,users}` | U5 | done — server key inventory; website access read/reset is operator-only; unavailable telemetry is labelled |

## Quick start (Docker)

Scout runs in the pipeline's local Compose project (`article-pipeline`) and shares
PostgreSQL. Check out this repository as the sibling `../multi-agent-articles-ui`.
Use the pipeline's `.env.platform` for both services; append the settings documented
in [the shared backend template](../multi-agent-article/.env.platform.example). Keep `UI_SECURE_COOKIES=false` and
`UI_PUBLIC_URL=http://localhost:8080` for local HTTP. Caddy is optional and is not
required for this setup.

Start the pipeline with `docker compose --env-file .env.platform up -d` and check
`http://localhost:8000/readyz` before adding the UI.

1. **Create the two pipeline API keys** the BFF will use (once). With the pipeline's
   bootstrap key from its `.env.platform`:

   ```bash
   curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
        -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
        -d '{"name": "scout-ui-operator", "role": "operator"}'
   curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
        -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
        -d '{"name": "scout-ui-reader", "role": "reader"}'
   ```

   Each `201` response contains the plaintext `key` exactly once.

2. **Add the UI variables to the pipeline's `.env.platform`** — the variables are listed and
   explained in [the shared backend template](../multi-agent-article/.env.platform.example). Required:
   `UI_DATABASE_PASSWORD` (new random value), `PIPELINE_OPERATOR_KEY`,
   `PIPELINE_READER_KEY` (from step 1), `SESSION_SECRET` (`openssl rand -hex 32`),
   `UI_BOOTSTRAP_ADMIN_EMAIL` and `UI_BOOTSTRAP_ADMIN_PASSWORD` (your first admin).
   Optional: `UI_PORT` (default `8080`) and `UI_IMAGE_TAG` (default `local`).

3. **Build and start**, from the pipeline repo:

   ```bash
   docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml config --quiet
   docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml up -d --build
   curl --fail http://127.0.0.1:8080/readyz
   docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml ps
   ```

   `ui_migrate` runs first (creates schema `ui`, roles `svc_ui`/`app_ui`, applies the
   Alembic history, creates the admin when `ui.users` is empty; idempotent), then `ui`
   starts once the pipeline API is healthy.

4. **Sign in** at `http://localhost:8080`. Use the bootstrap admin and change its
   password. Create accounts under Settings › Users, then remove
   `UI_BOOTSTRAP_ADMIN_PASSWORD` from `.env.platform`.

Step-by-step operator tasks (keys, users, runs, retries, exports, upgrades, backups)
are in [HOWTO.md](HOWTO.md).

## Local development

Two toolchains: **pnpm 10 / Node 22** for `web/`, **uv / Python 3.12** for the BFF at
the root. Full command table: `docs/dev/engineering-contract.md` §3.

```bash
# SPA only, no backend — MSW fixtures shaped like the mockup
cd web && pnpm install --frozen-lockfile && pnpm dev:mock        # http://localhost:5173
# mock accounts: admin@sympera.ai / scout-admin · operator@sympera.ai / scout-operator
#                viewer@sympera.ai / scout-viewer · newcomer@sympera.ai / scout-newcomer (forced password change)

# Real integration: start the local Compose stack described above.
# Vite can also proxy to that BFF for UI editing:
cd web && pnpm dev                                              # http://localhost:5173
```

For a bare BFF during development, settings default to the sibling pipeline file
`../multi-agent-article/.env.platform`. `PLATFORM_ENV_FILE=/absolute/path/.env.platform`
selects another file; process environment takes precedence. Use an owner
`UI_DATABASE_URL` only for bootstrap, and the `app_ui` login for the running BFF.
The Docker services set these two URLs separately.

Builds: `pnpm build` (`pnpm gen:routes && tsc -b && vite build`) writes the real SPA to
`web/dist` — it never includes the MSW worker; copy or symlink `web/dist` to
`bff/scout_bff/static` to serve it from the BFF without Vite (the Docker image does the
copy). `pnpm preview:mock` and `pnpm e2e` build the mock variant into `web/dist-mock`,
so `web/dist` is always a real build. Fonts (Plus Jakarta Sans, JetBrains Mono) ship as
files because the CSP is `font-src 'self'`. `pnpm gen:api` regenerates the TypeScript
API types from `docs/api/openapi-pipeline.json` and `docs/api/openapi-bff.json`
(`uv run python -m scout_bff.openapi > docs/api/openapi-bff.json` first).

## Testing

| Where | Command | Notes |
|---|---|---|
| web | `pnpm check` | `tsc -b --noEmit`, ESLint (incl. jsx-a11y), Prettier check, Vitest |
| web | `pnpm build` | production build must pass |
| web | `pnpm e2e` | Playwright against `preview:mock` (:4173, built into `web/dist-mock`), axe on every page; run when touching routes |
| bff | `uv run ruff check . && uv run ruff format --check .` | lint + format |
| bff | `uv run lint-imports` | import boundaries (never from the pipeline repo) |
| bff | `uv run pytest -q` | unit tests always; the integration tests need `UI_TEST_DATABASE_URL` (a disposable database), otherwise they are skipped with a reason |
| image | `docker build --check .`, `docker build .` and `docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml config` | the compose check runs from the pipeline repo |

CI (`.github/workflows/ci.yml`) runs the same four groups on every pull request and on
`main`: `web`, `bff` (with a `postgres:16` service), `e2e` and `image` (build, no push).
Unit and mock browser tests use respx/MSW. The separate combined acceptance harness
uses the real API and BFF with a disposable local database and deterministic fixtures;
it does not call external websites or models.

## What was verified

On the integration branch: Node 22 `pnpm check` passes 105 tests and `pnpm build` passes.
The combined acceptance and Docker verification results are recorded with the integration hand-back.

Historical baseline:

Checked in the development sandbox on 2026-10-04, on the merged `main`:

- `pnpm check` (97 Vitest tests), `pnpm build`, `pnpm e2e` (22 Playwright tests with axe
  on every page, mock mode), `ruff`, `lint-imports` and `pytest` (290 tests against a
  real PostgreSQL 16, the pipeline API stubbed with respx) all pass.
- **Real-stack walkthrough.** The actual pipeline API (branch `feature/platform-and-api`)
  and the BFF ran against one PostgreSQL database, the SPA served by the BFF. Through
  the browser: signed in with the bootstrap admin, was forced to change the password,
  created a URL run and a two-industry Scout (fan-out through `POST /v1/jobs`, batch
  chips on Runs), opened the job with all nine tabs, cancelled it, added a Data Source,
  created an API key and created a user — zero failed requests.

## Configuration

All variables, with comments and defaults, are in [the shared backend template](../multi-agent-article/.env.platform.example).
In Docker, always pass `--env-file .env.platform`; Compose reads the shared pipeline
file and sets container connection URLs. Bare BFF processes read the sibling platform
file or `PLATFORM_ENV_FILE`. `.env` and `.env.ui` are not loaded. Vite also disables automatic `.env*` loading and reads only `VITE_BFF_URL` from the selected platform file for its development proxy. Required at runtime:
`UI_DATABASE_URL`, `PIPELINE_API_URL`, `PIPELINE_OPERATOR_KEY`, `PIPELINE_READER_KEY`,
`SESSION_SECRET` (≥ 32 characters). Bootstrap additionally needs `UI_DATABASE_PASSWORD`
(password for `app_ui`) and, for the first admin, `UI_BOOTSTRAP_ADMIN_EMAIL` /
`UI_BOOTSTRAP_ADMIN_PASSWORD`. Tuning: `UI_DB_POOL_SIZE` (default 5),
`UI_CAPABILITY_REFRESH_SECONDS` (300), `UI_SESSION_IDLE_HOURS` (12),
`UI_SESSION_ABSOLUTE_DAYS` (7), `UI_AUDIT_RETENTION_DAYS` (180), `LOG_LEVEL`,
`LOG_FORMAT`. `UI_PORT` is the host port Compose binds and the port
`python -m scout_bff` listens on. Compose-only: `UI_IMAGE_TAG`; `UI_DOMAIN` applies only to optional HTTPS.

## Security model

- **Same origin only.** The browser talks to the BFF; there is no CORS. The BFF serves
  the SPA, `/app/*` and the `/v1/*` proxy.
- **Secrets stay server-side.** `PIPELINE_OPERATOR_KEY`, `PIPELINE_READER_KEY`,
  `SESSION_SECRET` and `UI_DATABASE_PASSWORD` exist only in the BFF's environment and
  are registered for log redaction. The proxy strips any incoming `X-API-Key` and
  injects the key for the user's role: `admin`/`operator` → operator key, `viewer` →
  reader key.
- **Accounts and sessions.** Local accounts (argon2id); `scout_session` cookie
  (`HttpOnly; SameSite=Lax; Secure` unless `UI_SECURE_COOKIES=false`), server-side
  rows in `ui.sessions` with 12 h idle and 7 d absolute expiry. Login rate limits: 10
  failures per e-mail / 15 min, 60 per IP / hour; messages never reveal whether an
  account exists.
- **CSRF.** Every unsafe request carries `X-Requested-With: scout` and `X-CSRF-Token`
  (from `GET /app/auth/me`); otherwise `403 csrf_failed`.
- **Roles.** `admin ⊃ operator ⊃ viewer`. The `/v1` proxy follows `docs/api/pipeline-routes.txt`: API-key inventory/create/revoke
  are admin-only; website access read/reset are operator-only; other reads permit
  viewers and other writes require an operator; anything else
  `404 not_proxied`. Viewers may download per-job CSVs but not start dataset exports.
- **Headers.** CSP `default-src 'self'` (`font-src 'self'`: fonts self-hosted, no
  third-party requests), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: same-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`.
- **Audit.** Every unsafe `/app` call and proxied unsafe `/v1` call is written to
  `ui.audit_log` (user, role, method, path, target, status, duration); kept 180 days.
- **Database isolation.** Role `svc_ui` owns schema `ui`; the login `app_ui` is granted
  `svc_ui` and nothing outside `ui`. Bootstrap uses the owner connection once.

## Deployment and upgrade

- **Image.** `scout-ui:${UI_IMAGE_TAG:-local}`, built by `compose … up --build` or
  `docker build -t scout-ui:<tag> ../multi-agent-articles-ui`. Use a release tag for
  deployments (`UI_IMAGE_TAG=0.1.0`) and `local` on a dev box.
- **Migrations.** `ui_migrate` runs on every `up` and is idempotent; migrations are
  additive. To apply them without restarting the console:
  `docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml run --rm ui_migrate`.
- **Upgrade.** Pull the new UI commit, set `UI_IMAGE_TAG`, then
  `up -d --build` (or `build ui` then `up -d ui_migrate ui`). The local console briefly restarts; sessions survive because they live in `ui.sessions` (as long as
  `SESSION_SECRET` is unchanged).
- **Rotating keys.** Pipeline keys: create new ones through `POST /v1/api-keys` (or
  Settings › API keys), replace the two values in `.env.platform`, `up -d ui`, then
  `DELETE /v1/api-keys/<old-name>`. `SESSION_SECRET`: change and `up -d ui` — every
  user is signed out. Database password: change `UI_DATABASE_PASSWORD`, re-run
  `ui_migrate` (it alters the role), then `up -d ui`.
- **Backup.** The maintenance role has read access to schema `ui` for full database backups.
  Verify both dump and restore in a disposable database after permission changes. For a
  UI-only snapshot before a risky change: `pg_dump -n ui` (HOWTO.md §11).
- Runbook: [`docs/dev/runbook.md`](docs/dev/runbook.md).

## Troubleshooting

- **`/readyz` says `not_ready`.** `curl -sS http://127.0.0.1:8080/readyz` returns
  `{status, checks: {database, migrations, pipeline_api}}`. `database` → the `app_ui`
  login or password (`UI_DATABASE_PASSWORD` must match what `ui_migrate` set);
  `migrations` → `ui_migrate` did not run to head (`compose logs ui_migrate`, re-run it);
  `pipeline_api` → the API's own `/readyz` is failing or `PIPELINE_API_URL` is wrong.
- **Sign-in loops or "not authenticated" right after login.** The browser did not keep
  the cookie: over plain `http://` on an address other than `localhost`/`127.0.0.1`,
  use the local default `UI_SECURE_COOKIES=false` at `http://localhost:8080`.
- **`403 csrf_failed` from a script.** Send `X-Requested-With: scout` and the
  `csrf_token` from `GET /app/auth/me` on every `POST/PUT/PATCH/DELETE`.
- **`503 pipeline_api_unavailable` / `504 pipeline_api_timeout`.** The BFF could not
  reach `PIPELINE_API_URL` (connect timeout 5 s, up to 3 attempts on GET) or the API
  did not answer within 30 s. Check `docker compose ps api` and the API's `/readyz`.
- **Contract or API-key readiness errors.** Open Settings › System or
  `GET /app/capabilities`. Contract version 1, required response fields, filters and
  role-specific key reads must pass. Upgrade the backend and UI together or correct
  the BFF keys. The BFF re-probes periodically; the browser refreshes the capability
  map every 30 seconds and invalidates affected queries when it changes.
- **Logs.** `docker compose … logs -f ui` — one JSON line per request and per proxied
  call (`user_id, role, method, path, status, duration_ms`; never a key).

## Repository layout

```
multi-agent-articles-ui/
├── AGENTS.md = CLAUDE.md          rules for coding agents (ownership, commands, guardrails)
├── README.md · HOWTO.md           this page · operator how-tos (Docker first)
├── pyproject.toml · uv.lock       BFF package `scout_bff` (hatchling, packages = ["bff/scout_bff"])
├── alembic.ini                    script_location = bff/scout_bff/migrations (version table in schema ui)
├── Dockerfile · .dockerignore     two-stage build: node:22-alpine → python:3.12-slim, UID 10001, :8080
├── compose.ui.yaml                local override: ui_migrate, ui; optional https profile
├── deploy/Caddyfile.ui            the UI site block (UI_DOMAIN → ui:8080); deploy/Caddyfile = both hosts
├── .env.ui.example                notice pointing to the shared backend template
├── .github/workflows/ci.yml       web · bff (Postgres 16) · e2e · image
├── docs/
│   ├── dev/engineering-contract.md   the binding contract (names, paths, commands, shapes)
│   ├── dev/decisions.md · runbook.md ADR-UI-001…013 · operations runbook
│   ├── plan/06-…, 07-…               design decisions and the approved plan
│   ├── design/mockup-spec.md         the approved mockup, transcribed
│   └── api/                          openapi-pipeline.json, pipeline-routes.txt, openapi-bff.json (generated)
├── web/                           the SPA (pnpm; src/app, routes, features/<area>, components, api, lib, mocks, styles; e2e/)
├── bff/scout_bff/                 the BFF (settings, app, db, migrations, auth, users, proxy, <aggregate>/…, static/ in Docker)
└── tests/                         BFF pytest suite (unit · integration · proxy; respx stub of the pipeline API)
```

## Documents

- [`docs/dev/engineering-contract.md`](docs/dev/engineering-contract.md) — binding contract for everyone working here.
- [`docs/plan/07-ui-service-plan.md`](docs/plan/07-ui-service-plan.md) — the approved plan; [`docs/plan/06-ui-service-design.md`](docs/plan/06-ui-service-design.md) — decisions and tokens.
- [`docs/design/mockup-spec.md`](docs/design/mockup-spec.md) — the approved mockup, screen by screen.
- [`docs/dev/decisions.md`](docs/dev/decisions.md) — ADR-UI-001…013; [`docs/dev/runbook.md`](docs/dev/runbook.md) — operations.
- [`HOWTO.md`](HOWTO.md) — operator tasks; [`AGENTS.md`](AGENTS.md) — rules for coding agents.
- Pipeline API: [`docs/api/pipeline-routes.txt`](docs/api/pipeline-routes.txt), [`docs/api/openapi-pipeline.json`](docs/api/openapi-pipeline.json).
