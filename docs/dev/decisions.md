# Sympera Scout — architecture decision records

ADR-UI-001 … 006 are the decisions of the approved plan (`docs/plan/07-ui-service-plan.md`
§15), restated with their context and consequences; 007 and 008 were taken while turning
the plan into the engineering contract and the mockup spec. Add a new record (next number,
same three parts) whenever a durable choice is made; never rewrite history — supersede.

Status legend: **accepted** (in force) · **superseded by ADR-UI-nnn**.

---

## ADR-UI-001 — SPA + Python BFF over a Node full-stack framework

**Status:** accepted (2026-10-04).

**Context.** The console is an internal operator tool for a FastAPI/PostgreSQL pipeline
whose team and coding agents already follow Python conventions (uv, FastAPI, SQLAlchemy 2,
Alembic, structlog). It needs no SEO and no server rendering, but it does need a trusted
server component that holds the pipeline API keys and owns a few aggregates (Scouts,
batches, sources, saved views).

**Decision.** A React SPA built with Vite is served by a small Python FastAPI
backend-for-frontend (`bff/scout_bff`) that also proxies `/v1` to the pipeline API. One
Docker image contains both (plan §4, §11; contract §2).

**Consequences.** Secrets stay server-side; the Python side reuses the backend's
conventions verbatim (settings, logging, problem+json, Alembic); the Node toolchain is
build-only. Two toolchains live in one repo (pnpm + uv), so lockfiles are pinned and CI
builds the image on every PR. Revisit if a public product UI needs SSR/SEO.

## ADR-UI-002 — UI state in a `ui` schema of the pipeline database

**Status:** accepted (2026-10-04).

**Context.** The UI owns a modest amount of state (users, sessions, scouts, batches,
sources, saved views, preferences, audit log). The pipeline already runs PostgreSQL 16
with backups and operations; a second database would double the operational surface.

**Decision.** The UI stores its state in schema `ui` of the existing database, owned by a
dedicated role `svc_ui` with a login role `app_ui` granted only `svc_ui`, with its own
Alembic history (version table in schema `ui`). Bootstrap (`python -m scout_bff.bootstrap`)
runs once with the owner connection to create schema, roles and grants (plan §9; contract
§4.8).

**Consequences.** Shared backups and monitoring; strict isolation by grants (the UI can
neither read nor write pipeline schemas); the pipeline's daily dump already includes `ui`.
The UI depends on the pipeline database being up. Revisit if the UI must survive a
pipeline database migration independently.

## ADR-UI-003 — Local accounts with server sessions; pipeline keys never leave the BFF

**Status:** accepted (2026-10-04).

**Context.** The pipeline API authenticates with `X-API-Key` (roles operator and reader)
and has no notion of individual users. Operators need per-person accountability and
colleagues need read-only access; a browser must never hold an API key.

**Decision.** Local accounts (argon2id) with server-side sessions (`scout_session`
cookie, `HttpOnly; SameSite=Lax; Secure`, rows in `ui.sessions`), three roles
`admin ⊃ operator ⊃ viewer`, CSRF header + token, login rate limits and an audit log.
The BFF maps roles to the two pipeline keys (`admin`/`operator` → operator key, `viewer`
→ reader key) and injects them in its `/v1` reverse proxy (plan §7.2–7.3; contract
§4.2, §4.7).

**Consequences.** Per-user audit now; viewers cannot reach mutations even with crafted
requests (allowlist by method/path/role); key rotation is an environment change plus a
restart. Passwords must be managed (bootstrap admin, forced change, admin reset). OIDC
can replace the password step later without redesign.

## ADR-UI-004 — Missing aggregates are added to the pipeline API, not computed in the BFF

**Status:** accepted (2026-10-04).

**Context.** The mockup needs reads the API lacks: cross-job signals, source precision,
cost estimates, bulk retry, a global task list, a key listing, extra job filters. They
could be computed in the BFF by joining pipeline tables or by iterating `/v1` lists.

**Decision.** The API remains the single read contract (`00-system-overview` ADR-019):
the missing reads are backend PRs B1–B4 (plan §8). The UI never joins pipeline tables,
and the BFF does not become a second query layer.

**Consequences.** Four small, additive backend PRs; the SPA's generated types come from
the API's OpenAPI document; the UI can lag the API without breaking (see ADR-UI-007 for
the bounded interim behaviour).

## ADR-UI-005 — Polling with ETag first; SSE when a trigger fires

**Status:** accepted (2026-10-04).

**Context.** Operators want live progress (stage stepper, counters, site runs, tasks).
The API already sets `ETag` on job resources and answers `304` to `If-None-Match`; the
number of concurrent viewers is small.

**Decision.** TanStack Query polling with three policies — `live` 5 s (jobs list, job
header/summary, site runs, tasks, workers), `calm` 30 s (results tables, overview tiles,
sources), `static` none (settings, saved views) — `refetchIntervalInBackground: false`,
`staleTime` = interval, ETag → `If-None-Match`; a job in a terminal status stops polling
(plan §6.2; contract §5.2).

**Consequences.** No new server infrastructure; load is bounded by 304s and background
pause; a 2 s micro-cache per path in the BFF is the first escalation, SSE the documented
upgrade when a trigger fires (many concurrent viewers, or sub-second needs).

## ADR-UI-006 — Scouts, batches and Data Sources are UI concepts

**Status:** accepted (2026-10-04).

**Context.** Operators think in saved setups ("Orange County builders": a county, a
state, three industries, a source mode) and want one action to start several jobs and
track them together; they also keep a curated list of local news sites. The pipeline
models immutable jobs only.

**Decision.** A Scout, a batch and a Data Source live in schema `ui`. Running a Scout
(or a one-off multi-industry form) fans out to one `POST /v1/jobs` per industry with
`client_reference = ui:<batch_id>:<slug(industry)>` as the only coupling; `seeds` jobs
are built from active sources of the county/state. Finder discoveries can be promoted
into the source list with the facts the finder recorded (plan §1, §7.1; contract §4.5).

**Consequences.** The pipeline stays simple and immutable; `client_reference` keeps
retries idempotent and batches queryable (B3's prefix filter); the UI list of sources is
explicit and operator-owned, suggestions are computed and never synced. Revisit (move to
the API) when a second client needs Scouts or batches.

## ADR-UI-007 — Capability probing and bounded BFF fallbacks for B1–B4

**Status:** accepted (2026-10-04).

**Context.** ADR-UI-004 puts the missing reads in the pipeline API, but the backend PRs
B1–B4 land during U1–U2 while U3–U5 screens are built in parallel, and a deployed console
may run against an API that has not been updated yet. Every screen must keep working
either way, and nothing may silently return wrong data.

**Decision.** `capabilities.py` fetches `${PIPELINE_API_URL}/openapi.json` at startup,
every `UI_CAPABILITY_REFRESH_SECONDS` (300) and on demand from `/readyz`, and derives a
map: `signals_global` (`GET /v1/signals`), `tasks_global` (`GET /v1/tasks`),
`retry_dead` (`POST /v1/jobs/{id}/retry-dead`), `api_keys_list` (`GET /v1/api-keys`),
`sources_stats`, `cost_estimate`, `jobs_industry_filter`, `jobs_reference_filter`. A
failed probe yields all `false` plus `probe_error`. The map ships in `GET /app/auth/me`
and `GET /app/capabilities`. For each missing capability the BFF either provides a
**bounded** fallback or the SPA shows a short "needs pipeline API update (B…)" note
(contract §1, §4.3, §4.4, §4.6):

| Capability | Fallback while missing |
|---|---|
| `signals_global` | merge `/signals` of the 20 most recent matching jobs, sort by date/id, 30 s cache, offset cursor; response flags `degraded: true`, `scanned_jobs` |
| `retry_dead` | loop `GET /v1/jobs/{id}/tasks?status=dead` + `POST /v1/tasks/{id}/retry` |
| `tasks_global` | attention items from the dead-task counts of the last 20 non-terminal/partial jobs |
| `cost_estimate` | median/p90 of recent jobs' costs (`basis: "recent_jobs"`), or `{samples: 0}` |
| `sources_stats` | `precision: null` on every source |
| `api_keys_list` | Settings › API keys can create/revoke but shows the note instead of a list |
| `jobs_industry_filter`, `jobs_reference_filter` | filter the loaded page in the BFF/SPA; batch membership from `ui.batch_jobs` |

**Consequences.** Screens never break on an older API; fallbacks are explicitly bounded
(20 jobs, 30 s, labelled `degraded`) so they cannot become a hidden second query layer
(ADR-UI-004 holds); when a backend PR lands, the console upgrades itself on the next probe
without a redeploy. Cost: a probe at startup and every 5 minutes, a small amount of
fallback code to delete once B1–B4 are universally deployed.

## ADR-UI-008 — Materiality pill rendered as drawn (High = amber)

**Status:** accepted (2026-10-04). Open for Daniel's confirmation; flipping it is a
one-line change.

**Context.** `06-ui-service-design.md` §3 and the canvas legend say "Materiality uses the
lavender ramp (700/400/200 = high/medium/low)", but every materiality **pill** in the 11
approved artboards renders High as warn amber (`#92400E` on `#FEF3C7`), Medium as
brand-700 on brand-100 (`#5A3FBE` on `#EEE8FF`) and Low as neutral (`#4B4A63` on
`#ECEBF3`); only the explorer's split bar follows the lavender ramp
(`docs/design/mockup-spec.md` §1.3, §6.1). Amber is also the status colour for
partial / retrying / slow heartbeat.

**Decision.** Implement `MaterialityPill` as a single variant map and ship it **as drawn**
(the approved look): High = warn pair, Medium = brand-700/brand-100, Low = neutral pair,
no dot, 22 px high, text only. The split bar keeps the lavender ramp (brand-700 /
brand-400 / brand-200). Dark-theme pairs follow the re-stepped status tokens (contract
§5.4).

**Consequences.** Pixel parity with the approved mockup; High materiality reads at a
glance as "attention" next to the confidence meter. Caveat recorded here: amber is shared
with the warn status, so a High pill and a "Retry in …" pill look alike in colour — the
pills differ in text and the status pill carries a dot, so meaning is never colour-only.
If Daniel prefers the legend rule, switch High to brand-700 text on brand-200 background
in the variant map (one line) and supersede this record.
