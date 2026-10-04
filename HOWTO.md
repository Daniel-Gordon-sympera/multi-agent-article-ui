# Sympera Scout — operator how-tos

Task-by-task instructions, Docker first. Every command below runs on the machine that
hosts the pipeline, from the **pipeline repository** (the folder with its
`compose.yaml`), with this repository checked out as the sibling folder
`../multi-agent-articles-ui`. To keep the lines short:

```bash
alias dcu='docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml'
```

Sections 4–10 are completed by the feature agents when their screens land (see
`README.md` › Features for what exists today).

## 1. Install and first run (Docker)

1. Make sure the pipeline itself runs: `docker compose up -d` in the pipeline repo and
   `curl --fail http://127.0.0.1:8000/readyz` answers `{"status":"ready",…}`.
2. Create the two pipeline API keys for the console (section 2).
3. Append the UI variables to the pipeline's `.env`. Copy the uncommented lines of
   [`.env.ui.example`](.env.ui.example) and fill them:

   ```bash
   UI_DATABASE_PASSWORD=$(openssl rand -hex 24)
   PIPELINE_OPERATOR_KEY=sympera_…           # from section 2
   PIPELINE_READER_KEY=sympera_…             # from section 2
   SESSION_SECRET=$(openssl rand -hex 32)
   UI_BOOTSTRAP_ADMIN_EMAIL=you@sympera.ai
   UI_BOOTSTRAP_ADMIN_PASSWORD=<temporary password>
   UI_DOMAIN=scout.localhost                 # or scout.<your-domain> pointing at this machine
   ```

4. Decide how Caddy serves the UI host — option A: add `import /etc/caddy/Caddyfile.ui`
   to the pipeline's `deploy/Caddyfile`; option B: uncomment the
   `deploy/Caddyfile:/etc/caddy/Caddyfile:ro` line in `compose.ui.yaml` (details in
   `README.md` › Quick start, step 3). Skipping this step still gives you
   `http://127.0.0.1:8080`.
5. Validate, build and start:

   ```bash
   dcu config --quiet                         # no output = the merged project is valid
   dcu up -d --build                          # builds scout-ui:local, runs ui_migrate, starts ui
   dcu ps                                     # ui_migrate "Exited (0)", ui "healthy"
   curl --fail http://127.0.0.1:8080/readyz   # {"status":"ready","checks":{"database":…,"migrations":…,"pipeline_api":…}}
   ```

6. Open `https://scout.localhost` (accept the Caddy-internal certificate for a
   `*.localhost` name) or `http://127.0.0.1:8080` and continue with section 3.

If `ui_migrate` exits non-zero, read `dcu logs ui_migrate`: the usual causes are a
missing `UI_DATABASE_PASSWORD`, a `POSTGRES_PASSWORD` that does not match the running
database, or the pipeline's own `migrate` service not having completed.

## 2. Create the pipeline API keys for the UI

The console never holds a key in the browser. The BFF uses two pipeline keys chosen by
the signed-in user's role: `admin` and `operator` users act with the **operator** key,
`viewer` users with the **reader** key. Create both once with the pipeline's bootstrap
key (`API_BOOTSTRAP_KEY` in the pipeline's `.env`; see the pipeline README, "Platform
operation › Start and inspect"):

```bash
export API_BOOTSTRAP_KEY=…   # from the pipeline's .env
curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
     -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
     -d '{"name": "scout-ui-operator", "role": "operator"}'
curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
     -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
     -d '{"name": "scout-ui-reader", "role": "reader"}'
```

Each call answers `201 {"id", "name", "role", "created_at", "key": "sympera_…"}`; the
`key` is shown exactly once — copy it into `PIPELINE_OPERATOR_KEY` /
`PIPELINE_READER_KEY`. A `409 key_name_exists` means the name is taken: pick another
name or revoke the old key first (`curl -X DELETE …/v1/api-keys/scout-ui-operator`).
Rotation is in section 11.

## 3. Sign in, change the bootstrap password, add users

1. Open the console and sign in with `UI_BOOTSTRAP_ADMIN_EMAIL` /
   `UI_BOOTSTRAP_ADMIN_PASSWORD`. The bootstrap account is created with
   `must_change_password = true`, so you land on `/account/password`: enter the
   temporary password and a new one. Until you do, every other page answers
   `403 password_change_required`.
2. Remove `UI_BOOTSTRAP_ADMIN_PASSWORD` from `.env` (it is only read while `ui.users`
   is empty).
3. Add colleagues under **Settings › Users** (`/settings/users`, admin only): e-mail,
   name, role, initial password. Roles: `viewer` (read everything, download per-job
   CSVs), `operator` (viewer + create runs, cancel/resume/retry, Scouts, Data Sources,
   dataset exports), `admin` (operator + users, pipeline API keys). New users must change
   their password on first sign-in; an admin can reset a password from the same page
   and can disable an account, but not their own.
4. Rate limits protect sign-in: 10 failed attempts per e-mail in 15 minutes or 60 per
   IP per hour answer `429 too_many_attempts`; wait or have an admin reset the password.
   Sessions expire after 12 hours idle or 7 days; Sign out (sidebar footer) ends one
   immediately.

Preferences (theme, density, UTC or local time, landing page) are per user under
Settings › Preferences.

## 4. Launch a run

Runs are created from **Jobs › New run** (`/jobs/new`; operators and admins only — viewers
do not see the button). One form covers the three job kinds of the pipeline API:

1. **Mode** (segmented control at the top of the *Target* card):
   - *Location + industries* — the finder searches the web for local news sites per
     industry and explores the top `sites` of each. Fill the **State**, the **County**
     (always required: HQ scope and entity flags are derived relative to it), check the
     **Location phrase** the finder will use (pre-filled as "Orange County, FL", edit it
     if the local press uses another name) and add **Industries** from the NAICS catalog
     (type, pick from the list, Backspace removes the last token). The *fan-out preview*
     lists one row per industry: **every industry becomes its own job**, all of them
     share one batch id.
   - *Site URL* — one job that explores a single site; paste its address.
   - *Seeds from Data Sources* — one job whose site runs are the ticked active sources
     of that county (`/sources`); all of them are ticked by default. Industries are
     optional here and only label the job.
2. **Sources** (location mode only): keep the finder, or switch to the curated seeds of
   the county — the card shows how many active Data Sources match; the option is
   disabled when there is none.
3. **Settings**: *Hide/Show advanced* toggles the grid — days to look back, sites per
   job, site timeout (0 = none), max runtime, memory mode and re-analysis. The values
   shown are the platform defaults; what you see is what is saved with the job.
4. The sticky **Summary** shows the resolved kind, the jobs the batch will create, the
   sources, the prompt version the API stamps on new jobs (that of the most recent job)
   and an **estimated cost per job** (`GET /app/estimate`: the pipeline's figure when it
   has one, otherwise the median of the last 10 completed runs of the same kind and
   industry; "—" until a run of that kind has completed).
5. Tick **Save as Scout** and give it a name to keep the setup for later runs (`Jobs ›
   Scouts`); *Save Scout without running* stores it without creating jobs.
6. Press **Create N jobs**. Each leg is one `POST /v1/jobs`; the runs appear under
   `/jobs` within seconds with a *batch n of N* chip. When a leg fails (the API refused
   it), a dialog lists the outcome per leg with a **Retry** for the failed ones — the
   created runs are already queued.

Shortcuts: a run's **⋯ › Re-run** / the `[▶ Re-run]` row button opens the form pre-filled
from that job (`/jobs/new?from=<jobId>`); a Data Source's "run with this seed" opens it
in Seeds mode with that source ticked (`/jobs/new?mode=seeds&source=<id>`); a Scout's
Edit opens it with **Run Scout** (runs the setup *as saved*) and **Save changes**.

## 5. Watch a run and read results

**Jobs › Runs** (`/jobs`) lists every job of the API, newest first, with the stage bar,
sites done / total, articles, signals, cost and duration (from `GET /app/jobs/progress`,
refreshed every 5 s while any listed run is still working, every 30 s otherwise). The
toolbar filters by status, state, county, industry and creation date (*Created* defaults
to the last 7 days; *Custom range* opens two date inputs — leave both empty to list every
run), the search box narrows the loaded page by county, industry, domain or id, and
*Export CSV* downloads the loaded page. The industry filter runs in the browser until the
pipeline API gains the `industry` filter (B3). `?scout=<id>` shows the runs of one Scout.

Open a run to reach the **Job › Overview**: the *Pipeline progress* card shows the five
stages (Finding → Finalizing) with their durations and facts, the counters (seeds,
sections, pages, links, articles, summaries, companies, signals), the cost so far with
tokens, the elapsed time with the deadline and the task counts; it refreshes every 5 s
("Live · refreshed N s ago") until the job is terminal. Below it: the **Site runs**
table (*Work items* opens the discovery work of one site, *Exploration* how the
Sections agent explored it, with the transcript when one was saved), **Cost by stage**
from the model-call ledger (plus the proxy traffic) and the **Settings** saved with the
job.

The results tabs come first — **Signals**, **Companies** (one row per mention; switch to
*One row per company* for the job's company flags), **Summaries** (the analysis of each
article; *Record* opens the full row and, on demand, the raw record JSON) and
**Articles** (*Saved text* streams the stored text; a 410 means it expired) — then the
operations tabs **Site runs** (with the finder's judged sources and ranking for
location jobs), **Sections**, **Tasks** and **Events** (as the API pages them: oldest
first). Every tab keeps its filters, density, columns and page in the URL, so a link
reproduces exactly what you see, and *Export CSV* downloads the matching
`/v1/jobs/{id}/export/<table>.csv`.

## 6. Retry a dead task / resume a partial run

A task that failed `max_attempts` times is **dead**; the job then finishes as *partial*.
On the job's **Tasks** tab (`/jobs/<id>/tasks`) the status chips count the tasks, the
table shows them as a tree (`parent_task_id`; untick *Show as tree* for a flat list
sorted by id) and dead rows carry a red last error and a tonal **Retry** button
(operators only). *Details* opens the task's payload, result and error. **Retry all
dead** re-queues every dead task of the job in one go (`POST /app/jobs/{id}/retry-dead`:
forwarded to the pipeline when it has the route, otherwise one `POST /v1/tasks/{id}/retry`
per dead task — tasks that changed state meanwhile are reported as skipped). A retry
resets the attempts to 0; the job returns to *analysing*.

A *partial* (or failed / cancelled) job is **resumed** from the Runs row (`[↺ Resume]`)
or the job header: the dialog takes the resume options of the API — a new site timeout,
the memory mode, *re-analyse every article*, *re-run enrichment* and *refetch dead
articles* — and leaves the saved settings alone when a field is empty. **Cancel** (Runs
row or `Cancel run` in the header) asks for confirmation; running tasks stop after their
current step and the run can be resumed later.

## 7. Scouts

A Scout is a saved setup — county and state, the location phrase for the finder, the
industries, where the sites come from (the finder or your curated Data Sources) and the
settings overrides — that you run again and again from **Jobs › Scouts**
(`/jobs/scouts`). Operators and admins can create and run Scouts; viewers see the list.

1. **Create one.** Fill in **Jobs › New run**, tick *Save as Scout*, give it a name and
   create the jobs (`New Scout` in the Jobs header opens the form with the box already
   ticked). Names are unique; `409 scout_exists` means the name is taken, archived
   Scouts included.
2. **Run it.** `Run` on the Scout row shows "This will create N jobs for …": one API job
   per industry for location Scouts, a single job for site-URL and seed Scouts. The jobs
   are created with `client_reference = ui:<batch id>:<industry slug>` (`:0` for the
   single-job kinds), so they stay linked to the Scout and to each other. The toast's
   *View runs* opens `/jobs?scout=<id>`; the Runs list shows a "batch n of N" chip on
   each job. A leg the API rejects (for example `422`) is recorded on the batch with its
   error and the other legs still run; when the API cannot be reached at all the run
   answers `502 pipeline_api_unavailable` and nothing is created.
3. **Read the row.** *Sources* reads "Finder · top N sites" (the `sites` setting) or
   "N seeds from Data Sources" (the active sources matching the county, state and any of
   the Scout's industries at that moment — new sources are picked up automatically).
   *Last run* is the status of the newest batch (the furthest stage while any job runs;
   Completed / Partial / Failed once all finished) with its age; *Runs* counts the
   batches; *Signals (last run)* sums the jobs' signal counts (refreshed every 30 s).
4. **Edit, duplicate, archive.** `Edit` (and the name link) opens the form with the
   Scout loaded (`/jobs/new?scout=<id>`); the ⋯ menu offers *View runs*, *Duplicate*
   (`…&duplicate=1`, a copy to save under a new name) and *Archive*. Archiving hides the
   Scout (`DELETE /app/scouts/{id}` keeps the row with `archived_at`); its runs stay
   under Runs and `GET /app/scouts?archived=true` still lists it.
5. **Seed Scouts need sources.** A seed Scout with no active source for its county and
   state answers `422 no_active_sources`: add or restore a source first (section 8).

From a script, the same calls are `POST /app/scouts` (`ScoutInput`),
`POST /app/scouts/{id}/run`, `GET /app/scouts/{id}/jobs` (the jobs of the last 10
batches, newest first) and `POST /app/batches` for a one-off fan-out without a Scout;
every call needs the session cookie plus `X-Requested-With: scout` and `X-CSRF-Token`.

## 8. Data Sources

**Data Sources** (`/sources`) is the curated list of local news sites per county and
state. Seed runs (New run › *Seeds from Data Sources*, seed Scouts, the ⋯ › *Run a seed
job* on a row) explore exactly these sites; the finder never needs them but keeps
suggesting new ones. Operators and admins curate; viewers read and export.

1. **Add a site.** `Add source`: name, URL (`https://` is added when missing; the domain
   is the host without `www.`), county (with or without the word "County"), state
   (2-letter code or full name) and optional industries from the NAICS catalog — leave
   industries empty to match every industry. A domain can be listed once per county
   and state (`409 source_exists`).
2. **Import a CSV.** `Import CSV` takes a file with the header
   `name,url,county,state,industries` (any column order; `industries` optional and
   `;`-separated, for example `Construction;Manufacturing`; states as codes or names):

   ```csv
   name,url,county,state,industries
   Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction;Manufacturing
   Range Wire,https://rangewire.com,Jefferson,CO,Construction
   ```

   Limits: 1 MB and 2,000 rows. The result lists what was imported and every skipped
   row with its line number and reason (missing name or county, invalid URL, unknown
   state, duplicate inside the file, already listed for that county and state).
   Imported rows carry the origin `csv`; *Download the CSV template* in the dialog gives
   the header line to start from.
3. **Promote a finder suggestion.** The card *Suggested by the finder* lists domains the
   finder kept recently that are not in your list: the judged-domain memory with the
   verdict `keep` (for "<County> County, <State>" and "<County>, <ST>") and the rankings
   of the last five location-industry jobs of that county and state (chosen or not, with
   tier and rank), de-duplicated by domain and refreshed every minute. *Add to sources*
   opens the dialog pre-filled; the source keeps the finder's tier, rank, reason, judged
   date and job as its `finder` facts (origin `finder`). *Dismiss* hides a domain for
   that county and state for good (`ui.dismissed_suggestions`). The State / County /
   Industry filters of the toolbar narrow the suggestions too.
4. **Remove and restore.** `Remove` is a soft delete: the row keeps its history under
   *Status: removed* and `Restore` brings it back. Removed sources are never seeded.
5. **Precision.** "Precision · last run" (accepted articles ÷ candidate links of the
   latest job that used the site) and the *Median precision* tile need the pipeline's
   `GET /v1/sources/stats` (PR B2). Until it is deployed the column shows "—" with the
   note "needs pipeline API update (B2)"; everything else works.
6. **Export.** `Export CSV` downloads the rows currently listed (filters applied) with
   their industries, origin, finder facts and precision.

Scripts use `GET /app/sources?county=&state=&industry=&origin=&status=active|removed|all&q=`,
`POST /app/sources`, `PATCH`/`DELETE /app/sources/{id}`, `POST /app/sources/{id}/restore`,
`POST /app/sources/import` (multipart `file`), `GET /app/sources/suggestions?county=&state=&industry=&limit=`,
`POST /app/sources/promote` and `POST /app/sources/dismiss`.

## 9. Signals explorer and saved views

**Signals** (`/signals`) lists every signal across jobs with the evidence behind it. The
same table, columns and drawer serve a single run's **Signals** tab (`/jobs/<id>/signals`).

**Find signals.**
1. Open **Signals** in the sidebar. The table is sorted by article date (newest first);
   each row shows the company, the signal with its materiality and confidence, the verbatim
   evidence, the HQ city/state, the company industry and revenue bin, the job's location
   and the job id (click it to open the run).
2. Type in the search box to match company names, evidence, signal titles or domains.
3. Click **+ Add filter** and pick a field: state, county, job industry, company industry,
   signal (the catalog of `signals.json`), materiality, revenue bin, org kind, HQ scope, a
   date range (with "Last 7 days" / "Last 30 days" presets), a job id, a company key or a
   batch id. Every active filter becomes a chip; click a chip's × to drop it, **Clear all**
   to start over. Filters, the open drawer, the page and the columns live in the URL, so
   the address bar is a shareable link.
4. The line at the right of the chips ("128 signals · 61 companies · 9 jobs") and the
   **By materiality** strip (split bar, counts, top signal) describe the whole filtered
   set, not only the page.
5. Use the two icon buttons at the right of the toolbar to switch **compact rows** and to
   **choose columns** (HQ scope, article source and the job columns are available on both
   screens; the chooser remembers the choice in the URL).

**Read a signal.** Click a company name, a row or the › at the end of a row. The drawer
shows the verbatim evidence with its checks (verbatim match, name grounded), the role and
the confidence meter; the article (title link, domain, publication date, when the run
accepted it, the article id, the main idea of the summary) with **Open article** (new tab),
**Saved text** (the text the pipeline saved; "expired" when the artifact retention removed
it) and **Summary record** (the full analysis record); the company profile from the
enrichment flags (org kind, HQ scope, entity flag, industry, revenue bin, enrichment source)
with **Across jobs** counts and **Open profile** (that company's signals across runs); and
the job with its status. **Copy link** copies the drawer's URL, **Export row** downloads
that one signal as CSV, **‹ ›** step through the loaded rows, `Esc` closes.

**Export.** **Export CSV** in the header downloads the filtered set
(`/app/signals/export.csv?…`, the pipeline `signals.csv` columns plus
`job_id, county, state, job_industry`). On a run's Signals tab, **signals.csv** downloads
that run's table straight from the pipeline API.

**Saved views.**
1. Set the filters and columns you want, click **Save view**, give it a name and tick
   **Share with everyone** if the whole team should see it. The view is stored by the
   console (`ui.saved_views`); names are unique per account and screen.
2. Pick a view from **View: …** in the toolbar to apply it (`?view=<id>` in the URL);
   changing a filter afterwards detaches the URL from the view again.
3. **Manage views…** (last entry of the select) renames, shares/unshares and deletes views.
   Only the owner (or an admin) can change a view; shared views are read-only for others.

**Until the pipeline's cross-job read (B1) is deployed** the console shows a note: the
explorer merges the signals of the 20 most recent runs that match the state, county, job
industry, job or batch filters (30 s cache; a run with more than 1,000 signals is cut at
1,000 and flagged). Older runs stay reachable through their own Signals tab or by filtering
on their job id. Once `GET /v1/signals` exists the note disappears on the next capability
probe (`GET /app/capabilities`) without a redeploy.

## 10. Settings

**Settings** holds API keys (admin), Workers & health, Stats & costs, Exports, System,
Preferences and Users. <!-- feature agent: fill -->

## 11. Upgrade, rotate keys, back up the `ui` schema

**Upgrade the console.**

```bash
git -C ../multi-agent-articles-ui pull            # or checkout the release tag
# optional: UI_IMAGE_TAG=0.1.0 in .env to name the image after the release
dcu build ui                                      # one image for ui and ui_migrate
dcu up -d ui_migrate ui                           # applies new migrations, restarts the BFF
dcu logs --since 2m ui_migrate ui
curl --fail http://127.0.0.1:8080/readyz
```

Migrations are additive and `ui_migrate` is idempotent, so re-running it is always
safe. Users stay signed in across an upgrade (sessions live in `ui.sessions`) unless
`SESSION_SECRET` changed.

**Rotate the pipeline API keys** (no downtime: old and new keys overlap).

```bash
curl -sS -X POST http://127.0.0.1:8000/v1/api-keys -H "X-API-Key: $OPERATOR_KEY" \
     -H "Content-Type: application/json" -d '{"name": "scout-ui-operator-2026-10", "role": "operator"}'
curl -sS -X POST http://127.0.0.1:8000/v1/api-keys -H "X-API-Key: $OPERATOR_KEY" \
     -H "Content-Type: application/json" -d '{"name": "scout-ui-reader-2026-10", "role": "reader"}'
# put the two new keys into .env (PIPELINE_OPERATOR_KEY / PIPELINE_READER_KEY), then:
dcu up -d ui
curl -sS -X DELETE http://127.0.0.1:8000/v1/api-keys/scout-ui-operator -H "X-API-Key: $OPERATOR_KEY"
curl -sS -X DELETE http://127.0.0.1:8000/v1/api-keys/scout-ui-reader -H "X-API-Key: $OPERATOR_KEY"
```

(An admin can do the same from Settings › API keys once that screen exists; listing
existing keys needs the pipeline update B4.)

**Rotate `SESSION_SECRET`.** Set a new `openssl rand -hex 32` value and `dcu up -d ui`.
Every user is signed out and signs in again; nothing else changes.

**Rotate the `app_ui` database password.** Set a new `UI_DATABASE_PASSWORD`, then
`dcu up -d ui_migrate ui` — bootstrap alters the role to the new password before the
BFF restarts with it.

**Back up the `ui` schema.** The pipeline's maintenance worker already dumps the whole
database daily (its backup includes schema `ui`). For a UI-only snapshot before a risky
change:

```bash
dcu exec -T postgres pg_dump -U article_owner -d article_pipeline -n ui -Fc \
    > ui-$(date +%F).dump
```

**Restore the `ui` schema** (only the UI's own data — users, sessions, scouts, batches,
sources, views, preferences, audit log; pipeline results are untouched):

```bash
dcu stop ui
dcu exec -T postgres pg_restore -U article_owner -d article_pipeline --clean --if-exists \
    --no-owner --no-privileges -n ui < ui-2026-10-04.dump
dcu up -d ui_migrate ui          # re-applies grants to svc_ui/app_ui and confirms the migration head
```

## 12. Develop without Docker

**SPA only (mock mode).** No backend at all; the SPA runs on MSW fixtures shaped like
the mockup:

```bash
cd web && pnpm install --frozen-lockfile && pnpm dev:mock      # http://localhost:5173
# sign in with admin@sympera.ai / scout-admin or viewer@sympera.ai / scout-viewer
```

**SPA + local BFF against the pipeline's Postgres and API.** Start `postgres` and `api`
from the pipeline repo (`docker compose up -d postgres api` — ports 5432 and 8000 are
bound to 127.0.0.1), then at the root of this repo:

```bash
cp .env.ui.example .env.ui
# set: UI_DATABASE_URL=postgresql+psycopg://article_owner:<POSTGRES_PASSWORD>@127.0.0.1:5432/article_pipeline
#      UI_DATABASE_PASSWORD=<pw for app_ui>  PIPELINE_API_URL=http://127.0.0.1:8000
#      PIPELINE_OPERATOR_KEY / PIPELINE_READER_KEY (section 2)  SESSION_SECRET=<32+ chars>
#      UI_BOOTSTRAP_ADMIN_EMAIL / _PASSWORD  UI_SECURE_COOKIES=false  LOG_FORMAT=console
uv sync --frozen
uv run python -m scout_bff.bootstrap            # schema ui, roles, migrations, first admin (owner URL)
# now switch UI_DATABASE_URL in .env.ui to postgresql+psycopg://app_ui:<pw>@127.0.0.1:5432/article_pipeline
uv run uvicorn scout_bff.app:app --reload --port 8080
cd web && pnpm dev                              # proxies /app, /v1, /healthz, /readyz to :8080
```

Checks before a commit: `cd web && pnpm check && pnpm build` (and `pnpm e2e` when routes
change); at the root `uv run ruff check . && uv run ruff format --check .`,
`uv run lint-imports`, `uv run pytest -q` (integration tests need
`UI_TEST_DATABASE_URL` pointing at a disposable database, for example
`postgresql+psycopg://scout_test:scout_test@localhost:5432/scout_test`).

## 13. Troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| `dcu up` stops at `ui_migrate` | `dcu logs ui_migrate` | set `UI_DATABASE_PASSWORD`; make sure `POSTGRES_PASSWORD` matches the running database and the pipeline's `migrate` finished (`dcu ps`) |
| `ui` restarts in a loop | `dcu logs ui` | a required variable is missing (`PIPELINE_*_KEY`, `SESSION_SECRET` ≥ 32 chars) or `UI_DATABASE_URL` cannot log in (`UI_DATABASE_PASSWORD` changed without re-running `ui_migrate`) |
| `/readyz` → `database: fail` | `dcu exec postgres psql -U article_owner -d article_pipeline -c '\du app_ui'` | re-run `dcu up -d ui_migrate` (recreates/alters the role), then `dcu up -d ui` |
| `/readyz` → `migrations: fail` | `dcu logs ui_migrate` | re-run `ui_migrate`; the version table is `ui.alembic_version` |
| `/readyz` → `pipeline_api: fail` | `curl http://127.0.0.1:8000/readyz`; `dcu ps api` | fix the pipeline API first; the console recovers on the next probe |
| Sign-in succeeds but the next request is `401 not_authenticated` | the cookie was dropped | plain `http://` on a non-localhost address needs `UI_SECURE_COOKIES=false` (dev only) — or use the HTTPS host |
| `403 csrf_failed` | the request lacks `X-Requested-With: scout` or `X-CSRF-Token` | the SPA always sends both; scripts must copy `csrf_token` from `GET /app/auth/me` |
| `403 password_change_required` everywhere | the account must change its password | open `/account/password` |
| `429 too_many_attempts` | too many failed sign-ins | wait 15 minutes (per e-mail) / 1 hour (per IP) or have an admin reset the password |
| `503 pipeline_api_unavailable` | `PIPELINE_API_URL`, `dcu ps api` | the API is down or unreachable from the `ui` container (connect timeout 5 s, 3 retries on GET) |
| `404 not_proxied` | the path or method is not in the `/v1` allowlist | only the pipeline routes listed in `docs/api/pipeline-routes.txt` are proxied, with role checks |
| Note "needs pipeline API update (B1…B4)" | `GET /app/capabilities` | expected until the backend PRs land; the screen works in degraded mode (`README.md` › Troubleshooting) |
| Caddy fails to start | `dcu logs caddy` | the pipeline's Caddyfile imports `/etc/caddy/Caddyfile.ui` but the project was started without `compose.ui.yaml`; start with both files or use `import /etc/caddy/Caddyfile.ui*` |
| Browser warns about the certificate on `scout.localhost` | Caddy's internal CA | expected for `*.localhost`; use a real hostname with DNS pointing at the machine for Let's Encrypt |
| Where are the logs? | `dcu logs -f ui` | one JSON line per request / proxied call: `user_id, role, method, path, status, duration_ms` — never a key |
