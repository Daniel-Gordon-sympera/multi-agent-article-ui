# 07 — UI service "Sympera Scout" — implementation plan (v0.1 draft)

**Status:** Draft for Daniel's review, 2026-10-04. Mockup v1 approved (canvas page "Mockup v1"); stack approved (§4). · **Deciders:** Daniel Gordon
**Depends on:** `06-ui-service-design.md` (screens, decisions, tokens), `01-platform-and-api.md` (the REST contract this UI consumes), `00-system-overview.md` (ADR-019: API first, dashboard later on the same read models — this is that dashboard).
**Repositories:** new `multi-agent-articles-ui` (`/Users/symperaai/multi-agent-articles-ui`, empty today) for the UI service; four small PRs in `multi-agent-article` for the reads the UI needs (§8).

---

## 1. Context and decisions

The pipeline platform (branch `feature/platform-and-api`) already exposes everything an operator needs through `GET/POST /v1/*` with `X-API-Key` auth, keyset pagination (`{items, next_cursor}`), RFC 9457 problem responses and streaming CSV exports. Operators today use `curl`, `psql` and `python -m cli.main`. The UI replaces that with a light operator console that is pleasant enough to use all day.

| Topic | Decision (from the guided questions on 2026-10-04) |
|---|---|
| Audience | Operators first, kept easy and light |
| Job model | A job is one API run; a **Scout** is a saved setup owned by the UI; running a Scout creates one job per industry (a **batch**) |
| Creation form | One form, mode tabs (Location + industries / Site URL / Seeds), county + state mandatory, `(location, [ind1…indN])` fans out to N jobs |
| Data Sources | UI-owned curated seed list; finder discoveries can be promoted into it with their observed precision |
| Job detail | Results tabs first (Signals, Companies, Summaries, Articles), operations after (Site runs, Sections, Tasks, Events); CSV from an Export menu |
| Signals | Cross-job explorer with filters, saved views, column chooser, CSV export, detail drawer; HQ city, HQ state, industry and date columns |
| Settings | Operations-grade: API keys, workers & health, stats & costs, exports, system, preferences |
| Live data | Polling with TanStack Query (5 s on live screens, 30 s elsewhere, paused when hidden, ETag-aware) |
| App shape | **React SPA (Vite) + FastAPI BFF** |
| UI kit | **shadcn/ui on Tailwind v4 + Radix**, Lucide icons, TanStack Table |
| UI storage | **Own `ui` schema in the existing PostgreSQL**, own login role and Alembic history |
| Sign-in | **UI accounts + server-held API keys**: local accounts, server sessions, the BFF proxies `/v1` with the operator or reader key |
| Missing reads | **Extend the pipeline API** (`GET /v1/signals`, `GET /v1/sources/stats`, `GET /v1/stats/cost-estimate`, `POST /v1/jobs/{id}/retry-dead`, batch filter) |
| Deployment | **Own repo and image, same Compose project and Caddy** via `compose.ui.yaml`; the browser talks only to the BFF, so no CORS |
| Quality bar | **Full**: TypeScript strict, ESLint + Prettier, Vitest + Testing Library + MSW, Playwright e2e, pytest + ruff, GitHub Actions |
| Style | Refined sketch: lavender #C5A9FF / #B2B2FE brand with dark ink, Plus Jakarta Sans + JetBrains Mono, comfortable rows with a compact toggle, light first with dark-ready tokens |

## 2. Goals and non-goals

Goals: launch and watch runs without a terminal; make every job inspectable (stages, site runs, tasks, costs) and every result reachable (signals with evidence, companies with flags, articles with saved text); keep the pipeline API as the single source of truth; add nothing to the browser that must be kept secret; ship a first usable version in about four weeks of focused work (§13).

Non-goals (v1): a customer-facing product UI; multi-tenancy; OIDC/SSO (local accounts are designed so OIDC can replace the password step later); scheduling Scouts (a "Schedule" column is shown as *Manual*; a scheduler is a later addition on the maintenance role); editing pipeline settings or prompts; charts beyond stat tiles, sparklines and single-hue bars; mobile layouts beyond "still usable" (the shell stacks at phone width, tables scroll).

## 3. Architecture

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
                             │        scouts · batches ·      │        │ + new reads (§8)         │
                             │        sources · saved_views · │        └──────────────────────────┘
                             │        preferences · audit_log │
                             └────────────────────────────────┘
 The UI never reads the pipeline schemas directly; everything about jobs and results comes through /v1.
```

Rules: the browser calls exactly one origin (the BFF); the BFF holds the pipeline keys; `ui.*` is the only schema the UI writes (role `svc_ui`, login `app_ui`); the UI stores references to pipeline rows (job ids, article ids, company keys, domains) but never copies result data, except the finder facts a promoted source keeps (domain, tier, verdict reason, judged date).

## 4. Technology stack

| Concern | Choice | Why |
|---|---|---|
| Front end | Vite 7, React 19, TypeScript (strict), pnpm | fast builds, no SSR needed for an internal tool, agents are fluent in it |
| Routing / data | TanStack Router (typed, file-based), TanStack Query v5 (polling, ETag/304, cache), TanStack Table v8 | URL-driven filters, column chooser, density, sticky header; all typed end to end |
| UI kit | shadcn/ui (copied components) on Tailwind CSS v4, Radix primitives, Lucide icons, `cmdk` for ⌘K, Sonner for toasts | themeable with CSS variables, accessible dialogs/menus/popovers, matches the mockup |
| Forms | react-hook-form + zod (schemas shared between form and BFF contract types) | the New run form has conditional fields and fan-out validation |
| Fonts | `@fontsource-variable/plus-jakarta-sans` and `@fontsource-variable/jetbrains-mono`, self-hosted | no third-party font requests from an internal tool |
| BFF | Python 3.12, FastAPI, uvicorn, httpx (async client with connection pool), SQLAlchemy 2 Core + psycopg 3, Alembic, pydantic-settings, structlog, argon2-cffi, itsdangerous | the backend's conventions, verbatim |
| Database | existing PostgreSQL 16, schema `ui`, login role `app_ui` granted `svc_ui` | shared backups and ops; strict isolation by grants |
| Build / run | one Docker image: `node:22-alpine` stage builds `web/dist`, `python:3.12-slim` stage runs the BFF and serves the build | one artifact, one `IMAGE_TAG` |
| Tests | Vitest + Testing Library + MSW 2 (components), Playwright (e2e), pytest + testcontainers (BFF), ruff, ESLint + Prettier, `tsc --noEmit` | mirrors the backend's "offline validation" CI |

## 5. Repository layout (`multi-agent-articles-ui`)

```
AGENTS.md / CLAUDE.md          rules for coding agents (same shape as the backend's)
README.md                      run, develop, deploy
pyproject.toml · uv.lock       BFF package `scout_bff`
package.json · pnpm-lock.yaml  workspace root (web)
Dockerfile                     two-stage build
compose.ui.yaml                override: services ui, ui_migrate (joins project article-pipeline)
deploy/Caddyfile.ui            the UI site block (UI_DOMAIN → ui:8080)
.env.ui.example                UI variables (§11)
.github/workflows/ci.yml       lint + typecheck + unit + bff tests + e2e

web/                           the SPA
  src/
    app/                       router, providers (Query, theme, session), AppShell
    routes/                    file-based routes (§6.1)
    features/
      jobs/                    RunsTable, JobHeader, Stepper, SiteRunsTable, TasksTree, EventsList, NewRunForm, fan-out preview
      scouts/                  ScoutsTable, ScoutEditor, RunScoutDialog
      sources/                 SourcesTable, ImportCsvDialog, Suggestions
      signals/                 SignalsExplorer, FilterBar, SavedViews, SignalDrawer
      overview/                StatTiles, ActiveRuns, NeedsAttention, Workers, RecentSignals
      settings/                ApiKeys, WorkersHealth, StatsCosts, Exports, System, Preferences
      auth/                    SignIn, SessionGate
    components/ui/             shadcn components (copied, themed)
    components/                StatusPill, StageBar, StatTile, Sparkline, Meter, DataTable (TanStack Table + toolbar), FilterChips, Drawer, PageHeader, EmptyState, ErrorState, Skeletons
    api/                       generated client types (from both OpenAPI documents), fetchers, query keys, polling policies
    lib/                       formatting (dates, money, numbers), status maps (job/site-run/task → pill), csv download helper
    styles/globals.css         tokens (light + dark), base styles
  mocks/                       MSW handlers + fixtures (shaped like the Orlando V4 run; used by Vitest, Storybook-free dev mode and e2e smoke)
  tests/                       Vitest specs beside components; Playwright under web/e2e

bff/scout_bff/
  settings.py                  pydantic-settings (UI_* variables)
  app.py                       create_app(): static files, routers, error handlers, security headers
  db.py · migrations/          engine, sessions, Alembic history for schema ui
  auth/                        passwords (argon2id), sessions (server-side), dependencies (current_user, operator_required), CSRF
  proxy/                       /v1 reverse proxy: allowlist, header injection by role, streaming passthrough for CSV, timeouts
  scouts/ sources/ views/ prefs/ users/ audit/    routers + repositories (one module per aggregate)
  pipeline_client.py           typed httpx wrapper around the pipeline API used by BFF logic (fan-out, suggestions, stats)
  logging.py                   structlog with the backend's field names; secret redaction
tests/                         pytest: unit (auth, csrf, fan-out), integration (Postgres via testcontainers), proxy (respx)
```

## 6. Front-end design

### 6.1 Routes (TanStack Router) → mockup screens

| Route | Screen (artboard) | Data (query keys) |
|---|---|---|
| `/sign-in` | Sign-in | `POST /app/auth/login` |
| `/` | Overview | `jobs?status=…` (active), `/app/attention` (dead tasks, partial jobs, slow workers — assembled by the BFF from `/v1/jobs`, `/v1/workers`), `/v1/workers`, `/v1/signals?limit=5`, `/v1/stats/daily` |
| `/jobs` (tab Runs) | Jobs › Runs | `/v1/jobs` with filters in the URL (`status, state, county, created_after/before` today; `industry` and `client_reference_prefix` after B3; the free-text box filters the loaded page client-side); batch chips from `/app/batches?job_ids=` |
| `/jobs/scouts` | Jobs › Scouts | `/app/scouts` (+ last run status joined by the BFF from `/v1/jobs?client_reference_prefix=`) |
| `/jobs/new` (`?scout=`) | New run / Scout | `/app/sources?county=&state=` (seed count), `/v1/stats/cost-estimate`, `POST /app/batches` (fan-out) or `POST /v1/jobs` (single) |
| `/jobs/$jobId` | Job › Overview | `/v1/jobs/{id}`, `/v1/jobs/{id}/summary` (202 live / 200 final), `/v1/jobs/{id}/site-runs`, costs from job details |
| `/jobs/$jobId/signals` · `/companies` · `/summaries` · `/articles` | results tabs | `/v1/jobs/{id}/signals` etc. with filters; Companies tab has a "one row per company" switch → `/v1/jobs/{id}/flags` |
| `/jobs/$jobId/site-runs` · `/sections` · `/tasks` · `/events` | operations tabs | `/v1/jobs/{id}/site-runs` (+ `/v1/jobs/{id}/sources`, `/ranking` inside Site runs), `/sections`, `/tasks` (tree built client-side from `parent_task_id`), `/events` |
| `/signals` (`?view=`) | Signals explorer (+ drawer at `?signal=`) | `/v1/signals` (new, §8), `/app/views`, `/v1/companies/{key}` for the drawer's "across jobs" |
| `/sources` | Data Sources | `/app/sources`, `/app/sources/suggestions`, `/v1/sources/stats` |
| `/settings/keys` · `/workers` · `/stats` · `/exports` · `/system` · `/preferences` | Settings | `/v1/api-keys` (operator only), `/v1/workers`, `/readyz` via BFF, `/v1/stats/daily`, `/v1/exports/*`, `/app/system` (prompt version, model prices read-only), `/app/prefs` |

Filters, sort, density, column visibility and the open drawer live in the URL search params (typed with the router's `validateSearch`), so every view is a shareable link and the back button works. Saved views store a search-param object.

### 6.2 Data layer and live updates

- One `fetchJson` wrapper: same-origin, `credentials: include`, `X-Requested-With: scout` on every request, problem+json → typed `ApiError` (category, detail) → toast or inline error.
- Query keys mirror the API path and filters: `['v1', 'jobs', filters]`, `['v1', 'jobs', id]`, `['app', 'scouts']`.
- Polling policy (per key): `live` = 5 s for the jobs list, job header/summary, site runs, tasks, workers; `calm` = 30 s for results tables, overview tiles, sources; `static` = no polling for settings and saved views. `refetchIntervalInBackground: false`; `staleTime` = the interval; ETag → `If-None-Match` so unchanged resources return 304 (the API already sets `ETag` on job resources).
- A job in a terminal status stops polling its detail queries; a `Live` dot in the header shows polling is active and the age of the last successful fetch.
- Mutations (create, cancel, resume, retry, scout run) invalidate the affected keys and optimistically update the status pill where the API's response is certain (`202 {status}`).
- Lists use keyset pagination exactly as the API does: "Next" sends `after=next_cursor`; tables show "Showing 1–N" and "Load more" rather than numbered pages.

### 6.3 Design tokens (CSS variables; `styles/globals.css`)

Light values from `06` §3; dark values defined under `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, selected per token (not an automatic inversion): page `#141320`, surface `#1C1B2A`, surface-2 `#232235`, border `#2E2D44`, ink `#F3F1FA`, ink-2 `#C9C6DA`, muted `#9A96B3`; brand steps re-picked for contrast (`--brand-fill: #B9A1F5` with dark ink; `--brand-text: #B2B2FE`); status pairs re-stepped for the dark surface. Tailwind v4 reads the variables through `@theme inline`, so classes such as `bg-surface`, `text-muted`, `bg-brand-300` exist in both themes. Density is a `data-density="compact"` attribute on the table root that switches row height and cell padding tokens.

### 6.4 Component inventory (built once, reused everywhere)

`AppShell` (sidebar, ⌘K palette, session footer) · `PageHeader` (crumbs, title, status, meta, actions) · `StatusPill` (job / site-run / task / worker maps) · `StageBar` and `Stepper` · `StatTile` + `Sparkline` + `Meter` · `DataTable` (TanStack Table: sticky header, column chooser, density, sort, row link, empty/loading/error states, CSV button) · `FilterBar` + `FilterChips` + `SavedViewsMenu` · `Drawer` (Radix Dialog, right side, URL-bound) · `NewRunForm` (mode tabs, industries multi-select from the NAICS catalog, fan-out preview, advanced settings, save-as-Scout) · `TasksTree` · `EventsList` · `ConfirmDialog` for destructive actions (cancel run, remove source, revoke key) · `CopyButton`, `RelativeTime` (UTC with local tooltip).

Accessibility rules carried from the mockup: real buttons/links/inputs with labels; icon-only buttons get `aria-label`; status is never color alone (icon or text); contrast ≥ 4.5:1 for text in both themes; keyboard paths for the drawer, menus and ⌘K; focus rings use `--ring`.

## 7. BFF design

### 7.1 Endpoints (`/app/*`, JSON, session cookie)

| Method & path | Role | Purpose |
|---|---|---|
| `POST /app/auth/login` · `POST /app/auth/logout` · `GET /app/auth/me` | — / any | argon2id verification, server session create/destroy, current user + role + CSRF token |
| `GET/POST /app/users` · `PATCH /app/users/{id}` · `POST /app/users/{id}/password` | admin | manage UI accounts (roles `admin`, `operator`, `viewer`); admin can reset passwords |
| `GET/POST /app/scouts` · `GET/PATCH/DELETE /app/scouts/{id}` | operator (viewer: GET) | saved setups: name, kind, county, state, location phrase, industries[], source mode (`finder` \| `seeds`), settings overrides |
| `POST /app/scouts/{id}/run` | operator | creates a batch: one `POST /v1/jobs` per industry with `client_reference = ui:{batch_id}:{industry_slug}`; stores `batch_jobs`; returns the batch with job ids. Idempotent per batch id |
| `POST /app/batches` | operator | the same fan-out for a one-off run from the form (no Scout) |
| `GET /app/batches?job_ids=` · `GET /app/batches/{id}` | any | batch membership for chips and "1 of 3" labels |
| `GET/POST /app/sources` · `PATCH/DELETE /app/sources/{id}` · `POST /app/sources/import` (CSV) · `POST /app/sources/{id}/restore` | operator (viewer: GET) | the curated seed list; delete = soft remove (status `removed`) |
| `GET /app/sources/suggestions?county=&state=` | any | finder-kept domains not in the list: BFF reads `/v1/finder/memory?location=&verdict=keep` and recent `/v1/jobs/{id}/ranking` and merges |
| `POST /app/sources/promote` | operator | copies a suggestion into `sources` with tier, reason, judged date |
| `GET/POST /app/views` · `PATCH/DELETE /app/views/{id}` | any (own) | saved views: route + search params + optional column set; `shared` flag |
| `GET/PUT /app/prefs` | any (own) | theme, density, time zone, default landing page |
| `GET /app/attention` | any | overview "needs attention": dead tasks (`GET /v1/tasks?status=dead`, B3), partial jobs (`/v1/jobs?status=partial`), workers with stale heartbeats (`/v1/workers`) |
| `GET /app/system` | any | prompt version, API version, model prices (read-only, from the API) |
| `ANY /v1/{path}` | role-mapped | reverse proxy (§7.3) |
| `GET /healthz` · `GET /readyz` | none | process up · DB reachable, Alembic head current, pipeline API `/readyz` reachable |

Errors reuse the backend's problem+json shape (`type: urn:sympera:problem:<category>`), so the SPA has one error model.

### 7.2 Sessions, CSRF, roles

- Cookie `scout_session`: random 32-byte id, `HttpOnly; Secure; SameSite=Lax; Path=/`; the id maps to `ui.sessions` (user, created, last_seen, expires, user agent); idle expiry 12 h, absolute 7 days; sliding renewal on activity.
- CSRF: every unsafe request must carry `X-Requested-With: scout` (a custom header cannot be sent cross-site without CORS), and the session's CSRF token in `X-CSRF-Token` for defence in depth; the SPA reads the token from `GET /app/auth/me`.
- Login rate limit: 10 failures per account per 15 min and 60 per IP per hour, counted in `ui.login_attempts`; constant-time comparison; no account enumeration in messages.
- Roles: `admin` (users + everything), `operator` (mutations: runs, scouts, sources, retries, exports, API keys), `viewer` (read-only). Role → pipeline key: `admin`/`operator` → `PIPELINE_OPERATOR_KEY`; `viewer` → `PIPELINE_READER_KEY`.
- Bootstrap: `UI_BOOTSTRAP_ADMIN_EMAIL` / `UI_BOOTSTRAP_ADMIN_PASSWORD` create the first admin when `ui.users` is empty (same pattern as `API_BOOTSTRAP_KEY`); the password must be changed on first sign-in.
- Audit: every mutation through `/app` and every proxied unsafe `/v1` call writes `ui.audit_log` (user, method, path, target ids, outcome, latency).

### 7.3 `/v1` reverse proxy

- Allowlist by method and path pattern (everything in `01` §8 the UI uses); `POST /v1/api-keys` and `DELETE /v1/api-keys/*` only for `admin`; `/v1/urls`, `/v1/finder/memory` read-only pass-through.
- Strips any incoming `X-API-Key`, injects the role's key, forwards `If-None-Match`, `Accept`, query string and JSON body; passes through status codes, `ETag`, `Content-Type`, `Content-Disposition` and streams bodies (CSV exports and saved article text are streamed, never buffered).
- Timeouts: 30 s for JSON, none for streams (bounded by the API); 3 retries only for idempotent GETs on connection errors; `503 pipeline_api_unavailable` otherwise.
- Structured log per proxied call with `user_id`, `role`, `method`, `path`, `status`, `duration_ms`; the key is registered as a secret so it can never appear in logs.

## 8. Backend additions (`multi-agent-article`, four small PRs)

| PR | Change | Notes |
|---|---|---|
| B1 | `GET /v1/signals` — cross-job list | the `signals` read query without the `ja.job_id` constraint, plus columns `j.id AS job_id, j.county, j.state_code AS job_state, (j.input->>'industry') AS job_industry, j.created_at AS job_created_at, f.scope_place AS hq_city, f.hq_state, f.company_industry, f.company_sub_industry`; filters `signal, materiality, company_key, hq_scope, org_kind, industry (company), job_industry, state, county, revenue_bin, created_after/before (article date), job_id, batch` (via `client_reference LIKE 'ui:{batch}:%'`); cursor `lpad(m.id)` as today; indexed by `company_mentions(id)` and `jobs(created_at)`; CSV parity untouched. Also adds `scope_place` to the per-job `signals` and `companies` read models (it is already in `job_company_flags`) |
| B2 | `GET /v1/sources/stats?domain=&since=` and `GET /v1/stats/cost-estimate?kind=&sites=&days=&industry=` | per-domain `accepted_articles` (count of `job_articles` by `a.domain`) ÷ `candidates` (sum of `site_runs.stats->>'links'` or the candidate count the engine reports) over the window, with the last job id and date; cost estimate = median `v_job_costs` total of the last 10 completed jobs with the same `kind`/`sites` (and industry when present), plus p90 |
| B3 | `POST /v1/jobs/{id}/retry-dead`; `GET /v1/jobs` gains `industry` (`j.input->>'industry'`) and `client_reference_prefix` filters; new global `GET /v1/tasks?status=&kind=&created_after=` | bulk retry = the existing `retry_dead` per task in one transaction, returns the count; the prefix filter makes batches queryable (`LIKE :prefix || '%'`, the UNIQUE index on `client_reference` serves it); the global task list (backed by `v_dead_tasks` for `status=dead`) feeds the Overview's "needs attention" without iterating jobs |
| B4 | `GET /v1/api-keys` (names, roles, created, revoked; never hashes) | needed by Settings › API keys (`created_by` is already on every job row) |

All four are additive, keep the existing tests green and ship behind the usual feature-branch → CI → squash-merge flow. The UI's generated client types come from the API's `/openapi.json` plus the BFF's own OpenAPI document (`pnpm gen:api` runs `openapi-typescript` for both).

## 9. `ui` schema (DDL sketch)

```sql
CREATE SCHEMA ui;
CREATE TABLE ui.users (
  id uuid PRIMARY KEY, email citext UNIQUE NOT NULL, name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','operator','viewer')),
  password_hash text NOT NULL, must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), disabled_at timestamptz);
CREATE TABLE ui.sessions (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES ui.users(id), csrf_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, user_agent text);
CREATE INDEX ON ui.sessions (user_id); CREATE INDEX ON ui.sessions (expires_at);
CREATE TABLE ui.login_attempts (key text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON ui.login_attempts (key, at);
CREATE TABLE ui.scouts (
  id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK (kind IN ('location_industry','seeds','url')),
  county text NOT NULL, state_code char(2) NOT NULL, location text, url text,
  industries text[] NOT NULL DEFAULT '{}', source_mode text NOT NULL CHECK (source_mode IN ('finder','seeds')),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,            -- overrides only (days, sites, site_timeout, max_runtime, memory_mode, reanalyze)
  created_by uuid REFERENCES ui.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
  UNIQUE (name));
CREATE TABLE ui.batches (
  id uuid PRIMARY KEY, scout_id uuid REFERENCES ui.scouts(id), run_number int,
  requested jsonb NOT NULL,                                -- the form payload that produced the jobs
  created_by uuid REFERENCES ui.users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ui.batch_jobs (
  batch_id uuid NOT NULL REFERENCES ui.batches(id), position int NOT NULL, industry text,
  job_id uuid, client_reference text NOT NULL UNIQUE, error jsonb,   -- job_id null when the API rejected that leg
  PRIMARY KEY (batch_id, position));
CREATE INDEX ON ui.batch_jobs (job_id);
CREATE TABLE ui.sources (
  id uuid PRIMARY KEY, name text NOT NULL, domain text NOT NULL, url text NOT NULL,
  county text NOT NULL, state_code char(2) NOT NULL, industries text[] NOT NULL DEFAULT '{}',
  origin text NOT NULL CHECK (origin IN ('manual','finder','csv')),
  finder jsonb,                                            -- {tier, verdict, reason, judged_at, rank, job_id} when promoted
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  created_by uuid REFERENCES ui.users(id), created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz, UNIQUE (domain, county, state_code));
CREATE TABLE ui.saved_views (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES ui.users(id), name text NOT NULL,
  route text NOT NULL, search jsonb NOT NULL, columns text[], shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, route, name));
CREATE TABLE ui.preferences (user_id uuid PRIMARY KEY REFERENCES ui.users(id), prefs jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE ui.audit_log (
  id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), user_id uuid, role text,
  method text NOT NULL, path text NOT NULL, target jsonb, status int, duration_ms int);
CREATE INDEX ON ui.audit_log (at); CREATE INDEX ON ui.audit_log (user_id, at);
-- roles: svc_ui owns schema ui (all privileges on ui.*, nothing elsewhere); app_ui LOGIN granted svc_ui;
-- the ui_migrate one-shot connects as the database owner (POSTGRES_PASSWORD) to create schema, roles and run Alembic.
```

Retention: `sessions` purged when expired (hourly task in the BFF), `login_attempts` 24 h, `audit_log` 180 days (monthly delete). Everything else is kept.

## 10. Security checklist

Same-origin only (no CORS) · secrets only in the BFF environment (`PIPELINE_*_KEY`, `SESSION_SECRET`, `UI_DATABASE_PASSWORD`), registered for log redaction · `HttpOnly/Secure/SameSite=Lax` cookie, CSRF header + token, login rate limits, argon2id · security headers from the BFF (`Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` (Tailwind needs none at runtime; shadcn inline styles are rare — tighten after audit), `X-Content-Type-Options`, `Referrer-Policy: same-origin`, `Permissions-Policy`) · proxy allowlist (viewers cannot reach mutations even by crafting requests) · uploads (CSV import) parsed server-side with size and row limits · dependency audit in CI (`pnpm audit`, `pip-audit`) · the API keeps its own TLS host for `curl`/CLI use; the UI never exposes `/v1` to anonymous requests.

## 11. Deployment

`Dockerfile`:
```
FROM node:22-alpine AS web
WORKDIR /src/web  COPY web/package.json web/pnpm-lock.yaml ./  RUN corepack enable && pnpm install --frozen-lockfile
COPY web .  RUN pnpm build                                   # → /src/web/dist
FROM python:3.12-slim AS runtime
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app  COPY pyproject.toml uv.lock ./  RUN uv sync --frozen --no-dev
COPY bff ./bff  COPY --from=web /src/web/dist ./bff/scout_bff/static
USER 10001  EXPOSE 8080  CMD ["/app/.venv/bin/uvicorn", "scout_bff.app:app", "--host", "0.0.0.0", "--port", "8080"]
```

`compose.ui.yaml` (used as `docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml up -d`, or copied next to the pipeline's compose file):
```yaml
services:
  ui_migrate:
    image: scout-ui:${UI_IMAGE_TAG:-local}
    build: ../multi-agent-articles-ui
    entrypoint: ["/app/.venv/bin/python", "-m", "scout_bff.bootstrap"]      # create schema/roles, alembic upgrade head, bootstrap admin
    environment:
      UI_DATABASE_URL: postgresql+psycopg://article_owner:${POSTGRES_PASSWORD}@postgres/article_pipeline
      UI_DATABASE_PASSWORD: ${UI_DATABASE_PASSWORD:?Set UI_DATABASE_PASSWORD}
      UI_BOOTSTRAP_ADMIN_EMAIL: ${UI_BOOTSTRAP_ADMIN_EMAIL:-}
      UI_BOOTSTRAP_ADMIN_PASSWORD: ${UI_BOOTSTRAP_ADMIN_PASSWORD:-}
    depends_on: {postgres: {condition: service_healthy}}
  ui:
    image: scout-ui:${UI_IMAGE_TAG:-local}
    build: ../multi-agent-articles-ui
    restart: unless-stopped
    environment:
      UI_DATABASE_URL: postgresql+psycopg://app_ui:${UI_DATABASE_PASSWORD}@postgres/article_pipeline
      PIPELINE_API_URL: http://api:8000
      PIPELINE_OPERATOR_KEY: ${PIPELINE_OPERATOR_KEY:?Set PIPELINE_OPERATOR_KEY}
      PIPELINE_READER_KEY: ${PIPELINE_READER_KEY:?Set PIPELINE_READER_KEY}
      SESSION_SECRET: ${SESSION_SECRET:?Set SESSION_SECRET}
      UI_PUBLIC_URL: https://${UI_DOMAIN:-scout.localhost}
      LOG_FORMAT: json
    ports: ["127.0.0.1:${UI_PORT:-8080}:8080"]
    depends_on: {ui_migrate: {condition: service_completed_successfully}, api: {condition: service_healthy}}
    healthcheck: {test: ["CMD", "/app/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/readyz')"], interval: 10s, timeout: 5s, retries: 3}
  caddy:
    environment: {UI_DOMAIN: ${UI_DOMAIN:-scout.localhost}}
    volumes: ["../multi-agent-articles-ui/deploy/Caddyfile.ui:/etc/caddy/Caddyfile.ui:ro"]
```
`deploy/Caddyfile.ui` adds a second site: `{$UI_DOMAIN} { encode zstd gzip  reverse_proxy ui:8080 }`, imported from the pipeline Caddyfile (`import /etc/caddy/Caddyfile.ui`). The API's own site block stays as it is. Keys: create two keys through the API once (`POST /v1/api-keys` with roles operator and reader) and put them in `.env`; rotate by creating new ones and restarting `ui`.

Local development: `pnpm dev` (Vite on :5173 proxying `/app` and `/v1` to :8080) + `uv run uvicorn scout_bff.app:app --reload --port 8080` against a local Postgres and the local pipeline API (`python -m cli.run api`) — or `pnpm dev:mock`, which serves the SPA against MSW fixtures with no backend at all (used for UI work, Storybook-free visual checks and the e2e smoke suite).

## 12. Testing

| Layer | What | How |
|---|---|---|
| Components | StatusPill maps, StageBar/Stepper states, DataTable (sorting, column chooser, density, empty/error), NewRunForm (fan-out preview, validation: county + state required, at least one industry, URL scheme), FilterChips/SavedViews, SignalDrawer | Vitest + Testing Library + MSW fixtures |
| Routes | each route renders with fixtures; URL ↔ filter round-trips; polling stops on terminal jobs | Vitest with the router's test harness and fake timers |
| BFF unit | argon2 round-trip, session expiry/renewal, CSRF enforcement, role → key mapping, proxy allowlist, fan-out idempotency (same batch id twice creates no duplicates), CSV import parsing | pytest |
| BFF integration | Alembic from empty and from head; repositories against Postgres; `/app/scouts/{id}/run` against a stub pipeline API (`respx`) that returns 202/409/422 legs | pytest + testcontainers |
| e2e | sign in → create a 3-industry run → see 3 runs with batch chips → open a job → retry a dead task → filter signals → save a view → promote a suggested source → export CSV | Playwright against the BFF + seeded `ui` schema + a recorded pipeline API stub (`prism`/`respx`-style mock of `/openapi.json`); one real-API smoke job in a nightly workflow against the dev VM (opt-in) |
| Static | `tsc --noEmit`, ESLint (typescript, react-hooks, jsx-a11y), Prettier, ruff, `uv run lint-imports` (bff modules never import from the pipeline repo) | CI |
| Accessibility | axe checks in Playwright on every route; keyboard walkthrough of the drawer and menus | CI (axe) + manual once per phase |

## 13. Delivery plan (one developer plus coding agents; about four weeks)

| Phase | Days | Work | Gate |
|---|---|---|---|
| U0 — scaffold | 2–3 | repo, pnpm + uv, Vite/React/TS, Tailwind v4 + shadcn init with the tokens, router skeleton with all routes and placeholder pages, AppShell + sidebar + sign-in page, MSW fixtures from the mockup data, CI (lint, typecheck, unit), Dockerfile + `compose.ui.yaml` + Caddyfile.ui, `AGENTS.md` | `docker compose … up` serves the shell behind Caddy; CI green on an empty PR |
| U1 — BFF core | 3 | settings, db, Alembic `ui` schema + roles + bootstrap admin, auth/sessions/CSRF, users, `/v1` proxy with allowlist and streaming, health, structlog, pytest suite | sign-in works against the real API; `curl` through the proxy returns the API's responses with no key in the browser |
| U2 — jobs | 5 | Runs list (filters, polling, actions), New run form with fan-out through `/app/batches`, Job detail header + stepper + Overview (site runs, cost by stage, settings), results tabs (signals, companies/flags, summaries, articles), operations tabs (site runs + sources/ranking, sections, tasks tree with retry and retry-all-dead, events), Export CSV menu | a real Orlando job can be created, watched to completion and its CSVs downloaded from the UI; **needs B3, B4** |
| U3 — Scouts and Data Sources | 4 | Scouts CRUD + Run (batch) + run history, Data Sources CRUD, CSV import, suggestions + promote, seeds jobs from sources, precision column | a Scout with 3 industries creates 3 jobs; a promoted domain seeds a run; **needs B2** |
| U4 — Signals explorer | 4 | `/v1/signals` client, filter bar + chips, saved views, column chooser + density, detail drawer (evidence, article text via proxy, company profile across jobs), CSV export of the filtered set | the explorer answers the mockup's filters in < 1 s on the dev database; **needs B1** |
| U5 — Overview and Settings | 4 | Overview tiles + attention + workers + recent signals; Settings: API keys (admin), Workers & health, Stats & costs (daily table + sparklines), Exports center, System, Preferences (theme, density, time zone) | every mockup screen exists with live data |
| U6 — harden and release | 3 | Playwright e2e suite + axe, dark theme pass, empty/error/loading states audit, README + runbook (keys, users, backups of `ui`), version `0.1.0`, image tag, deploy to the VM | e2e green in CI; Daniel runs a day of real jobs through the UI only |

Backend PRs B1–B4 (≈ 1 day each) land during U1–U2 so they are ready when U3/U4 start. Order of value if time is short: U2 → U4 → U3 → U5.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Polling load on the API with several open tabs | 304s via ETag, background pause, per-key intervals; the BFF can add a 2 s micro-cache per path later; SSE is the documented upgrade |
| `/v1/signals` becomes slow as `company_mentions` grows | keyset cursor on `m.id`, filters on indexed columns, a composite index on `(signal, materiality)` if needed; the view is additive and can be materialised later |
| Fan-out partially fails (one leg 422/409) | each leg recorded in `batch_jobs` with its error; the UI shows "2 of 3 created" with a retry per leg; `client_reference` keeps retries idempotent |
| Two sources of truth for sources (UI list vs finder memory) | the UI list is explicit and operator-owned; suggestions are computed, never synced; promoted rows remember where they came from |
| Session cookie misuse | HttpOnly + SameSite + CSRF header/token + rate limits + audit; OIDC is a drop-in replacement for the password step |
| Design drift from the mockup | tokens and components are built first (U0) from `06` §3 and the artboards; the mockup canvas stays the reference |
| Node + Python toolchains in one repo | the Node stage is build-only; `pnpm`/`uv` lockfiles pinned; CI builds the image on every PR |

## 15. Decisions (ADR-UI-001 … 006)

- **ADR-UI-001 — SPA + Python BFF over a Node full-stack framework.** Same conventions as the backend; secrets stay server-side; SSR is unnecessary for an internal tool. Revisit if a public product UI needs SEO/SSR.
- **ADR-UI-002 — UI state in a `ui` schema of the pipeline database.** Shared backups and operations; strict role isolation; no cross-schema reads. Revisit if the UI must survive a pipeline database migration independently.
- **ADR-UI-003 — Local accounts with server sessions; pipeline keys never leave the BFF.** Per-user audit now; OIDC later without redesign.
- **ADR-UI-004 — Missing aggregates are added to the pipeline API, not computed in the BFF.** The API remains the single read contract (`00` ADR-019 intent); the UI never joins pipeline tables.
- **ADR-UI-005 — Polling with ETag first; SSE when a trigger fires** (many concurrent viewers, or sub-second needs).
- **ADR-UI-006 — Scouts, batches and Data Sources are UI concepts.** The pipeline keeps immutable jobs; `client_reference` is the only coupling. Revisit (move to the API) when a second client needs them.

## 16. Open questions for Daniel

1. Hostname for the UI (`scout.<domain>`?) and whether the API keeps its own host (recommended) or moves under the UI host.
2. Initial users: just you as admin, or a viewer account for colleagues from day one?
3. Time display: UTC with local tooltip (recommended for operators) or local time everywhere?
4. May viewers start exports and download CSVs? (Plan: yes for per-job CSV, no for dataset exports.)
5. Keep the audit log 180 days, or longer?
