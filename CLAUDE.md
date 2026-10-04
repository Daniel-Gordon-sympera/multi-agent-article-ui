# Sympera Scout — operator console for the article pipeline (Sympera AI)

## 1. System Overview & Context
Sympera Scout is the operator console of the news multi-agent article pipeline (`multi-agent-article`). It replaces `curl`, `psql` and `python -m cli.main` for the people who run the pipeline: launch and watch runs, inspect every job (stages, site runs, tasks, costs), reach every result (signals with evidence, companies with flags, articles with saved text), curate data sources and manage access.

* **Shape:** one Docker image = a React SPA (Vite, TypeScript strict, TanStack Router/Query/Table, shadcn/ui on Tailwind v4) served by a Python FastAPI BFF (`bff/scout_bff`). The browser talks to exactly one origin, the BFF (`/`, `/app/*`, `/v1/*`, `/healthz`, `/readyz`).
* **Input:** the pipeline API (`GET/POST /v1/*`, `X-API-Key`, keyset pagination `{items, next_cursor}`, RFC 9457 problems) — the single source of truth for jobs and results. 34 routes exist today (`docs/api/pipeline-routes.txt`); four additions B1–B4 are pending and treated as optional capabilities.
* **Output / own state:** schema `ui` in the pipeline's PostgreSQL (users, sessions, scouts, batches, sources, saved views, preferences, audit log). The UI stores references to pipeline rows (job ids, article ids, company keys, domains), never copies of result data, except the finder facts a promoted source keeps.
* **Audience:** operators first (Daniel and engineers); kept easy and light. Version **0.1.0**.

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
* **Pipeline API:** `docs/api/openapi-pipeline.json` and `docs/api/pipeline-routes.txt` (branch `feature/platform-and-api`).
* **Decisions and operations:** `docs/dev/decisions.md` (ADR-UI-001…008), `docs/dev/runbook.md`, `README.md`, `HOWTO.md`.
* **External:** TanStack Router/Query/Table, shadcn/ui, Tailwind CSS v4, FastAPI, SQLAlchemy 2 Core, Alembic, pydantic-settings, Playwright, MSW 2.

## 4. Development & Operational Commands
*Run these exact commands when instructed to build, run, or test (contract §3):*
* **Install:** `cd web && pnpm install --frozen-lockfile` (pnpm 10, Node 22) and, at the root, `uv sync --frozen` (Python 3.12).
* **Run the SPA:** `pnpm dev` (Vite on :5173, proxies `/app`, `/v1`, `/healthz`, `/readyz` to `http://localhost:8080`; `VITE_BFF_URL` overrides) · `pnpm dev:mock` (MSW fixtures, no backend) · `pnpm build` (`tsc -b && vite build` → `web/dist`) · `pnpm preview:mock`.
* **Run the BFF:** `uv run uvicorn scout_bff.app:app --reload --port 8080` (serves `bff/scout_bff/static` when present; reads `.env.ui` when present).
* **Database migrations:** Alembic history in `bff/scout_bff/migrations` (version table in schema `ui`); applied by `uv run python -m scout_bff.bootstrap` (owner `UI_DATABASE_URL`; creates schema, roles `svc_ui`/`app_ui`, grants, the first admin; idempotent). In Docker the one-shot `ui_migrate` service runs it on every `up`.
* **API types:** `uv run python -m scout_bff.openapi > docs/api/openapi-bff.json` then `cd web && pnpm gen:api` (regenerates `src/api/pipeline.gen.ts` and `src/api/bff.gen.ts`; never hand-edit generated files).
* **Docker (Daniel's machine; registries are unreachable from the cloud sandbox):** from the pipeline repo, `docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml up -d --build`; image `scout-ui:${UI_IMAGE_TAG:-local}`; variables in `.env.ui.example`.

## 5. Testing
* **Branch strategy:** never commit directly to `main`; develop on a feature branch (`feature/<area>-<topic>`, e.g. `feature/jobs-runs-table`, `feature/bff-proxy`).
* **On every change (the same checks CI runs):** `cd web && pnpm check` (typecheck, ESLint, Prettier, Vitest) and `pnpm build`; at the root `uv run ruff check . && uv run ruff format --check .`, `uv run lint-imports`, `uv run pytest -q`.
* **Route or shell changes:** `cd web && pnpm e2e` (Playwright against `preview:mock`, with axe checks).
* **BFF integration tests:** need `UI_TEST_DATABASE_URL` (owner URL of a disposable database); skipped with a reason when unset. The pipeline API is always a `respx` stub (`tests/pipeline_stub.py`); the SPA always runs on MSW fixtures. **Never the network, never a live pipeline, never a live database in tests.**
* **Before merge / big changes:** the Docker image builds (`docker build .`), `docker compose … config` is valid, and a real sign-in → run → results walk-through on Daniel's machine when the change touches auth, proxy or deployment.

## 6. Github Rules
1. **Working repo:** `multi-agent-articles-ui` (private) under the `Daniel-Gordon-sympera` GitHub account.
2. **Credentials:** GitHub user `Daniel-Gordon-sympera`, e-mail `daniel.gordon@sympera.ai`.
3. One feature per branch; meaningful branch names (`feature/<area>-<topic>`).
4. Every PR runs CI (`.github/workflows/ci.yml`: web, bff, e2e, image); merge only when green; **squash-merge** into `main`.
5. Delete branches after merge; keep CI clean and lean (replace redundant tests, keep only the important ones).
6. Releases are git tags on `main` matching `__version__` in `bff/scout_bff/version.py` and `version` in `pyproject.toml`; the image tag follows the release tag.

## 7. Architecture
1. The BFF is the only origin the browser talks to; it holds the pipeline keys and proxies `/v1` by role (contract §4.7).
2. The UI writes only schema `ui` (role `svc_ui`, login `app_ui`); it never reads pipeline schemas directly — everything about jobs and results comes through `/v1`.
3. Aggregates the UI needs but the API lacks are **added to the pipeline API** (B1–B4), not computed in the BFF — except the documented, bounded fallbacks of the contract (§4.3 attention/retry-dead/estimate, §4.4 signals over the 20 most recent jobs) that keep every screen working until the API catches up.
4. Modular, plug-and-play structure: one package per aggregate in the BFF, one feature folder per area in the SPA, shared building blocks built once.
5. PostgreSQL for storage, Docker for packaging, Compose override for deployment in the pipeline's project.

<!-- planfirst:start -->
## Architecture Reference
Full spec: `docs/dev/engineering-contract.md` (binding) and `docs/plan/07-ui-service-plan.md` — read both before adding any infrastructure. Decisions: `docs/dev/decisions.md`.

### Stack
- Web: Vite 7, React 19, TypeScript ~5.9 (strict), pnpm 10 / Node 22; TanStack Router (file routes, `routeTree.gen.ts` generated and git-ignored), TanStack Query v5 (polling 5 s live / 30 s calm / none static, ETag-aware, paused in background), TanStack Table v8; Tailwind v4 + shadcn-style primitives on Radix, Lucide, cmdk, sonner; react-hook-form + zod; fontsource Plus Jakarta Sans + JetBrains Mono (self-hosted); Vitest + Testing Library + MSW 2; Playwright 1.56.0 + axe.
- BFF: Python 3.12 via uv (frozen `uv.lock`), FastAPI + uvicorn, httpx (async pool), SQLAlchemy 2 Core + psycopg 3, Alembic (schema `ui`), pydantic-settings, structlog (JSON, secret redaction), argon2-cffi (argon2id), itsdangerous (signed session cookie); pytest + respx + asgi-lifespan; ruff; import-linter.
- Image and deployment: `node:22-alpine` build stage → `python:3.12-slim-bookworm` runtime, UID 10001, port 8080; `compose.ui.yaml` adds `ui_migrate`, `ui` and extends `caddy` in the pipeline's project `article-pipeline`; `deploy/Caddyfile.ui` is the UI site block.
- CI: GitHub Actions `ci.yml` — web (check + build), bff (ruff, lint-imports, pytest with Postgres 16), e2e (Playwright mock mode), image (docker build, no push).

### Agent Rules
- **Ownership (contract §6).** Foundation: A1 owns `web/`; A2 owns `bff/`, `tests/`, `pyproject.toml`, `uv.lock`, `alembic.ini`; A3 owns the root ops/docs files (`Dockerfile`, `.dockerignore`, `compose.ui.yaml`, `deploy/`, `.env.ui.example`, `.github/`, `.gitignore`, `.editorconfig`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `HOWTO.md`, `docs/dev/decisions.md`, `docs/dev/runbook.md`). Feature agents own `web/src/features/<area>/`, `web/src/routes/_app/<area>…`, `web/src/mocks/handlers/<area>.ts`, `web/src/mocks/fixtures/<area>.ts`, `bff/scout_bff/<aggregate>/`, `tests/**/test_<area>_*.py`, and their HOWTO/README sections.
- **Shared files** (`web/src/components/`, `api/`, `lib/`, `app/`, `bff/scout_bff/app.py`, `settings.py`, `migrations/`) take **additive** changes only (new exports, new optional props); never rename or change existing behaviour — report the need instead.
- **Generated files** (`routeTree.gen.ts`, `pipeline.gen.ts`, `bff.gen.ts`, `mockServiceWorker.js`, `uv.lock`, `pnpm-lock.yaml`) are regenerated, never hand-edited.
- DO NOT add a model call, a direct pipeline-database connection or a generic web search anywhere in this repository; the BFF reaches the pipeline only through `PIPELINE_API_URL`.
- DO NOT put an API key, a session secret or a database password in the SPA, in fixtures, in logs or in test output; the two pipeline keys are chosen by role inside the BFF (`admin`/`operator` → operator key, `viewer` → reader key).
- DO NOT widen the `/v1` allowlist beyond `docs/api/pipeline-routes.txt`; `POST /v1/api-keys` and `DELETE /v1/api-keys/*` are admin-only, every other `POST` is operator-only, every `GET` is for any role; unmatched → `404 not_proxied`.
- DO NOT let a missing capability (B1–B4: `signals_global`, `tasks_global`, `retry_dead`, `api_keys_list`, `sources_stats`, `cost_estimate`, `jobs_industry_filter`, `jobs_reference_filter`) break a screen: use the bounded fallback the contract defines or show the short "needs pipeline API update (B…)" note.
- Filters, density, column visibility, pagination cursor and the open drawer live in the URL (zod-validated search params); links use `<Link to=… params=…>`, never string concatenation.
- Keep every file ≤ 400 lines; no `any`; no console noise; fixtures keep the mockup's stable ids (`docs/design/mockup-spec.md` §4) so tests and e2e can reference them.
- **Docs are part of the feature:** each feature agent appends its HOWTO section(s), updates the README feature table and, when it decides something durable, adds an ADR to `docs/dev/decisions.md`.
- **Hand-back report** (≤ 40 lines): what was built (paths), commands run and their results, deviations from the contract, open issues.
- Work on a feature branch, never on `main`.
<!-- planfirst:end -->
