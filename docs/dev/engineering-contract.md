# Sympera Scout UI — engineering contract

**Purpose.** This file is the binding agreement between everyone (humans and coding agents) working on the `multi-agent-articles-ui` repository. It turns `docs/plan/07-ui-service-plan.md` (the approved plan) and `docs/design/mockup-spec.md` (the approved mockup, transcribed) into exact names, paths, commands and shapes so that work done in parallel fits together. When this file and the plan differ, this file wins; when this file is silent, the plan wins; when both are silent, the mockup spec wins.

Companion references: `docs/api/openapi-pipeline.json` (the pipeline API as implemented today on branch `feature/platform-and-api`, 34 routes), `docs/api/pipeline-routes.txt` (same, one line per route), `docs/plan/06-ui-service-design.md` (tokens and decisions).

---

## 1. What exists today in the pipeline API (and what does not)

The pipeline API (`multi-agent-article`, FastAPI, `X-API-Key`) implements exactly the routes in `docs/api/pipeline-routes.txt`. Facts the UI relies on:

- Every list returns `{items: Row[], next_cursor: string | null}`; `?limit=1..1000&after=<cursor>`; filters are exact-match query parameters; unknown filters → `422 unknown_filter`. Cursors are opaque and bound to the resource + filters.
- Errors are RFC 9457 `application/problem+json`: `{type: "urn:sympera:problem:<category>", title, status, detail, instance, error_category, errors?}`.
- `GET /v1/jobs/{id}` and `GET /v1/jobs/{id}/summary` set `ETag` + `Cache-Control: private, no-cache` and answer `304` to `If-None-Match`. `/summary` returns `202` + `LiveJobSummary` while the job is not finalised, `200` + `StoredJobSummary` afterwards.
- `POST /v1/jobs` → `202 {job_id, status: "queued", prompt_version, links}`; `client_reference` is an idempotency key (`409` on reuse). Body: `{kind: "url"|"seeds"|"location_industry", url?, seeds?: [{title, url}], location?, industry?, county, state, settings?: {...}, client_reference?}`. `county` + `state` are mandatory (state = 2-letter code or full name).
- `POST /v1/jobs/{id}/cancel` → `202 {job_id, status}`; `POST /v1/jobs/{id}/resume` body `{site_timeout?, reanalyze?, reenrich?, memory_mode?, refetch_dead_articles?}` → `202 {job_id, status, task_ids}`.
- `POST /v1/tasks/{id}/retry` → `202 {task_id, status: "queued", attempts: 0}` (only `dead` tasks; `409` otherwise).
- `GET /v1/jobs/{id}/export/{table}.csv` streams `text/csv` with `Content-Disposition: attachment` for tables `sources, site_ranking, chosen_seeds, sections, pages, links, articles, summaries, companies, signals, company_flags`.
- `POST /v1/exports` (`{scope: "job"|"dataset", job_id?, tables[], kind: "csv", filters?}`) → `202 {export_id, status, links}`; `GET /v1/exports/{id}` → row + `download_url` (`/v1/artifacts/export/<sha>`) or `download_expired: true`.
- `GET /v1/articles/{id}?include=text` streams the saved article text (`410` when expired). `GET /v1/artifacts/{kind}/{sha}` for `text | transcript | export`.
- `GET /v1/companies/{company_key}?state=` → company row + `flags` + paged `mentions`, `signals`, `articles` (`409 company_state_required` with `states[]` when the key spans states).
- `GET /v1/stats/daily` → rows `{day, jobs, site_runs, articles, companies, signals, input_tokens, output_tokens, cost_usd, known_cost_usd, unpriced_calls, unknown_usage_calls, cost_complete, failures: {category: n}}`.
- `GET /v1/workers` → rows from `platform.v_worker_status` (`instance_id, role, hostname, version, started_at, last_seen, current_tasks[], proxy_ok, proxy_checked_at, gone_at, …`).
- `POST /v1/api-keys` (`{name, role}`) → `201 {id, name, role, created_at, key}`; `DELETE /v1/api-keys/{name}` → `204`.
- `GET /readyz` → `{status: "ready"|"not_ready", checks: {database, artifact_store, migrations}}` (503 when not ready); `GET /openapi.json` is public.

**Row shapes** of the per-job lists come from `api/read_queries.py` in the backend (one `SELECT` per resource) joined over the tables in `/home/claude/reference/pipeline-sql/*.sql` (reference copy; not part of this repo). The hand-written TypeScript row types in `web/src/api/types/*.ts` are the UI's single source for these shapes; keep them faithful to the SQL. Key columns:

- `JobRecord`: `id, kind, input{url|seeds|location,industry}, county, state_code, settings{days,sites,site_timeout,max_runtime,memory_mode,reanalyze,…}, prompt_version, status, stop_reason, client_reference, created_by, created_at, started_at, deadline_at, finished_at, summary|null, sessions[]`; `JobDetail` adds `progress{seeds,sections,pages,links,articles,summaries,companies,signals,tasks_pending,tasks_running,tasks_dead}` and `costs[{stage,calls,input_tokens,output_tokens,total_tokens,cost_usd|null,known_cost_usd,unpriced_calls,unknown_usage_calls}]`.
- Job status enum: `queued, finding, exploring, discovering, analysing, finalizing, completed, partial, failed, cancelling, cancelled`. Site-run status: `queued, exploring, no_sections, discovering, finished, partial, failed, cancelled`. Task status: `queued, running, succeeded, failed (= retry pending), dead, cancelled`.
- `SiteRun`: `id, job_id, seed_url, domain, title, rank, status, stop_reason, started_at, finished_at, stats{sections,pages,links,articles,fetches,bytes,tokens,…}`.
- `Task`: `id, kind, payload, job_id, site_run_id, parent_task_id, dedupe_key, status, priority, run_after, attempts, max_attempts, lease_until, lease_token?, claimed_by, last_error, error_category, result, created_at, started_at, finished_at`.
- `Event`: `id, ts, job_id, site_run_id, task_id, service, event, stage, url, status, error_category, duration_ms, attrs{}`.
- Signal / company mention row (`/signals`, `/companies`): `id, summary_id, article_id, company_id, number_company, name_as_written, entity_type, role, quote_id, evidence, confidence_score, confidence_level, checks, signal, signal_title, materiality, connection, signal_quote_id, signal_evidence, url, title, date, source_domain, article_key, company_key, company, confidence, fetch_status, org_kind, org_kind_basis, hq_scope, entity_flag, hq_county, hq_state, scope_place, scope_basis, company_industry, company_sub_industry, industry_basis, revenue_bin, revenue_basis, revenue_confidence, enrichment_source`.
- `Flag` row (`/flags`): the `job_company_flags` columns + `company_name, company_key, articles`.
- `Summary` row: `analysis.summaries` columns (`id, article_id, prompt_version, main_idea, short_snippet, focus_topics, industry, sub_industry, article_signal, article_materiality, companies, company_mentions, sponsored, is_list_page, warnings, model, input_tokens, output_tokens, …`) + `url, title, date, source_domain, article_key`; `record` only with `?include=record`.
- `Article` row: `discovery.articles` columns (`id, canonical_url, domain, title, published_date, snapshot_id, text_sha, html_sha, first_seen, …`) + `site_run_id, article_key, link_key, origin, accepted_at`.
- `Section` row: `sections.site_sections` (`id, site_run_id, exploration_id, section_id, url, title, kept, reason, origin, recorded_at, …`).
- Finder `Source` row (`/jobs/{id}/sources`): `finder.sources` (`search_id, domain, name, url, verdict, reason, coverage, relevance, origin, …`) + `created_at`; `Ranking` row: `finder.rankings` (`search_id, url, name, tier, overall_rank, chosen, reason, pages_opened, coverage, relevance, finder_reason, …`).
- Finder memory row (`/finder/memory`): `finder.judged_domains` (`location_key, industry_key, domain, verdict, reason, tier, judged_at, job_id, …`).

**Not implemented yet (plan §8, B1–B4)** and therefore **optional capabilities** the UI must work without: `GET /v1/signals` (cross-job), `GET /v1/tasks` (global), `POST /v1/jobs/{id}/retry-dead`, `GET /v1/api-keys`, `GET /v1/sources/stats`, `GET /v1/stats/cost-estimate`, the `industry` / `client_reference_prefix` filters on `GET /v1/jobs`. The BFF probes `GET /openapi.json` of the pipeline API and publishes a capability map (§4.6); for every missing capability the BFF either provides a bounded fallback or the SPA shows a short "needs pipeline API update (B1…B4)" note. Never let a missing capability break a screen.

---

## 2. Repository layout (fixed)

```
AGENTS.md / CLAUDE.md          rules for coding agents (CLAUDE.md is a copy of AGENTS.md)
README.md                      what it is, architecture, run (Docker), develop, deploy, troubleshoot
HOWTO.md                       operator how-tos, task by task (Docker first), kept in sync with features
pyproject.toml · uv.lock       BFF package `scout_bff` (hatchling, packages = ["bff/scout_bff"]); uv-managed
alembic.ini                    script_location = bff/scout_bff/migrations
Dockerfile · .dockerignore     two-stage build (node:22-alpine → python:3.12-slim), UID 10001, port 8080
compose.ui.yaml                override for the pipeline Compose project: services ui_migrate, ui, caddy (volumes/env)
deploy/Caddyfile.ui            the UI site block
.env.ui.example                every UI_* / PIPELINE_* / SESSION_SECRET variable, documented
.github/workflows/ci.yml       lint + typecheck + unit (web) · ruff + pytest with Postgres service (bff) · build
.gitignore · .editorconfig · .prettierrc · .prettierignore
docs/plan/                     06, 07 (approved plan)      docs/design/mockup-spec.md     docs/api/*   docs/dev/*
web/                           the SPA (own package.json; pnpm; NOT a workspace)
bff/scout_bff/                 the BFF (FastAPI)
tests/                         BFF pytest suite
```

### 2.1 `web/`

```
web/
  package.json · pnpm-lock.yaml · vite.config.ts · tsconfig.json · tsconfig.app.json · tsconfig.node.json
  eslint.config.js · vitest.config.ts · vitest.setup.ts · playwright.config.ts · index.html
  public/                 sympera-logo.png, favicon.svg, mockServiceWorker.js (generated by msw init)
  e2e/                    Playwright specs (run against `vite preview` in mock mode)
  src/
    main.tsx              boots MSW when VITE_API_MOCK=1, then renders <App/>
    app/                  App.tsx (providers), router.ts, providers/{QueryProvider,ThemeProvider,SessionProvider}.tsx, AppShell.tsx, CommandPalette.tsx
    routes/               TanStack Router file routes (see §5.1); routeTree.gen.ts is generated (git-ignored)
    features/<area>/      jobs · scouts · sources · signals · overview · settings · auth — screen-level components, hooks, columns
    components/           shared, reusable building blocks (see §5.5); components/ui/ = shadcn-style primitives
    api/                  client.ts (fetchJson, ApiError), keys.ts, polling.ts, pipeline.ts, bff.ts, pagination.ts, types/*.ts, pipeline.gen.ts
    lib/                  format.ts, status.ts, csv.ts, url.ts, cn.ts, hooks/
    data/                 industries.json, signals.json (static catalogs copied from the backend)
    styles/globals.css    tokens (light + dark), base styles, density
    mocks/                browser.ts, server.ts, handlers/{index,auth,jobs,scouts,sources,signals,overview,settings}.ts, fixtures/*.ts, db.ts (in-memory state)
    test/                 render.tsx (renderWithProviders), utils
```

### 2.2 `bff/scout_bff/`

```
bff/scout_bff/
  __init__.py · __main__.py (uvicorn runner)
  settings.py            pydantic-settings, prefix-less names exactly as §3; `Settings()` reads .env.ui when present
  app.py                 create_app(): routers, static SPA, error handlers, security headers, lifespan (capability probe, retention task)
  db.py                  async engine (SQLAlchemy 2 Core + psycopg 3), `transaction()` helper
  migrations/            Alembic env.py + versions/0001_ui_schema.py (the whole §4.8 DDL) 
  bootstrap.py           `python -m scout_bff.bootstrap`: create schema/roles/grants (owner connection), alembic upgrade head, bootstrap admin
  errors.py              Problem (RFC 9457, same shape as the backend), handlers
  logging.py             structlog JSON/console, secret redaction, request logging middleware
  security.py            security headers middleware (CSP etc.)
  auth/                  passwords.py (argon2id), sessions.py (cookie + ui.sessions), csrf.py, deps.py (current_user, require_role), router.py (/app/auth/*), rate_limit.py
  users/                 router.py (/app/users*), repository.py
  proxy/                 allowlist.py, router.py (/v1/{path:path}), client.py (httpx AsyncClient pool)
  pipeline_client.py     typed httpx wrapper for BFF logic (get_job, list_jobs, list_job_signals, finder_memory, ranking, create_job, retry_task, readyz, openapi)
  capabilities.py        probe + cache of optional pipeline routes (§4.6)
  audit.py               ui.audit_log writer (middleware for unsafe /app and /v1 calls)
  retention.py           hourly purge (sessions, login_attempts, audit_log)
  scouts/ · batches/ · sources/ · views/ · prefs/ · attention/ · system/ · signals/ · estimate/ · jobs/
                         one package per aggregate: router.py (+ repository.py / service.py when needed)
  static/                built SPA (Docker only; git-ignored)
  version.py             __version__ = "0.1.0"
tests/
  conftest.py            app factory with a stub pipeline API (respx), a test database (UI_TEST_DATABASE_URL), helpers to sign in
  unit/ · integration/ · proxy/
```

---

## 3. Toolchain, versions, commands

**Node side (web/)** — pnpm 10, Node 22. Pinned majors (stable, widely known): `vite ^7.3`, `@vitejs/plugin-react ^5.2`, `react ^19.2`, `react-dom ^19.2`, `typescript ~5.9`, `@tanstack/react-router ^1.170` + `@tanstack/router-plugin ^1.168`, `@tanstack/react-query ^5.104`, `@tanstack/react-query-devtools`, `@tanstack/react-table ^8.21`, `tailwindcss ^4.3` + `@tailwindcss/vite ^4.3`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`, Radix primitives (`@radix-ui/react-dialog, -dropdown-menu, -popover, -select, -checkbox, -tabs, -tooltip, -switch, -label, -slot, -separator, -scroll-area, -radio-group, -toggle-group`), `lucide-react ^0.577`, `cmdk ^1.1`, `sonner ^2`, `react-hook-form ^7.89`, `@hookform/resolvers ^5`, `zod ^4`, `date-fns ^4`, `@fontsource-variable/plus-jakarta-sans`, `@fontsource-variable/jetbrains-mono`. Dev: `vitest ^3.2`, `@vitest/coverage-v8 ^3.2`, `jsdom ^27`, `@testing-library/react ^16`, `@testing-library/jest-dom ^6`, `@testing-library/user-event ^14`, `msw ^2.15`, `@playwright/test 1.56.0` (exact; matches the pre-installed browser), `@axe-core/playwright ^4.10`, `eslint ^9.39`, `typescript-eslint ^8`, `eslint-plugin-react-hooks ^7`, `eslint-plugin-jsx-a11y ^6`, `eslint-plugin-react-refresh`, `globals ^16`, `prettier ^3.6`, `openapi-typescript ^7`. **Do not add other dependencies without recording why in your report.** Never upgrade to the next major (TypeScript 7, Vite 8, Table 9, MSW 3, Vitest 5, ESLint 10 exist but are out of scope).

`web/package.json` scripts (names are fixed):

| Script | Does |
|---|---|
| `dev` | `vite` on :5173, proxies `/app`, `/v1`, `/healthz`, `/readyz` to `http://localhost:8080` (env `VITE_BFF_URL` overrides) |
| `dev:mock` | `VITE_API_MOCK=1 vite` — the SPA runs on MSW fixtures, no backend |
| `build` | `tsc -b && vite build` → `web/dist` |
| `preview` | `vite preview --port 4173` |
| `preview:mock` | `VITE_API_MOCK=1 vite build --mode mock && vite preview --port 4173` (what e2e uses) |
| `typecheck` | `tsc -b --noEmit` |
| `lint` | `eslint .` |
| `format` / `format:check` | prettier write / check |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `e2e` | `playwright test` (config starts `preview:mock` as webServer) |
| `gen:api` | `openapi-typescript ../docs/api/openapi-pipeline.json -o src/api/pipeline.gen.ts && openapi-typescript ../docs/api/openapi-bff.json -o src/api/bff.gen.ts` |
| `check` | `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` |

**Python side (root)** — Python 3.12, uv. Runtime deps: `fastapi>=0.115,<1`, `uvicorn[standard]>=0.34,<1`, `httpx>=0.28,<1`, `sqlalchemy[asyncio]>=2.0,<2.1`, `psycopg[binary,pool]>=3.2,<4`, `alembic>=1.15,<2`, `pydantic>=2.10,<3`, `pydantic-settings>=2.8,<3`, `structlog>=25,<27`, `argon2-cffi>=23,<26`, `itsdangerous>=2,<3`, `python-multipart>=0.0.20,<1` (CSV upload). Dev: `pytest>=8,<10`, `pytest-asyncio>=1,<2`, `respx>=0.22,<1`, `asgi-lifespan>=2,<3`, `ruff>=0.11,<1`, `import-linter>=2,<3`. `[tool.pytest.ini_options] asyncio_mode = "auto"`, `testpaths = ["tests"]`. ruff: `line-length = 88`, `select = ["E4","E7","E9","F","I"]`.

Commands (fixed, used by CI, README, HOWTO, AGENTS.md):

| Command | Does |
|---|---|
| `uv sync --frozen` | install the BFF (+ dev) |
| `uv run ruff check . && uv run ruff format --check .` | lint |
| `uv run pytest -q` | the suite; integration tests need `UI_TEST_DATABASE_URL` (skipped with a reason when unset) |
| `uv run python -m scout_bff.bootstrap` | create schema/roles, migrate, bootstrap admin (needs owner `UI_DATABASE_URL`) |
| `uv run uvicorn scout_bff.app:app --reload --port 8080` | run the BFF locally (serves `bff/scout_bff/static` if present) |
| `uv run python -m scout_bff.openapi > docs/api/openapi-bff.json` | export the BFF OpenAPI for `pnpm gen:api` |

Docker (Daniel's machine; registries are unreachable from the cloud sandbox): `docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml up -d --build` from the pipeline repo. Image name `scout-ui:${UI_IMAGE_TAG:-local}`.

---

## 4. BFF contract

### 4.1 Settings (environment variables; `.env.ui` is read when present; names are exact)

| Variable | Required | Meaning |
|---|---|---|
| `UI_DATABASE_URL` | yes | `postgresql+psycopg://app_ui:<pw>@postgres/article_pipeline` for `ui`; the **owner** URL for `ui_migrate`/bootstrap |
| `UI_DATABASE_PASSWORD` | bootstrap | password set on login role `app_ui` when bootstrap creates/alters it |
| `PIPELINE_API_URL` | yes | e.g. `http://api:8000` |
| `PIPELINE_OPERATOR_KEY` / `PIPELINE_READER_KEY` | yes | injected by role; registered as secrets for log redaction |
| `SESSION_SECRET` | yes (≥ 32 chars) | HMAC key for the signed cookie value (itsdangerous) |
| `UI_PUBLIC_URL` | no | default `http://localhost:8080`; used for absolute links in responses |
| `UI_SECURE_COOKIES` | no | default `true`; set `false` for plain-http local development |
| `UI_SESSION_IDLE_HOURS` / `UI_SESSION_ABSOLUTE_DAYS` | no | 12 / 7 |
| `UI_BOOTSTRAP_ADMIN_EMAIL` / `UI_BOOTSTRAP_ADMIN_PASSWORD` | no | first admin when `ui.users` is empty; `must_change_password = true` |
| `UI_AUDIT_RETENTION_DAYS` | no | 180 |
| `UI_CAPABILITY_REFRESH_SECONDS` | no | 300 |
| `LOG_LEVEL` / `LOG_FORMAT` | no | `INFO` / `json` (`console` for dev) |
| `UI_TEST_DATABASE_URL` | tests | owner URL of a scratch database for integration tests |

### 4.2 Auth, sessions, CSRF, roles

- Cookie `scout_session` = signed session id (itsdangerous `URLSafeTimedSerializer`); `HttpOnly; SameSite=Lax; Path=/; Secure` (unless `UI_SECURE_COOKIES=false`). Row in `ui.sessions` (idle expiry 12 h sliding, absolute 7 d). Sign-out deletes the row.
- Every unsafe request (`POST/PUT/PATCH/DELETE`) to `/app/*` or `/v1/*` must carry `X-Requested-With: scout` **and** `X-CSRF-Token` equal to the session's `csrf_token`; otherwise `403 csrf_failed`. `POST /app/auth/login` needs only `X-Requested-With: scout`.
- Roles: `admin` ⊃ `operator` ⊃ `viewer`. Role → pipeline key: admin/operator → operator key; viewer → reader key. Viewers may call every `GET /v1/*` in the allowlist plus per-job CSV exports; they may not call `POST /v1/exports` (dataset exports) nor any other mutation.
- Login rate limit: 10 failures per e-mail per 15 min and 60 per IP per hour (`ui.login_attempts`) → `429 too_many_attempts`. Messages never reveal whether the account exists (`401 invalid_credentials`).
- `must_change_password = true` → every `/app/*` call except `GET /app/auth/me`, `POST /app/auth/password`, `POST /app/auth/logout` answers `403 password_change_required`; the SPA routes to `/account/password`.
- Audit: every unsafe `/app` and proxied unsafe `/v1` call inserts `ui.audit_log(at, user_id, role, method, path, target jsonb, status, duration_ms)`.

### 4.3 `/app` endpoints (JSON; all under the session cookie; problem+json errors)

Common: ids are UUID strings; timestamps ISO-8601 UTC; lists are `{items, next_cursor}` unless stated; `ApiError` categories are snake_case.

| Method & path | Role | Request → Response |
|---|---|---|
| `POST /app/auth/login` | — | `{email, password}` → `200 Me` (sets cookie) |
| `POST /app/auth/logout` | any | → `204` |
| `GET /app/auth/me` | any | → `Me = {user: {id, email, name, role, must_change_password, created_at}, csrf_token, capabilities: {…§4.6}, api: {ready: bool, checked_at}, version: {bff, pipeline_api?}}`; `401 not_authenticated` when signed out |
| `POST /app/auth/password` | any | `{current_password, new_password}` → `204` (clears `must_change_password`) |
| `GET /app/users` · `POST /app/users` | admin | create `{email, name, role, password}` → `201 User` |
| `PATCH /app/users/{id}` | admin | `{name?, role?, disabled?}` → `User` (cannot disable/demote yourself) |
| `POST /app/users/{id}/password` | admin | `{new_password}` → `204` (sets `must_change_password = true`) |
| `GET /app/capabilities` | any | → `{capabilities, probed_at, pipeline_api_version?}` |
| `GET /app/scouts` | any | → `{items: ScoutWithRuns[]}` where `ScoutWithRuns = Scout & {runs_count, last_run: {batch_id, run_number, created_at, jobs: [{job_id, industry, status, signals}]} | null, signals_last_run: number|null}` |
| `POST /app/scouts` | operator | `ScoutInput = {name, kind: "location_industry"|"seeds"|"url", county, state_code, location?, url?, industries: string[], source_mode: "finder"|"seeds", settings: {days?, sites?, site_timeout?, max_runtime?, memory_mode?, reanalyze?}}` → `201 Scout` |
| `GET/PATCH/DELETE /app/scouts/{id}` | viewer GET / operator | PATCH takes a partial `ScoutInput`; DELETE archives (`archived_at`) → `204` |
| `POST /app/scouts/{id}/run` | operator | `{client_reference_suffix?}` → `201 Batch` (fan-out, §4.5) |
| `POST /app/batches` | operator | `BatchInput = {kind, county, state_code, location?, url?, seeds?: [{title,url}], industries: string[], settings, scout_id?, save_as_scout?: {name}}` → `201 Batch = {id, scout_id, scout_name, run_number, created_at, jobs: [{position, industry, job_id|null, client_reference, status|null, error|null}]}` |
| `GET /app/batches?job_ids=a,b,c` | any | → `{batches: {[job_id]: {batch_id, position, size, scout_id, scout_name, run_number}}}` |
| `GET /app/batches/{id}` | any | → `Batch` (job statuses refreshed from the API) |
| `GET /app/sources?county=&state=&industry=&origin=&status=active|removed|all&q=` | any | → `{items: Source[], stats: {active, promoted, removed, counties, median_precision|null}}`; `Source = {id, name, domain, url, county, state_code, industries[], origin: "manual"|"finder"|"csv", finder: {tier, verdict, reason, judged_at, rank, job_id}|null, status, created_at, removed_at, precision: {accepted, candidates, ratio, job_id, at}|null}` (precision needs capability `sources_stats`; else `null`) |
| `POST /app/sources` | operator | `{name, domain?, url, county, state_code, industries[]}` → `201 Source` (`409 source_exists` on `(domain, county, state_code)`) |
| `PATCH /app/sources/{id}` · `DELETE /app/sources/{id}` · `POST /app/sources/{id}/restore` | operator | DELETE = soft remove → `204`; restore → `Source` |
| `POST /app/sources/import` | operator | multipart `file` (CSV with header `name,url,county,state,industries`; `industries` = `;`-separated) → `{imported, skipped: [{row, reason}]}`; max 1 MB / 2,000 rows |
| `GET /app/sources/suggestions?county=&state=&industry=&limit=` | any | → `{items: Suggestion[]}`, `Suggestion = {domain, name?, url, tier?, verdict, reason, judged_at, rank?, job_id?, county, state_code, industry?, origin: "finder_memory"|"ranking"}` (finder memory kept verdicts + recent rankings, minus domains already listed) |
| `POST /app/sources/promote` | operator | `{suggestion: Suggestion, name?, industries?: string[]}` → `201 Source` with `origin = "finder"` and the `finder` facts |
| `POST /app/sources/dismiss` | operator | `{domain, county, state_code}` → `204` (stored in `ui.dismissed_suggestions`) |
| `GET /app/views?route=` · `POST /app/views` · `PATCH/DELETE /app/views/{id}` | any (own; `shared` views visible to all) | `View = {id, user_id, name, route, search: {…}, columns: string[]|null, shared, created_at}` |
| `GET /app/prefs` · `PUT /app/prefs` | any | `Prefs = {theme: "system"|"light"|"dark", density: "comfortable"|"compact", time_display: "utc"|"local", landing: "/"|"/jobs"|"/signals"}` (PUT takes a partial) |
| `GET /app/attention` | any | → `{items: AttentionItem[]}`, `AttentionItem = {kind: "dead_task"|"partial_job"|"failed_job"|"slow_worker"|"api_not_ready", severity: "fail"|"warn", title, detail, href, job_id?, task_id?, instance_id?}`; dead tasks come from `GET /v1/tasks?status=dead` when capable, else from the dead-task counts of the last 20 non-terminal/partial jobs |
| `GET /app/system` | any | → `{bff: {version, migrations_head, started_at}, pipeline: {url_host, ready, checks, version?, prompt_version?}, capabilities, model_prices: null}` (`prompt_version` = that of the most recent job) |
| `GET /app/signals?…` | any | cross-job signals (§4.4) |
| `GET /app/signals/export.csv?…` | any | the same filters, streamed CSV with the pipeline `signals.csv` columns + `job_id, county, state, job_industry` |
| `POST /app/jobs/{id}/retry-dead` | operator | → `{retried: n, task_ids: number[]}` (capability `retry_dead` → proxied; else loop over `GET /v1/jobs/{id}/tasks?status=dead` + `POST /v1/tasks/{id}/retry`) |
| `GET /app/estimate?kind=&sites=&industry=` | any | → `{median_cost_usd, p90_cost_usd, samples, basis: "api"|"recent_jobs"} | {samples: 0}` |
| `ANY /v1/{path}` | role-mapped | reverse proxy (§4.7) |
| `GET /healthz` · `GET /readyz` | none | `{status}` · `{status: "ready"|"not_ready", checks: {database, migrations, pipeline_api}}` (503 when not ready) |

### 4.4 Cross-job signals (`GET /app/signals`)

Query: `signal, materiality, company_key, hq_scope, org_kind, industry (company_industry), job_industry, state, county, revenue_bin, date_after, date_before (article date, YYYY-MM-DD), job_id, batch_id, q (free text over company/evidence/signal, applied in the BFF), limit (≤ 200), after`. Response `{items: SignalRow & {job_id, county, state_code, job_industry, job_created_at}, next_cursor, degraded: bool, scanned_jobs?: number, truncated?: bool}`.

- With capability `signals_global`: forward to `GET /v1/signals` (B1) and return its page.
- Without it (today): pick the most recent **20** jobs that match `state/county/job_industry/job_id/batch_id` (`GET /v1/jobs` pages, filter in the BFF), fetch each job's `/signals` with the pass-through filters (`signal, materiality, company_key, hq_scope, org_kind`), merge, filter the rest in the BFF, sort by article `date` desc then `id` desc, cache the merged list for 30 s per query, and page it with an opaque offset cursor. Set `degraded: true`, `scanned_jobs`. The SPA shows "Showing signals from the N most recent matching jobs — the cross-job read (B1) is not deployed yet".

### 4.5 Fan-out (Scout run / one-off batch)

Within one DB transaction create `ui.batches` (+ `run_number` = count of previous batches of the scout + 1), then for each industry `i` (or a single leg for `url`/`seeds` kinds) call `POST /v1/jobs` with `client_reference = "ui:<batch_id>:<slug(industry)>"` (`url`/`seeds`: `ui:<batch_id>:0`); kind `seeds` sends `seeds = [{title: source.name, url: source.url}]` built from active `ui.sources` matching `(county, state_code)` and, when the scout lists industries, any of them (empty industries = all). Record each leg in `ui.batch_jobs` (`job_id` null + `error` on `4xx`; a `409` with an existing job counts as success). Return `201` even when some legs failed (`jobs[].error` tells); return `502 pipeline_api_unavailable` only when no leg could be attempted. `settings` sent to the API = the scout/batch `settings` overrides only (the API applies its defaults).

### 4.6 Capabilities

`capabilities.py` fetches `${PIPELINE_API_URL}/openapi.json` at startup and every `UI_CAPABILITY_REFRESH_SECONDS` (and on demand from `/readyz`), and derives:

```
signals_global      GET  /v1/signals
tasks_global        GET  /v1/tasks
retry_dead          POST /v1/jobs/{job_id}/retry-dead
api_keys_list       GET  /v1/api-keys
sources_stats       GET  /v1/sources/stats
cost_estimate       GET  /v1/stats/cost-estimate
jobs_industry_filter   GET /v1/jobs has query parameter `industry`
jobs_reference_filter  GET /v1/jobs has query parameter `client_reference_prefix`
```
Unknown (probe failed) → all `false` + `probe_error`. The map is part of `GET /app/auth/me` so the SPA has it before rendering.

### 4.7 `/v1` reverse proxy

- Allowlist (method, path regex) — everything in `docs/api/pipeline-routes.txt` except: `POST /v1/api-keys`, `DELETE /v1/api-keys/*` → **admin** only; `POST /v1/exports` → operator; every other `POST` → operator; every `GET` → any role. Not matched → `404 not_proxied`.
- Forward: method, path, query string, body, `Accept`, `Content-Type`, `If-None-Match`, `Accept-Encoding: identity`; strip any incoming `X-API-Key`/cookies; inject `X-API-Key` by role. Pass back: status, body (streamed), `Content-Type`, `ETag`, `Cache-Control`, `Content-Disposition`, `Content-Length` when known.
- Timeouts: connect 5 s; read 30 s for JSON; none for `text/csv` and `/articles/{id}?include=text` / `/artifacts/*` (streams). Retries: up to 3 on connection errors for `GET` only. Pipeline unreachable → `503 pipeline_api_unavailable` (problem+json).
- One structured log line per proxied call: `user_id, role, method, path, status, duration_ms` (never the key, never the query values of `X-API-Key`).

### 4.8 `ui` schema (Alembic revision `0001_ui_schema`)

Exactly the DDL in plan §9 plus: `ui.dismissed_suggestions (domain text, county text, state_code char(2), dismissed_by uuid, dismissed_at timestamptz, PRIMARY KEY (domain, county, state_code))`, `ui.users.last_login_at timestamptz`, and `ui.sessions.ip text`. `email` is `citext` (`CREATE EXTENSION IF NOT EXISTS citext` — needs the owner; bootstrap runs it). Roles/grants are created by `bootstrap.py`, not by Alembic: role `svc_ui` (NOLOGIN) owns schema `ui` with `ALL` on all tables/sequences (+ default privileges); login role `app_ui` (password `UI_DATABASE_PASSWORD`) is granted `svc_ui`; nothing outside `ui`. Alembic's version table lives in schema `ui` (`version_table_schema="ui"`). Bootstrap is idempotent and safe to re-run.

### 4.9 Static SPA serving and headers

`create_app()` mounts `bff/scout_bff/static` when it exists: `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`; every other non-API path (not `/app`, `/v1`, `/healthz`, `/readyz`, `/docs`, `/openapi.json`) returns `index.html` with `Cache-Control: no-cache`. Security headers on every response: `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`.

### 4.10 Testing (BFF)

- Unit (no DB): password hashing round-trip, CSRF enforcement, role → key mapping, allowlist matching, cursor encode/decode, fan-out leg naming, CSV import parsing, capability derivation from an OpenAPI document, signals merge/sort/page.
- Integration (`UI_TEST_DATABASE_URL`): bootstrap from empty + re-run; Alembic `upgrade head` then `downgrade base`; login/logout/session expiry; users CRUD and self-protection; scouts CRUD + run fan-out against a `respx` stub of the pipeline API (202/409/422 legs); sources CRUD/import/promote/suggestions; views; prefs; audit rows written; proxy passes status/headers/body and streams CSV; `/readyz`.
- The stub pipeline API is a `respx` router seeded from a small fixture module (`tests/pipeline_stub.py`) serving `/openapi.json`, `/readyz`, `/v1/jobs…`, `/v1/workers`, `/v1/jobs/{id}/signals` with a few rows shaped like §1.

---

## 5. Web contract

### 5.1 Routes (file-based, TanStack Router)

```
src/routes/__root.tsx                 providers context, <Outlet/>, NotFound, error boundary
src/routes/sign-in.tsx                /sign-in (?redirect=)
src/routes/_app.tsx                   pathless layout: SessionGate (redirect to /sign-in; to /account/password when must_change_password) + AppShell
src/routes/_app/index.tsx             /            Overview
src/routes/_app/jobs/index.tsx        /jobs        Runs   (search: status, state, county, industry, created, q, density, cols, after)
src/routes/_app/jobs/scouts.tsx       /jobs/scouts Scouts (search: state, industry, q)
src/routes/_app/jobs/new.tsx          /jobs/new    New run / Scout (search: scout?, mode?, scoutMode? ("save"))
src/routes/_app/jobs/$jobId.tsx       layout: breadcrumbs + JobHeader + (summary strip on non-overview tabs) + tabs
src/routes/_app/jobs/$jobId/index.tsx            Overview tab
src/routes/_app/jobs/$jobId/{signals,companies,summaries,articles,site-runs,sections,tasks,events}.tsx
src/routes/_app/signals.tsx           /signals     (search: view?, signal? (open drawer by mention id), + all filters of §4.4, density, cols)
src/routes/_app/sources.tsx           /sources     (search: state, county, industry, origin, status, q)
src/routes/_app/settings.tsx          layout with tabs; index redirects to /settings/workers
src/routes/_app/settings/{keys,workers,stats,exports,system,preferences,users}.tsx
src/routes/_app/account/password.tsx  /account/password
```
Search params are validated with zod schemas (`validateSearch`); filters, density, column visibility, pagination cursor and the open drawer live in the URL. Links use `<Link to="/jobs/$jobId" params={{jobId}}/>` — never string concatenation.

### 5.2 Data layer

- `api/client.ts`: `fetchJson<T>(input, init?)` — same-origin, `credentials: "include"`, adds `X-Requested-With: scout` always and `X-CSRF-Token` (from the session store) on unsafe methods, parses problem+json into `ApiError {status, category, detail, title, errors?}`; `401 not_authenticated` triggers the session store's `signedOut()`; `403 password_change_required` navigates to `/account/password`. `fetchPage<T>(url, {limit, after})` → `{items: T[], next_cursor}`.
- `api/keys.ts`: query-key factories mirroring paths: `qk.v1.jobs.list(filters)`, `qk.v1.jobs.detail(id)`, `qk.v1.jobs.sub(id, "signals", filters)`, `qk.v1.workers()`, `qk.v1.statsDaily()`, `qk.app.me()`, `qk.app.scouts()`, `qk.app.sources(filters)`, `qk.app.views(route)`, `qk.app.prefs()`, `qk.app.attention()`, `qk.app.signals(filters)`, `qk.app.batches(ids)`.
- `api/polling.ts`: `POLL = {live: 5_000, calm: 30_000, static: false}`; helper `pollingOptions(kind, enabled = true)` → `{refetchInterval, refetchIntervalInBackground: false, staleTime}`. A job in a terminal status (`completed, partial, failed, cancelled`) stops polling its detail queries (`enabled`/`refetchInterval: false`).
- `api/pipeline.ts` and `api/bff.ts`: one typed function per endpoint (`listJobs(filters, page)`, `getJob(id)`, `getJobSummary(id)`, `listJobSignals(id, filters, page)`, …, `createBatch(input)`, `runScout(id)`, …). Mutations live next to them as `useMutation` hooks in `features/*`.
- `api/pagination.ts`: `useKeysetPage(key, fetcher)` keeps a cursor stack in the URL (`after`) so "Previous" works; the footer shows "Showing a–b" and "of N" only when a total is known.
- `api/types/*.ts`: `jobs.ts, siteRuns.ts, tasks.ts, events.ts, signals.ts, companies.ts, summaries.ts, articles.ts, sections.ts, finder.ts, workers.ts, stats.ts, bff.ts` (the §4.3 shapes).
- Toasts (sonner) for mutation results; inline `ErrorState` for query errors; `Skeleton` rows while loading; `EmptyState` with a next action.

### 5.3 Session, theme, density, time

- `SessionProvider` loads `GET /app/auth/me` once; exposes `{user, role, csrfToken, capabilities, api, can(action)}` where `can("operate")` = admin|operator, `can("admin")` = admin.
- `ThemeProvider`: `data-theme` on `<html>` (`light|dark`, `system` follows `prefers-color-scheme`); density `data-density="compact"` on `<html>`; both come from `/app/prefs` after sign-in and from `localStorage` before.
- Time display: `RelativeTime`/`formatDateTime` honour `time_display` (`utc` default: "Oct 2, 09:30 UTC" with the local time in a tooltip; `local` the other way round). Durations "29 min", "1 h 12 min", "38 s". Numbers: `26.3K`, `1.6M`; bytes `21.4 MB`; money `$3.12`.

### 5.4 Tokens (`styles/globals.css`)

Light (from the mockup): `--page #F6F5FC --surface #FFFFFF --surface-2 #FAF9FE --border #E7E4F3 --border-strong #D9D5EA --ink #1C1A33 --ink-2 #4B4A63 --muted #6E6A8A --faint #9C9BB3 --brand-50 #F5F1FF --brand-100 #EEE8FF --brand-200 #DCD2FF --brand-300 #C5A9FF --brand-400 #A98BF5 --brand-500 #8B6CE8 --brand-600 #6E51D6 --brand-700 #5A3FBE --ring #B2B2FE --status-running-fg #1D4ED8 --status-running-bg #DBEAFE --status-done-fg #15803D --status-done-bg #DCFCE7 --status-warn-fg #92400E --status-warn-bg #FEF3C7 --status-fail-fg #B91C1C --status-fail-bg #FEE2E2 --status-neutral-fg #4B4A63 --status-neutral-bg #ECEBF3 --chart-line-muted #B8B4CF --overlay rgba(28,26,51,.22) --shadow-card 0 1px 2px rgba(28,26,51,.04)`. Dark values per plan §6.3 (`--page #141320 --surface #1C1B2A --surface-2 #232235 --border #2E2D44 --border-strong #3A3956 --ink #F3F1FA --ink-2 #C9C6DA --muted #9A96B3 --faint #6F6C8A --brand-300 #B9A1F5 --brand-600 #B2B2FE --brand-700 #C5B5FF`, status pairs re-stepped: running `#93C5FD/#1E2A4A`, done `#86EFAC/#14301F`, warn `#FCD34D/#3A2A0E`, fail `#FCA5A5/#3F1414`, neutral `#C9C6DA/#2A2940`). Exposed to Tailwind via `@theme inline` (`--color-page`, `--color-surface`, `--color-brand-300`, … → `bg-page`, `text-muted`, `bg-brand-100`). Fonts: `--font-sans: "Plus Jakarta Sans Variable"`, `--font-mono: "JetBrains Mono Variable"` (fontsource, self-hosted). Radii: `--radius-card 12px --radius-control 8px --radius-pill 999px`. Density: `html[data-density="compact"]` sets `--row-h: 36px; --row-h-2: 56px; --cell-py: 6px` (defaults 48/72/10).

### 5.5 Shared components (`src/components`, built once in the foundation, reused everywhere)

`AppShell`, `Sidebar`, `PageHeader {crumbs?, title, status?, subtitle?, meta?, actions?}`, `Tabs` (router-aware), `StatusPill {status, entity: "job"|"siteRun"|"task"|"worker"|"source"|"health", size?, secondary?}`, `MaterialityPill`, `Tag {tone, mono?}`, `StageBar {status, stopReason?, width?}`, `Stepper`, `JobSummaryStrip`, `LiveDot`, `StatTile`, `Sparkline`, `Meter`, `HorizontalBars`, `SplitBar`, `CounterStrip`, `DataTable` (TanStack Table: sticky header, column visibility + chooser popover, density, optional sort, row link, loading/empty/error, `minWidth`, right-aligned numeric cells, pagination footer `{showing, hasNext, hasPrev, onNext, onPrev}`), `FilterBar`, `SearchInput`, `FilterSelect`, `FilterChips`, `SavedViewsMenu`, `Drawer` (Radix Dialog, right side, URL-bound), `NoteBanner`, `AttentionItem`, `KeyValueGrid`, `EvidenceQuote`, `CopyButton`, `RelativeTime`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `Skeleton`, `CommandPalette` (⌘K: navigate to pages, jump to a job by id, jump to company), `Button` (variants primary/secondary/danger/tonal/ghost/link; sizes md/sm/xs/icon), `components/ui/*` shadcn-style primitives (dialog, dropdown-menu, popover, select, checkbox, switch, tabs, tooltip, input, label, textarea, separator, scroll-area, radio-group, toggle-group, command, sonner).

Status maps (`lib/status.ts`): job `queued→neutral "Queued"`, `finding/exploring/discovering/analysing/finalizing → running` with the stage word capitalised, `completed→done "Completed"`, `partial→warn`, `failed→fail` (triangle icon), `cancelling→neutral "Cancelling"`, `cancelled→neutral`; site-run `finished→done "Finished"`, `no_sections→neutral`, `partial→warn`, `failed→fail`, `discovering/exploring→running`, `queued/cancelled→neutral`; task `succeeded→done`, `running→running`, `failed→warn "Retry in …"` (from `run_after`) , `dead→fail`, `queued/cancelled→neutral`, result.rejected → neutral "Rejected"; worker: `last_seen` ≤ 30 s → done "Healthy", ≤ 90 s → warn "Slow heartbeat", else fail "Missing"; source `active→done`, `removed→neutral`.

### 5.6 Mocks and fixtures

- `VITE_API_MOCK=1` starts the MSW worker before rendering; handlers cover **every** `/app` and `/v1` endpoint the SPA calls, including sign-in (`admin@sympera.ai` / `scout-admin` as operator-equivalent admin; `viewer@sympera.ai` / `scout-viewer`), problem+json errors, `304` on matching `If-None-Match`, keyset pagination, mutations that mutate the in-memory `mocks/db.ts` (cancel → `cancelling`, retry → `queued`, create batch → new jobs, promote → new source…).
- Fixtures reproduce the mockup's sample data (`docs/design/mockup-spec.md` §4): job `0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41` "Orange County, FL · Construction" (analysing, batch 1 of 3, Scout "Orange County builders" run 7) with its 5 site runs, 12 tasks (tree), 24 signals (13 named + generated), 139 companies, cost by stage; the other 8 jobs; 5 scouts; 7 sources + 4 suggestions; 8 workers; daily stats for 14 days. Keep ids stable so tests and e2e can reference them.
- Vitest uses `mocks/server.ts` (msw/node) with the same handlers; `test/render.tsx` wraps with Query + Router (memory history) + Session + Theme providers.

### 5.7 Quality bar (every PR / every agent hand-back)

`pnpm check` green (typecheck strict, ESLint incl. jsx-a11y, Prettier, Vitest), `pnpm build` green, `pnpm e2e` green when touching routes; `uv run ruff check . && uv run ruff format --check . && uv run pytest -q` green. Accessibility: real buttons/links/inputs with labels, `aria-label` on icon buttons, status never colour-only, focus rings visible, keyboard paths for drawer/menus/⌘K, contrast ≥ 4.5:1 in both themes. Files ≤ 400 lines (split otherwise). No `any` (use `unknown` + narrowing). No console noise.

---

## 6. Working agreements for parallel agents

- **Ownership.** Foundation agents own `web/` (A1), `bff/` + `tests/` + `pyproject.toml` + `alembic.ini` (A2), root ops/docs files (A3). Feature agents own `web/src/features/<area>/`, `web/src/routes/_app/<area>…`, `web/src/mocks/handlers/<area>.ts`, `web/src/mocks/fixtures/<area>.ts`, `bff/scout_bff/<aggregate>/`, `tests/**/test_<area>_*.py`, and the HOWTO/README sections for their area. Shared files (`components/`, `api/`, `lib/`, `app/`, `app.py`, `settings.py`, `migrations/`) may receive **additive** changes only (new exports, new optional props); never rename or change existing behaviour — report the need instead.
- **No new dependencies** beyond §3 without a one-line justification in the hand-back report.
- **Generated files** (`routeTree.gen.ts`, `pipeline.gen.ts`, `bff.gen.ts`, `mockServiceWorker.js`, `uv.lock`, `pnpm-lock.yaml`) are regenerated, never hand-edited; `routeTree.gen.ts` is git-ignored.
- **Docs are part of the feature.** Each feature agent appends its HOWTO section(s) and updates the README feature table.
- **Hand-back report** (≤ 40 lines): what was built (paths), commands run and their results, deviations from this contract, open issues.
