# Sympera Scout — operator console for the article pipeline (Sympera AI)

## 1. System Overview & Context
Sympera Scout is the operator console of the news multi-agent article pipeline (`multi-agent-article`). It replaces `curl`, `psql` and `python -m cli.main` for the people who run the pipeline: launch and watch runs, inspect every job (stages, site runs, tasks, costs), reach every result (signals with evidence, companies with flags, articles with saved text), curate data sources and manage access.

* **Shape:** one Docker image = a React SPA (Vite, TypeScript strict, TanStack Router/Query/Table, shadcn/ui on Tailwind v4) served by a Python FastAPI BFF (`bff/scout_bff`). The browser talks to exactly one origin, the BFF (`/`, `/app/*`, `/v1/*`, `/healthz`, `/readyz`).
* **Input:** the pipeline API (`GET/POST /v1/*`, `X-API-Key`, keyset pagination `{items, next_cursor}`, RFC 9457 problems) — the single source of truth for jobs and results. `docs/api/openapi-pipeline.json` and `docs/api/pipeline-routes.txt` define the supported routes. Integration contract marker `1` and all required capabilities must be available.
* **Output / own state:** schema `ui` in the pipeline's PostgreSQL (users, sessions, scouts, batches, sources, saved views, preferences, audit log). The UI stores references to pipeline rows (job ids, article ids, company keys, domains), never copies of result data, except the finder facts a promoted source keeps.
* **Audience:** operators first (Daniel and engineers); kept easy and light. Version **2.1.0**.
* **Status:** the complete local backend/UI integration is implemented for the paired v2.1.0 release. Use the backend `GUIDE.md` for shared setup and operation, `docs/releases/v2.1.0.md` for release scope, and `HOWTO.md` for UI workflows. Local Docker at `http://localhost:8080` is supported; VM deployment is outside this release.

## 2. Core Tradeoffs & Guardrails
* **Granular files:** max **400 lines** per file (TypeScript and Python). Split before you reach it.
* **Explicit naming:** descriptive, domain-driven names (`SignalsExplorer`, `pipeline_client`, `require_role`); no ambiguous abbreviations. Routes, query keys, scripts and environment variable names are fixed by the contract — use them verbatim.
* **Formatting:** TypeScript strict, no `any` (use `unknown` + narrowing), ESLint incl. `jsx-a11y`, Prettier; Python PEP 8 through `ruff` (line length 88, rules `E4 E7 E9 F I`) and `ruff format`.
* **No new dependencies** beyond `docs/dev/engineering-contract.md` §3 without a one-line justification in the hand-back report; never jump to the next major of a pinned tool.
* **Security rules (non-negotiable):** pipeline API keys and `SESSION_SECRET` live only in the BFF environment and are registered for log redaction — nothing secret ever reaches the browser; every unsafe request carries `X-Requested-With: scout` and `X-CSRF-Token`; the `/v1` proxy is an **allowlist** by method and path with roles (`admin ⊃ operator ⊃ viewer`); **no CORS** anywhere (same origin only); security headers on every response (contract §4.9); uploads parsed server-side with size and row limits; messages never reveal whether an account exists.
* **Accessibility:** real buttons/links/inputs with labels, `aria-label` on icon buttons, status never colour-only, visible focus rings, keyboard paths for drawer, menus and ⌘K, contrast ≥ 4.5:1 in both themes.

## 3. Reference Documents
* **Binding contract:** `docs/dev/engineering-contract.md` — names, paths, commands, shapes. When it and the plan differ, the contract wins; when it is silent, the plan; when both are silent, the mockup spec.
* **Approved plan:** `docs/plan/07-ui-service-plan.md` (architecture §3, layout §5, security §10, deployment §11, phases §13, ADRs §15); design decisions and tokens: `docs/plan/06-ui-service-design.md`.
* **Mockup spec:** `docs/design/mockup-spec.md` (tokens, every screen, sample data for fixtures, component inventory, open questions).
* **Pipeline API:** `docs/api/openapi-pipeline.json` and `docs/api/pipeline-routes.txt`, matching backend v2.1.0 and integration contract marker `1`.
* **Decisions and operations:** `docs/dev/decisions.md`, `docs/dev/runbook.md`, `README.md`, `HOWTO.md`, `docs/releases/v2.1.0.md`, and the shared [backend GUIDE](https://github.com/Daniel-Gordon-sympera/multi-agent-article/blob/main/GUIDE.md).
* **External:** TanStack Router/Query/Table, shadcn/ui, Tailwind CSS v4, FastAPI, SQLAlchemy 2 Core, Alembic, pydantic-settings, Playwright, MSW 2.

## 4. Development & Operational Commands
*Run these exact commands when instructed to build, run, or test (contract §3):*
* **Install:** `cd web && pnpm install --frozen-lockfile` (pnpm 10, Node 22) and, at the root, `uv sync --frozen` (Python 3.12).
* **Run the SPA:** `pnpm dev` (Vite on :5173, proxies `/app`, `/v1`, `/healthz`, `/readyz` to `http://localhost:8080`; `VITE_BFF_URL` overrides via the selected platform file or process environment; automatic `.env*` loading is disabled) · `pnpm dev:mock` (MSW fixtures, no backend; accounts `admin@sympera.ai / scout-admin`, `operator@sympera.ai / scout-operator`, `viewer@sympera.ai / scout-viewer`, `newcomer@sympera.ai / scout-newcomer` with a forced password change) · `pnpm build` (`pnpm gen:routes && tsc -b && vite build` → `web/dist`, the real build: never contains the MSW worker, fonts emitted as files because the CSP is `font-src 'self'`) · `pnpm preview:mock` (mock build into `web/dist-mock`, served on :4173; what `pnpm e2e` uses).
* **Run the BFF:** `uv run uvicorn scout_bff.app:app --reload --port 8080` (serves `bff/scout_bff/static` when present — copy `web/dist` there to serve the built SPA, as the Docker image does). Bare processes read the sibling backend `.env.platform`, or the file selected by `PLATFORM_ENV_FILE`; process variables take precedence. `python -m scout_bff` runs uvicorn on `UI_PORT` (default 8080). Use `UI_SECURE_COOKIES=false` for local HTTP.
* **Database migrations:** Alembic history in `bff/scout_bff/migrations` (version table in schema `ui`); applied by `uv run python -m scout_bff.bootstrap` (owner `UI_DATABASE_URL`; creates schema, roles `svc_ui`/`app_ui`, grants, the first admin; idempotent). In Docker the one-shot `ui_migrate` service runs it on every `up`.
* **API types:** `uv run python -m scout_bff.openapi > docs/api/openapi-bff.json` then `cd web && pnpm gen:api` (regenerates `src/api/pipeline.gen.ts` and `src/api/bff.gen.ts`; never hand-edit generated files).
* **Docker:** from the backend repository, use `docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml` for every combined command. Follow `GUIDE.md` to build images, run backend and UI migrations, then start services. Image `scout-ui:${UI_IMAGE_TAG:-local}`; shared variables are documented in the backend `.env.platform.example`. Caddy is optional; the supported local UI binds to loopback port 8080.

## 5. Testing
* **Branch strategy:** never commit directly to `main`; develop on a feature branch (`feature/<area>-<topic>`, e.g. `feature/jobs-runs-table`, `feature/bff-proxy`).
* **On every change (the same checks CI runs):** `cd web && pnpm check` (typecheck, ESLint, Prettier, Vitest) and `pnpm build`; at the root `uv run ruff check . && uv run ruff format --check .`, `uv run lint-imports`, `uv run pytest -q`.
* **Route or shell changes:** `cd web && pnpm e2e` (Playwright against `preview:mock`, with axe checks).
* **BFF integration tests:** need `UI_TEST_DATABASE_URL` (owner URL of a disposable database); skipped with a reason when unset. Standard CI uses a `respx` pipeline stub (`tests/pipeline_stub.py`) and MSW browser fixtures. Never use production data, provider APIs or live pipeline jobs in these tests. The separate `scripts/combined_acceptance.py` harness uses real local API/BFF services, seeded disposable databases and a built SPA, without provider calls; read its requirements before running.
* **Before merge / big changes:** verify the Docker image build and `docker compose --env-file .env.platform … config`; run the separate local combined acceptance/restore harness when auth, proxy or deployment changes. Its output stays outside tracked files. Release scope and completed validation are described in `docs/releases/v2.1.0.md`; detailed live validation evidence belongs in the private backend repository.

## 6. Github Rules
1. **Working repo:** `Daniel-Gordon-sympera/multi-agent-article-ui` is public. The local checkout is named `multi-agent-articles-ui`; its paired `multi-agent-article` backend repository is private. Never publish secrets or private live-run evidence in the UI repository.
2. **Credentials:** GitHub user `Daniel-Gordon-sympera`, e-mail `daniel.gordon@sympera.ai`.
3. One feature per branch; meaningful branch names (`feature/<area>-<topic>`).
4. Every PR runs CI (`.github/workflows/ci.yml`: web, bff, e2e, image); merge only when green; **squash-merge** into `main`.
5. Delete branches after merge; keep CI clean and lean (replace redundant tests, keep only the important ones).
6. Releases are git tags on `main` matching `__version__` in `bff/scout_bff/version.py`, `version` in `pyproject.toml` and `web/package.json`, and the paired backend release; the image tag follows the release tag. Keep OpenAPI versions and release notes consistent.

## 7. Architecture
1. The BFF is the only origin the browser talks to; it holds the pipeline keys and proxies `/v1` by role (contract §4.7).
2. The UI writes only schema `ui` (role `svc_ui`, login `app_ui`); it never reads pipeline schemas directly — everything about jobs and results comes through `/v1`.
3. Aggregates and complete result queries belong in the pipeline API. Do not reintroduce bounded job scans, partial counts/exports, client-side job filters or invented cost defaults. Required capabilities are checked at startup and refreshed; incompatible backends produce an explicit unavailable state and fail readiness.
4. Modular, plug-and-play structure: one package per aggregate in the BFF, one feature folder per area in the SPA, shared building blocks built once.
5. PostgreSQL for storage, Docker for packaging, Compose override for deployment in the pipeline's project.

<!-- planfirst:start -->
## Architecture Reference
Full spec: `docs/dev/engineering-contract.md` (binding) and `docs/plan/07-ui-service-plan.md` — read both before adding any infrastructure. Decisions: `docs/dev/decisions.md`.

### Stack
- Web: Vite 7, React 19, TypeScript ~5.9 (strict), pnpm 10 / Node 22; TanStack Router (file routes, `routeTree.gen.ts` generated and git-ignored), TanStack Query v5 (polling 5 s live / 30 s calm / none static, ETag-aware, paused in background), TanStack Table v8; Tailwind v4 + shadcn-style primitives on Radix, Lucide, cmdk, sonner; react-hook-form + zod; fontsource Plus Jakarta Sans + JetBrains Mono (self-hosted); Vitest + Testing Library + MSW 2; Playwright 1.56.0 + axe.
- BFF: Python 3.12 via uv (frozen `uv.lock`), FastAPI + uvicorn, httpx (async pool), SQLAlchemy 2 Core + psycopg 3, Alembic (schema `ui`), pydantic-settings, structlog (JSON, secret redaction), argon2-cffi (argon2id), itsdangerous (signed session cookie); pytest + respx + asgi-lifespan; ruff; import-linter.
- Image and deployment: `node:22-alpine` build stage → `python:3.12-slim-bookworm` runtime, UID 10001, port 8080; `compose.ui.yaml` adds `ui_migrate` and `ui` in the pipeline project `article-pipeline`. It optionally extends `caddy` under the HTTPS profile; local Docker uses loopback HTTP without Caddy.
- CI: GitHub Actions `ci.yml` — web (check + build), bff (ruff, lint-imports, pytest with Postgres 16), e2e (Playwright mock mode), image (docker build, no push).

### Agent Rules
- **Ownership (contract §6–7).** The foundation phase (A1–A3) and the feature phase (B1 Jobs, B2 Scouts + Sources, B3 Signals, B4 Overview + Settings) are complete and merged; the map below is kept as history and future work follows the same rules. Foundation: A1 owned `web/`; A2 owned `bff/`, `tests/`, `pyproject.toml`, `uv.lock`, `alembic.ini`; A3 owned the root ops/docs files (`Dockerfile`, `.dockerignore`, `compose.ui.yaml`, `deploy/`, `.github/`, `.gitignore`, `.editorconfig`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `HOWTO.md`, `docs/dev/decisions.md`, `docs/dev/runbook.md`). Feature work owns `web/src/features/<area>/`, `web/src/routes/_app/<area>…`, `web/src/mocks/handlers/<area>.ts`, `web/src/mocks/fixtures/<area>.ts`, `bff/scout_bff/<aggregate>/`, `tests/**/test_<area>_*.py`, and the HOWTO/README sections of that area.
- **Shared files** (`web/src/components/`, `api/`, `lib/`, `app/`, `bff/scout_bff/app.py`, `settings.py`, `migrations/`) take **additive** changes only (new exports, new optional props); never rename or change existing behaviour — report the need instead.
- **Generated files** (`routeTree.gen.ts`, `pipeline.gen.ts`, `bff.gen.ts`, `mockServiceWorker.js`, `uv.lock`, `pnpm-lock.yaml`) are regenerated, never hand-edited.
- DO NOT add a model call, a direct pipeline-database connection or a generic web search anywhere in this repository; the BFF reaches the pipeline only through `PIPELINE_API_URL`.
- DO NOT put an API key, a session secret or a database password in the SPA, in fixtures, in logs or in test output; the two pipeline keys are chosen by role inside the BFF (`admin`/`operator` → operator key, `viewer` → reader key).
- DO NOT widen the `/v1` allowlist beyond `docs/api/pipeline-routes.txt`. API-key metadata reads, creation and revocation are admin-only. Website access-policy reads and resets are operator-only. Other writes require operator and other allowed reads permit viewer; unmatched requests return `404 not_proxied`.
- DO NOT hide a missing required capability behind a fallback. Contract marker `1`, required routes/filters and authenticated API-key reads must pass readiness. Display incompatible/unavailable states, refresh the capability map and invalidate affected cached queries when it changes.
- Filters, density, column visibility, pagination cursor and the open drawer live in the URL (zod-validated search params); links use `<Link to=… params=…>`, never string concatenation.
- Keep every file ≤ 400 lines; no `any`; no console noise; fixtures keep the mockup's stable ids (`docs/design/mockup-spec.md` §4) so tests and e2e can reference them.
- **Docs are part of the feature:** update relevant HOWTO and developer documentation, keep README lean with links to the shared guide and current release notes, and add an ADR to `docs/dev/decisions.md` for durable decisions.
- **Hand-back report** (≤ 40 lines): what was built (paths), commands run and their results, deviations from the contract, open issues.
- Work on a feature branch, never on `main`.
<!-- planfirst:end -->
