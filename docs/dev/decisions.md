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

## ADR-UI-009 — Table columns are module constants; live facts reach cells through a context

**Status:** accepted (2026-10-04).

**Context.** TanStack Table renders a column's `cell` through `flexRender`, which treats a
function-valued `cell` as a React component type. When a screen rebuilds its column array
on every render (for example to close over polled progress, a ticking clock or mutation
handlers), every cell receives a *new* component type and React remounts the whole cell
subtree: confirm dialogs close by themselves on the next 5 s poll, loading spinners
flicker and focus is lost. The Runs table hit exactly this.

**Decision.** Column definitions of the jobs screens are module-level constants
(`RUNS_COLUMNS`, `SITE_RUN_COLUMNS`, `TASK_COLUMNS`, …). Cells are named components that
read whatever changes while the table is on screen — polled snapshots, batch memberships,
the clock, the operator's role, handlers — from a small React context created with
`features/jobs/shared/columnContext.ts` and provided by the page around `<DataTable>`.
Column builders that only close over stable values (a job id, a memoised handler) may
stay memoised functions.

**Consequences.** Dialog and button state survive polling; one `useMemo` per page holds
the context value. Other feature agents building live tables should follow the same
pattern (or memoise the column array on genuinely stable inputs only).

## ADR-UI-010 — New run form: curated seeds resolve to a `seeds` job; settings are sent as shown

**Status:** accepted (2026-10-04).

**Context.** The mockup's New run form has a *Mode* control (location + industries ·
site URL · seeds from Data Sources) and, in location mode, a *Sources* choice (finder or
the county's curated seeds). The pipeline API only knows the kinds `location_industry`,
`seeds` and `url`, and the BFF fan-out (contract §4.5) sends one leg per industry for
`location_industry` and a single leg for the other kinds. The contract also says the
batch `settings` are "overrides only".

**Decision.** Location + *curated seeds* resolves to `kind = "seeds"` with the active Data
Sources of the county (filtered by the chosen industries) as the seed list — one job, the
industries kept as labels; *Seeds from Data Sources* mode is the same kind with an
explicit tick list; a saved Scout with `kind = "seeds"` reopens as location mode + curated
seeds (a Scout stores no tick list). The six advanced settings are sent exactly as the
form shows them (the platform defaults pre-filled), so the operator never gets a job whose
saved settings differ from what the Summary card displayed.

**Consequences.** `legsOf()` and `resolvedKind()` in `features/jobs/newRun/newRunSchema.ts`
are the single source of the fan-out preview, the Summary card and the request body.
Changing the platform defaults requires updating `DEFAULT_SETTINGS` there (or, later,
reading them from `GET /app/system`).

## ADR-UI-011 — Fan-out, seed composition and suggestion rules of the Scouts/Sources BFF

**Status:** accepted (2026-10-04, feature agent B2).

**Context.** Contract §4.5 fixes the shape of a batch but leaves three behaviours open:
what happens when the pipeline API cannot be reached part-way through a fan-out, which
curated sources a seed run takes, and how finder suggestions are attributed to a county
when no location filter is given.

**Decision.**
1. **Fan-out is one transaction.** `ui.batches` + `ui.batch_jobs` (and a `save_as_scout`
   Scout) are written in the same transaction as the leg submissions. Legs are submitted
   in order; a `4xx` leg is recorded with its problem and the batch still answers `201`;
   a `409` whose body carries `job_id` is recorded as that job. The first connection
   error or timeout stops the remaining legs (they are recorded as "not attempted"), and
   when **no** leg was attempted the transaction rolls back and the call answers
   `502 pipeline_api_unavailable` — nothing half-created survives. Optional
   `client_reference_suffix` appends `:<slug(suffix)>` to every leg reference, which keeps
   the `ui:<batch>:` prefix intact for B3's filter.
2. **Seeds = active sources of the county and state** (county compared without the
   word "County"), narrowed to the Scout's industries when it lists any; a source with
   no industries matches every industry. Explicit `seeds` in a `BatchInput` win. No
   match → `422 no_active_sources` before any API call.
3. **Suggestions carry the county and state they were found for.** With a location
   filter the BFF asks the judged-domain memory for both spellings ("Orange County,
   Florida", "Orange, FL") and reads the rankings of the last five location-industry
   jobs of that location. Without a filter the locations come from the recent jobs and
   the active sources (at most ten), so a suggestion is never attributed to a location
   the finder did not judge it for. Candidates are cached 60 s per query; listed and
   dismissed domains are removed live, so a promote or dismiss takes effect at once.
   Precision (`GET /v1/sources/stats`) is fetched per distinct domain, cached 60 s,
   and the median is taken over the active sources only.

**Consequences.** Batches are either fully recorded or absent; operators can retry a
run safely. Seed Scouts follow the curated list without re-saving the Scout. Suggestion
lists stay bounded (≤ 2 memory calls per location, ≤ 5 ranking reads) and attribution is
exact. Revisit the seed rule if sources gain a per-industry weighting, and the location
derivation when B3's `client_reference_prefix` filter makes batch-level queries cheap.

## ADR-UI-012 — Cross-job signals: one column registry, offset cursors for the fallback, `?detail=` for the drawer

**Status:** accepted (2026-10-04).

**Context.** The Signals explorer and the Job › Signals tab draw the same record cell with two
different column sets (mockup §6.2); the explorer must work before the pipeline's cross-job
read (B1) exists (ADR-UI-007: merge the 20 most recent matching jobs in the BFF, 30 s cache);
the contract names the drawer's opener `?signal=` but `signal` is also the cross-job *type*
filter of §4.4; and the pipeline's keyset cursors (`lpad(id)`) cannot page a list the BFF
merged from several jobs.

**Decision.**
1. **One column registry.** `features/signals/signalColumns.ts` holds the eleven columns
   (`record, hqCity, hqScope, hqState, industry, revenueBin, date, source, jobLocation, job,
   open`) with per-route default visibility; the job tab shows the HQ scope chip under the
   city and the article source, the explorer the job location/source and the job id. Every
   column stays available in the chooser on both screens and the chosen set lives in `?cols=`.
   The evidence is always the verbatim `signal_evidence`/`evidence` of the API, ellipsised by
   CSS, never pre-trimmed.
2. **Offset cursors for the BFF fallback.** `GET /app/signals` pages the merged, sorted
   (article date desc, id desc) list with the opaque offset cursor of `cursors.py`, bound to
   the normalised filter set (a cursor reused with other filters → `400 invalid_cursor`). The
   SPA treats it like any keyset cursor (`useKeysetPage`, `?after=`). With `signals_global`
   the API's own cursor is passed through unchanged; only a free-text `q` (applied in the
   BFF by contract) switches to a bounded pull (2,000 rows) with offset paging. The summary
   endpoint (`/app/signals/summary`) computes over the same bounded set, so the chip-row
   totals, the materiality strip and the "of N" footer agree with the table.
3. **`?detail=<mention id>` opens the drawer** on both screens (contract §7); the id is kept
   numeric in the search schema so the router writes `detail=9000` rather than a JSON-quoted
   string. Previous/Next step through the loaded page only; a deep link to a row outside the
   page shows an explanatory empty state instead of a second query.
4. **Saved views store the §4.4 filter object plus the column list** (`search` + `columns`),
   never table rows; applying a view rewrites the URL (`?view=<id>`), and any later filter
   change detaches the URL from the view.

**Consequences.** Both screens share `SignalsTable`, `SignalRecordCell` and `SignalDrawer`
(one place to change the record anatomy); the fallback's paging is honest about its limits
(`degraded`, `scanned_jobs`, `truncated`) and disappears behind the same endpoints once B1
lands; mention ids in URLs stay readable. Costs: the fallback's "of N" total is only as
good as its 20-job window, and the Job › Signals footer counts companies on the page, not
across pages (the API gives no totals).

## ADR-UI-013 — Dashboard aggregates: short TTL caches, honest gaps, browser-local registries

**Status:** accepted (2026-10-04). Owner: B4 (Overview + Settings).

**Context.** The Overview and Settings › Workers & health are the pages every operator
keeps open. Each needs several pipeline reads per refresh (`/v1/jobs` per status, a
`get_job` per active run, `/v1/workers`, `/v1/stats/daily`, the dead tasks of up to 20
jobs), the SPA polls them every 5–30 s, and several tabs may be open at once. The mockup
also draws facts the pipeline API does not expose (proxy zone and traffic, storage
figures, maintenance results, model prices, a list of API keys and of exports, worker
logs and draining).

**Decision.**
1. **Per-process TTL cache with single flight** (`scout_bff/overview/cache.py`):
   `/app/overview` 10 s, `/app/overview/active-runs` 5 s, `/app/attention` 10 s,
   `/app/system*` 10 s. Values are shared across users (every cached read is a GET both
   pipeline keys may perform); the first caller's role picks the key; failures are
   never cached. The pipeline load is therefore bounded by the TTLs, not by the number
   of viewers, and the fan-out per computation is capped (≤ 7 status queries, ≤ 25
   active runs, ≤ 20 fallback jobs, ≤ 8 parallel calls).
2. **Honest gaps instead of placeholders.** Rows the API does not expose render as
   "not exposed by the API" (Storage tile, proxy zone/traffic, maintenance
   `last_result: null`, `model_prices: null` with `notes[]`); Logs/Drain are inert
   `aria-disabled` buttons with a tooltip; the failed count of the queue tile reads
   "unknown without B3" in the `recent_jobs` basis. Every aggregate names its source
   (`basis: "api" | "recent_jobs" | "daily_stats"`) so a reader can tell a fallback
   from the real thing.
3. **Browser-local registries for what the API cannot list.** The names/roles/dates of
   API keys created in this browser (`scout.apiKeys.created`) and the ids of dataset
   exports started here (`scout.exports.created`) live in `localStorage`; secrets are
   never stored. Both registries are replaced by the API's own lists as soon as they
   exist (`api_keys_list` for keys; an export list is a candidate backend PR).

**Consequences.** Dashboards stay cheap and consistent across tabs; a change on the
pipeline shows within one TTL (≤ 10 s), which matches the 5 s / 30 s polling policy
(ADR-UI-005). Operators always know whether a number is authoritative. The registries are
per browser: a key created on one machine is not listed on another until B4 lands — the
page says so. Revisit the cache when the BFF runs with more than one process (the
cache is per process; a shared cache or ETags on `/app/*` would be the next step).
