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

Phases from `docs/plan/07-ui-service-plan.md` §13. The lead ticks a phase when its
gate is met.

- [ ] **U0 — scaffold.** Repo, pnpm + uv, Vite/React/TS, Tailwind v4 + tokens, router skeleton with every route, AppShell + sidebar + sign-in, MSW fixtures from the mockup, CI, Dockerfile + `compose.ui.yaml` + Caddyfile, `AGENTS.md`. Gate: `docker compose … up` serves the shell behind Caddy; CI green.
- [ ] **U1 — BFF core.** Settings, db, Alembic `ui` schema + roles + bootstrap admin, auth/sessions/CSRF, users, `/v1` proxy with allowlist and streaming, health, structlog, pytest suite. Gate: sign-in against the real API; `curl` through the proxy returns the API's responses with no key in the browser.
- [ ] **U2 — jobs.** Runs list, New run form with fan-out, job detail (header, stepper, overview, results tabs, operations tabs, retry / retry-all-dead), Export CSV menu. Gate: a real Orlando job created, watched and exported from the UI (needs B3, B4).
- [ ] **U3 — Scouts and Data Sources.** Scouts CRUD + Run + history; sources CRUD, CSV import, suggestions + promote, seeds jobs, precision column. Gate: a 3-industry Scout creates 3 jobs; a promoted domain seeds a run (needs B2).
- [ ] **U4 — Signals explorer.** Cross-job list, filter bar + chips, saved views, column chooser + density, detail drawer, filtered CSV export. Gate: the mockup's filters answer in < 1 s on the dev database (needs B1).
- [ ] **U5 — Overview and Settings.** Tiles, attention, workers, recent signals; API keys, Workers & health, Stats & costs, Exports, System, Preferences, Users. Gate: every mockup screen exists with live data.
- [ ] **U6 — harden and release.** Playwright + axe suite, dark theme pass, empty/error/loading audit, README + runbook, version 0.1.0, image tag, deploy to the VM. Gate: e2e green in CI; Daniel runs a day of real jobs through the UI only.

Backend PRs **B1–B4** (`GET /v1/signals`, `GET /v1/sources/stats` + `GET /v1/stats/cost-estimate`,
`POST /v1/jobs/{id}/retry-dead` + `GET /v1/tasks` + job filters, `GET /v1/api-keys`) land in the
pipeline repo; until then the console treats them as optional capabilities (see
[Troubleshooting](#troubleshooting)).

## Architecture

```
 browser (SPA) ──HTTPS──► Caddy ──► ui (FastAPI BFF, :8080)
   React 19 · TanStack Router/Query/Table        │  GET /            static SPA (built by Vite)
   shadcn/ui · Tailwind v4 · Lucide              │  /app/*           UI-owned API: auth, scouts, batches, sources, views, prefs
   polling 5 s / 30 s · ETag                     │  /v1/*            reverse proxy → api:8000, injects X-API-Key by role
                                                 │  /healthz /readyz
                                                 ▼
                             ┌────────────────────────────────┐        ┌──────────────────────────┐
                             │ PostgreSQL 16 (existing)       │        │ api (existing FastAPI)   │
                             │  ui.*  users · sessions ·      │◄─SQL───┤ platform.* finder.* …    │
                             │        scouts · batches ·      │        │ + new reads (B1–B4)      │
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

<!-- feature agents: set Status to "in progress" / "done" for your screens and add a one-line note (e.g. "degraded without B1") when you hand back. -->

| Screen | Route | Phase | Status |
|---|---|---|---|
| Sign-in | `/sign-in` | U0/U1 | planned |
| Change password (forced after bootstrap or admin reset) | `/account/password` | U1 | planned |
| Overview — tiles, active runs, needs attention, workers, recent signals | `/` | U5 | planned |
| Jobs › Runs — filters, polling, cancel / resume, batch chips | `/jobs` | U2 | done — progress columns from `GET /app/jobs/progress`; industry filter is client-side until B3 |
| Jobs › Scouts — saved setups, run, history | `/jobs/scouts` | U3 | planned |
| New run / Scout — mode tabs, fan-out preview, advanced settings, save as Scout | `/jobs/new` | U2 (form) · U3 (Scouts) | done — `?scout=` edits / runs a Scout, `?from=` re-runs a job, `?mode=seeds&source=` pre-ticks a seed; estimate degrades to the last 10 completed runs without B2 |
| Job › Overview — header, stepper, counters, site runs, cost by stage, settings | `/jobs/$jobId` | U2 | done — stage durations from the job's tasks and site runs; "—" where the API has no fact |
| Job › Signals · Companies (flags switch) · Summaries · Articles | `/jobs/$jobId/{signals,companies,summaries,articles}` | U2 | Companies, Summaries, Articles done (Signals: B3) — keyset paging, URL-bound filters, CSV per table |
| Job › Site runs (+ finder sources and ranking) · Sections · Tasks (tree, retry, retry all dead) · Events | `/jobs/$jobId/{site-runs,sections,tasks,events}` | U2 | done — retry-all-dead loops per task without B3; events are paged oldest first (API order) |
| Signals explorer — filters, chips, saved views, column chooser, drawer, CSV | `/signals` (`?signal=` opens the drawer) | U4 | planned |
| Data Sources — curated list, CSV import, finder suggestions, promote | `/sources` | U3 | planned |
| Settings › API keys (admin) · Workers & health · Stats & costs · Exports · System · Preferences · Users (admin) | `/settings/{keys,workers,stats,exports,system,preferences,users}` | U5 | planned |

## Quick start (Docker)

Scout runs inside the pipeline's Compose project (`article-pipeline`): same PostgreSQL,
same Caddy, one extra image. Everything below happens on the machine that runs the
pipeline (Daniel's Mac or the VM).

**Prerequisites.** The pipeline repo checked out and running (`docker compose up -d`
there; `curl --fail http://127.0.0.1:8000/readyz` answers), Docker with BuildKit, and
this repo checked out **as a sibling folder** named `multi-agent-articles-ui`
(`compose.ui.yaml` refers to `../multi-agent-articles-ui`).

1. **Create the two pipeline API keys** the BFF will use (once). With the pipeline's
   bootstrap key from its `.env`:

   ```bash
   curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
        -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
        -d '{"name": "scout-ui-operator", "role": "operator"}'
   curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
        -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
        -d '{"name": "scout-ui-reader", "role": "reader"}'
   ```

   Each `201` response contains the plaintext `key` exactly once.

2. **Add the UI variables to the pipeline's `.env`** — the variables are listed and
   explained in [`.env.ui.example`](.env.ui.example). Required:
   `UI_DATABASE_PASSWORD` (new random value), `PIPELINE_OPERATOR_KEY`,
   `PIPELINE_READER_KEY` (from step 1), `SESSION_SECRET` (`openssl rand -hex 32`),
   `UI_BOOTSTRAP_ADMIN_EMAIL` and `UI_BOOTSTRAP_ADMIN_PASSWORD` (your first admin).
   Optional: `UI_DOMAIN` (default `scout.localhost`), `UI_PORT` (default `8080`),
   `UI_IMAGE_TAG` (default `local`).

3. **Let Caddy serve the UI host** (one of two options; `http://127.0.0.1:${UI_PORT}`
   works without either):
   - **A (plan §11):** add the line `import /etc/caddy/Caddyfile.ui` to the pipeline
     repo's `deploy/Caddyfile`. `compose.ui.yaml` mounts the UI site block there. Caddy
     refuses to start if that file is missing, so from then on always start the
     project with both compose files (or write the line as
     `import /etc/caddy/Caddyfile.ui*`, which tolerates its absence).
   - **B (no change in the pipeline repo):** uncomment the
     `deploy/Caddyfile:/etc/caddy/Caddyfile:ro` line in `compose.ui.yaml`. This repo's
     [`deploy/Caddyfile`](deploy/Caddyfile) serves both hosts (the API block is the
     pipeline's own, verbatim) and overrides the pipeline's mount.

4. **Build and start**, from the pipeline repo:

   ```bash
   docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml config --quiet
   docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml up -d --build
   curl --fail http://127.0.0.1:8080/readyz
   docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml ps
   ```

   `ui_migrate` runs first (creates schema `ui`, roles `svc_ui`/`app_ui`, applies the
   Alembic history, creates the admin when `ui.users` is empty; idempotent), then `ui`
   starts once the pipeline API is healthy.

5. **Sign in** at `https://scout.localhost` (or your `UI_DOMAIN`; `*.localhost` names
   get a Caddy-internal certificate your browser may warn about) or directly at
   `http://127.0.0.1:8080`. Use the bootstrap admin; you are taken to
   `/account/password` to set a new password, then to the Overview. Create further
   accounts under Settings › Users (roles `admin`, `operator`, `viewer`) and remove
   `UI_BOOTSTRAP_ADMIN_PASSWORD` from `.env`.

Step-by-step operator tasks (keys, users, runs, retries, exports, upgrades, backups)
are in [HOWTO.md](HOWTO.md).

## Local development

Two toolchains: **pnpm 10 / Node 22** for `web/`, **uv / Python 3.12** for the BFF at
the root. Full command table: `docs/dev/engineering-contract.md` §3.

```bash
# SPA only, no backend — MSW fixtures shaped like the mockup
cd web && pnpm install --frozen-lockfile && pnpm dev:mock        # http://localhost:5173
# mock accounts: admin@sympera.ai / scout-admin · viewer@sympera.ai / scout-viewer

# SPA + local BFF + the pipeline's Postgres and API (from the pipeline repo: docker compose up -d postgres api …)
cp .env.ui.example .env.ui       # fill UI_DATABASE_URL (owner URL for bootstrap), PIPELINE_API_URL=http://127.0.0.1:8000,
                                 # the two keys, SESSION_SECRET, UI_SECURE_COOKIES=false, LOG_FORMAT=console
uv sync --frozen
uv run python -m scout_bff.bootstrap                               # schema, roles, migrations, first admin
uv run uvicorn scout_bff.app:app --reload --port 8080              # the BFF (serves bff/scout_bff/static if built)
cd web && pnpm dev                                                 # Vite proxies /app, /v1, /healthz, /readyz to :8080
```

After bootstrap, switch `UI_DATABASE_URL` in `.env.ui` to the `app_ui` login for the
running BFF (bootstrap needs the owner, the app does not). `pnpm build` writes
`web/dist`; copy or symlink it to `bff/scout_bff/static` to serve the SPA from the BFF
without Vite. `pnpm gen:api` regenerates the TypeScript API types from
`docs/api/openapi-pipeline.json` and `docs/api/openapi-bff.json`
(`uv run python -m scout_bff.openapi > docs/api/openapi-bff.json` first).

## Testing

| Where | Command | Notes |
|---|---|---|
| web | `pnpm check` | `tsc -b --noEmit`, ESLint (incl. jsx-a11y), Prettier check, Vitest |
| web | `pnpm build` | production build must pass |
| web | `pnpm e2e` | Playwright against `preview:mock` (:4173), axe on every route; run when touching routes |
| bff | `uv run ruff check . && uv run ruff format --check .` | lint + format |
| bff | `uv run lint-imports` | import boundaries (never from the pipeline repo) |
| bff | `uv run pytest -q` | unit tests always; integration tests need `UI_TEST_DATABASE_URL` (a disposable database), otherwise skipped with a reason |
| image | `docker build .` and `docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml config` | from the pipeline repo for the second one |

CI (`.github/workflows/ci.yml`) runs the same four groups on every pull request and on
`main`: `web`, `bff` (with a `postgres:16` service), `e2e` and `image` (build, no push).
Tests never touch the network: the pipeline API is a `respx` stub in pytest and MSW
fixtures in the browser.

## Configuration

All variables, with comments and defaults, are in [`.env.ui.example`](.env.ui.example)
(contract §4.1). In Docker they are read from the pipeline's `.env` through
`compose.ui.yaml`; locally the BFF reads `.env.ui` when present. Required at runtime:
`UI_DATABASE_URL`, `PIPELINE_API_URL`, `PIPELINE_OPERATOR_KEY`, `PIPELINE_READER_KEY`,
`SESSION_SECRET` (≥ 32 characters). Bootstrap additionally needs `UI_DATABASE_PASSWORD`
(password for `app_ui`) and, for the first admin, `UI_BOOTSTRAP_ADMIN_EMAIL` /
`UI_BOOTSTRAP_ADMIN_PASSWORD`. Compose-only: `UI_IMAGE_TAG`, `UI_PORT`, `UI_DOMAIN`.

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
- **Roles.** `admin ⊃ operator ⊃ viewer`. The `/v1` proxy is an allowlist of the 34
  pipeline routes: `POST/DELETE /v1/api-keys*` admin only; every other `POST` operator;
  every `GET` any role; anything else `404 not_proxied`. Viewers may download per-job
  CSVs but not start dataset exports.
- **Headers.** CSP `default-src 'self'` (fonts self-hosted, no third-party requests),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `Permissions-Policy`, `X-Frame-Options: DENY`.
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
  `docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml run --rm ui_migrate`.
- **Upgrade.** Pull the new UI commit, set `UI_IMAGE_TAG`, then
  `up -d --build` (or `build ui` then `up -d ui_migrate ui`). Caddy keeps serving while
  `ui` restarts; sessions survive because they live in `ui.sessions` (as long as
  `SESSION_SECRET` is unchanged).
- **Rotating keys.** Pipeline keys: create new ones through `POST /v1/api-keys`,
  replace the two values in `.env`, `up -d ui`, then `DELETE /v1/api-keys/<old-name>`.
  `SESSION_SECRET`: change and `up -d ui` — every user is signed out. Database
  password: change `UI_DATABASE_PASSWORD`, re-run `ui_migrate` (it alters the role),
  then `up -d ui`.
- **Backup.** The pipeline's daily database backup already contains schema `ui`. For a
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
  set `UI_SECURE_COOKIES=false` (development only) or use the Caddy HTTPS host.
- **`403 csrf_failed` from a script.** Send `X-Requested-With: scout` and the
  `csrf_token` from `GET /app/auth/me` on every `POST/PUT/PATCH/DELETE`.
- **`503 pipeline_api_unavailable`.** The BFF could not reach `PIPELINE_API_URL`
  (connect timeout 5 s, up to 3 retries on GET). Check `docker compose ps api` and the
  API's `/readyz`.
- **"Needs pipeline API update (B1…B4)" notes.** The BFF probes the pipeline's
  `/openapi.json` (every `UI_CAPABILITY_REFRESH_SECONDS`, default 300) and publishes a
  capability map (`GET /app/capabilities`). Until the backend PRs land: the Signals
  explorer shows signals from the 20 most recent matching jobs (`degraded: true`),
  "Retry all dead" loops over the job's dead tasks, needs-attention counts come from
  recent jobs, Settings › API keys can create and revoke but not list, source precision
  and cost estimates show as unavailable, and the Runs industry / batch filters apply
  client-side. Nothing breaks; the note disappears once the capability is detected.
- **Caddy fails to start after adding the import line.** The project was started
  without `compose.ui.yaml`, so `/etc/caddy/Caddyfile.ui` is not mounted — start with
  both files or use the glob form of the import (Quick start, step 3).
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
├── compose.ui.yaml                override for the pipeline project: ui_migrate, ui, caddy
├── deploy/Caddyfile.ui            the UI site block (UI_DOMAIN → ui:8080); deploy/Caddyfile = both hosts
├── .env.ui.example                every UI_* / PIPELINE_* / SESSION_SECRET variable, documented
├── .github/workflows/ci.yml       web · bff (Postgres 16) · e2e · image
├── docs/
│   ├── dev/engineering-contract.md   the binding contract (names, paths, commands, shapes)
│   ├── dev/decisions.md · runbook.md ADR-UI-001…008 · operations runbook
│   ├── plan/06-…, 07-…               design decisions and the approved plan
│   ├── design/mockup-spec.md         the approved mockup, transcribed
│   └── api/                          openapi-pipeline.json, pipeline-routes.txt, openapi-bff.json (generated)
├── web/                           the SPA (pnpm; src/app, routes, features/<area>, components, api, lib, mocks, styles)
├── bff/scout_bff/                 the BFF (settings, app, db, migrations, auth, users, proxy, <aggregate>/…, static/ in Docker)
└── tests/                         BFF pytest suite (unit · integration · proxy; respx stub of the pipeline API)
```

## Documents

- [`docs/dev/engineering-contract.md`](docs/dev/engineering-contract.md) — binding contract for everyone working here.
- [`docs/plan/07-ui-service-plan.md`](docs/plan/07-ui-service-plan.md) — the approved plan; [`docs/plan/06-ui-service-design.md`](docs/plan/06-ui-service-design.md) — decisions and tokens.
- [`docs/design/mockup-spec.md`](docs/design/mockup-spec.md) — the approved mockup, screen by screen.
- [`docs/dev/decisions.md`](docs/dev/decisions.md) — ADRs; [`docs/dev/runbook.md`](docs/dev/runbook.md) — operations.
- [`HOWTO.md`](HOWTO.md) — operator tasks; [`AGENTS.md`](AGENTS.md) — rules for coding agents.
- Pipeline API: [`docs/api/pipeline-routes.txt`](docs/api/pipeline-routes.txt), [`docs/api/openapi-pipeline.json`](docs/api/openapi-pipeline.json).
