# Sympera Scout — operator how-tos

Task-by-task instructions, Docker first. Every command below runs on the machine that
hosts the pipeline, from the **pipeline repository** (the folder with its
`compose.yaml`), with this repository checked out as the sibling folder
`../multi-agent-articles-ui`. To keep the lines short:

```bash
alias dcu='docker compose --env-file .env.platform -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml'
```

Button, tab and field names below are written as they appear in the console.

## 1. Install and first run (Docker)

1. Make sure the pipeline itself runs: `docker compose --env-file .env.platform up -d` in the pipeline repo and
   `curl --fail http://127.0.0.1:8000/readyz` answers `{"status":"ready",…}`.
2. Create the two pipeline API keys for the console (section 2).
3. Append the UI variables to the pipeline's `.env.platform`. Copy the uncommented lines of
   [the shared backend template](../multi-agent-article/.env.platform.example) and fill them:

   ```bash
   UI_DATABASE_PASSWORD=$(openssl rand -hex 24)
   PIPELINE_OPERATOR_KEY=sympera_…           # from section 2
   PIPELINE_READER_KEY=sympera_…             # from section 2
   SESSION_SECRET=$(openssl rand -hex 32)
   UI_BOOTSTRAP_ADMIN_EMAIL=you@sympera.ai
   UI_BOOTSTRAP_ADMIN_PASSWORD=<temporary password, at least 12 characters>
   UI_SECURE_COOKIES=false
   UI_PUBLIC_URL=http://localhost:8080
   ```

4. Set `UI_SECURE_COOKIES=false` and `UI_PUBLIC_URL=http://localhost:8080` for
   local HTTP. Caddy is optional; no Caddy change is required.
5. Validate, build and start:

   ```bash
   dcu config --quiet
   dcu up -d --build
   dcu ps
   curl --fail http://localhost:8080/readyz
   ```

6. Open `http://localhost:8080` and continue with section 3.

If `ui_migrate` exits non-zero, read `dcu logs ui_migrate`: the usual causes are a
missing `UI_DATABASE_PASSWORD`, a `POSTGRES_PASSWORD` that does not match the running
database, or the pipeline's own `migrate` service not having completed.

## 2. Create the pipeline API keys for the UI

The console never holds a key in the browser. The BFF uses two pipeline keys chosen by
the signed-in user's role: `admin` and `operator` users act with the **operator** key,
`viewer` users with the **reader** key. Create both once with the pipeline's bootstrap
key (`API_BOOTSTRAP_KEY` in the pipeline's `.env.platform`; see the pipeline README, "Platform
operation › Start and inspect"):

```bash
export API_BOOTSTRAP_KEY=…   # from the pipeline's .env.platform
curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
     -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
     -d '{"name": "scout-ui-operator", "role": "operator"}'
curl -sS -X POST http://127.0.0.1:8000/v1/api-keys \
     -H "X-API-Key: $API_BOOTSTRAP_KEY" -H "Content-Type: application/json" \
     -d '{"name": "scout-ui-reader", "role": "reader"}'
```

Each call answers `201 {"id", "name", "role", "created_at", "key"}`; the `key` is shown
exactly once — copy it into `PIPELINE_OPERATOR_KEY` / `PIPELINE_READER_KEY`. Key names
match `A–Z a–z 0–9 _ . -` and are unique: a `409` means the name is taken — pick another
name or revoke the old key first (`curl -X DELETE …/v1/api-keys/scout-ui-operator`).
Rotation is in section 11.

## 3. Sign in, change the bootstrap password, add users

1. Open the console and sign in (**E-mail**, **Password**, **Sign in**) with
   `UI_BOOTSTRAP_ADMIN_EMAIL` / `UI_BOOTSTRAP_ADMIN_PASSWORD`. The bootstrap account is
   created with `must_change_password = true`, so you land on `/account/password`
   ("Choose a new password"): fill **Current password** (the temporary one), **New
   password** (at least 12 characters) and **Repeat new password**, then **Change
   password**. Until you do, every other page answers `403 password_change_required`.
   Later password changes: account menu (sidebar footer) › **Change password**.
2. Remove `UI_BOOTSTRAP_ADMIN_PASSWORD` from `.env.platform` (it is only read while `ui.users`
   is empty).
3. Add colleagues under **Settings › Users** (`/settings/users`, the tab appears for
   admins only): **Create user** → **E-mail**, **Name**, **Role** and **Temporary
   password** (at least 12 characters) → **Create user**. The account is created with
   `must_change_password`, so the colleague signs in once with the temporary password
   and is taken to `/account/password`. Roles: `viewer` (read everything, download
   per-job CSVs), `operator` (viewer + create runs, cancel/resume/retry, Scouts, Data
   Sources, dataset exports), `admin` (operator + users, pipeline API keys).
   - **Edit** changes the name or the role (**Save changes**); **Reset password** sets a
     new temporary password, forces a change at the next sign-in and ends the user's
     other sessions; **Disable** (confirm with **Disable user**) signs the account out
     everywhere and blocks sign-in until **Enable**.
   - The BFF refuses to disable or demote the account you are signed in with
     (`409 self_protection`), so there is always one working admin; the Disable button
     is greyed out on your own row.
   - The table shows the role tag, creation date, last login and the state (Active /
     Disabled, plus a "must change password" tag until the first password change).
4. Rate limits protect sign-in: 10 failed attempts per e-mail in 15 minutes or 60 per
   IP per hour answer `429 too_many_attempts`; wait or have an admin reset the password.
   Sessions expire after 12 hours idle or 7 days; **Sign out** (account menu in the
   sidebar footer) ends one immediately.

Preferences (theme, density, UTC or local time, landing page) are per user under
Settings › Preferences (section 10.6).

## 4. Launch a run

Runs are created from **Jobs › New run** (`/jobs/new`; operators and admins only — viewers
do not see the button). One form covers the three job kinds of the pipeline API:

1. **Mode** — the toggle group "How should the pipeline find articles?" at the top of the
   *Target* card: **Location + industries**, **Site URL** or **Seeds from Data Sources**.
   - *Location + industries* — the finder searches the web for local news sites per
     industry and explores the top `sites` of each. Choose the **State**, type the
     **County** (always required: HQ scope and entity flags are derived relative to it),
     check the **Location phrase for the finder** (pre-filled as "Orange County, FL"
     from the county and state; edit it if the local press uses another name) and add
     **Industries** from the NAICS catalog (type in "Add an industry…", pick from the
     list, Backspace on the empty input removes the last token). The *fan-out preview*
     ("This will create N jobs") lists one row per industry: **every industry becomes
     its own job**, all of them share one batch id.
   - *Site URL* — one job that explores a single site; paste its address into **Site URL**.
   - *Seeds from Data Sources* — one job whose site runs are the ticked active sources of
     that county (`/sources`); tick them one by one or use **Select all** / **Select
     none**. **Industries (optional)** only label the job.
2. **Sources** (location mode only): **Let the finder search and rank sites**, or **Use
   the curated seeds for this county** — the card shows how many active Data Sources
   match the county (and the chosen industries); the option is disabled when there is
   none. Curated seeds resolve to a `seeds` job (ADR-UI-010).
3. **Settings**: **Hide advanced** / **Show advanced** toggles the grid — **Days to look
   back**, **Sites per job**, **Site timeout (s)** (0 = no per-site limit), **Max runtime
   (s)**, **Memory mode** (`full`, `pages_only`, `off`) and **Re-analysis** (reuse
   summaries on a matching prompt version, or re-analyse every article). The values
   shown are the platform defaults; what you see is what is saved with the job.
4. The sticky **Summary** shows the resolved **Kind**, **County · State**, **Jobs to
   create**, **Sources**, the **Prompt version** the API stamps on new jobs (that of the
   most recent job) and the **Estimated cost** per job (`GET /app/estimate`: the
   median recorded model cost of comparable completed jobs, with a p90 figure and
   excluded-incomplete-job count; "—" when there are no complete samples).
5. Tick **Save as Scout** and give it a **Scout name** to keep the setup for later runs
   (section 7); **Save Scout without running** stores it without creating jobs.
6. Press **Create N jobs**. Each leg is one `POST /v1/jobs`; a toast confirms "Created N
   jobs" and you land on **Runs**, where the jobs appear within seconds with a *batch n
   of N* chip. When a leg fails (the API refused it), the dialog "Some jobs were not
   created" lists the outcome per leg with a **Retry** for the failed ones — the created
   runs are already queued (**Stay here** / **Go to Runs**).

Shortcuts: a finished run's **Re-run** row button (completed, failed or cancelled runs)
opens the form pre-filled from that job (`/jobs/new?from=<jobId>`); a Data Source's
⋯ › **Run a seed job** opens it in Seeds mode with that source ticked
(`/jobs/new?mode=seeds&source=<id>`); a Scout's **Edit** opens it with **Run Scout**
(runs the setup *as saved*) and **Save changes**; **New Scout** in the Jobs header opens
the form with *Save as Scout* already ticked.

## 5. Watch a run and read results

**Jobs › Runs** (`/jobs`) lists every job of the API, newest first — columns **Job**,
**Status**, **Stages** (the stage bar), **Sites** (done / total), **Articles**,
**Signals**, **Cost** and **Started** (start time and duration), from
`GET /app/jobs/progress`, refreshed every 5 s while any listed run is still working,
every 30 s otherwise. The toolbar filters by **Status**, **State**, **County**,
**Industry** and **Created** (defaults to *Last 7 days*; *Custom range* opens **Created
from** / **Created until** — leave both empty to list every run), the search box narrows
all matching jobs by county, industry, domain or id before pagination. Status
**Running** means finding, exploring, discovering, analysing or finalizing. **Export
CSV** downloads the loaded Runs page. `?scout=<id>` shows one Scout's complete history.

Open a run to reach the **Job › Overview**: the **Pipeline progress** card shows the five
stages (Finding → Finalizing) with their durations and facts, the counters (seeds,
sections, pages, links, articles, summaries, companies, signals), the cost so far with
tokens, the elapsed time with the deadline and the task counts; it refreshes every 5 s
("Live · refreshed N s ago") until the job is terminal ("Final"). Below it: the **Site
runs** table (**Work items** opens the discovery work of one site, **Exploration** how
the Sections agent explored it, with the transcript when one was saved), **Cost by
stage** from the model-call ledger and the **Settings** saved with the job.

The job header carries the id with a copy button, the kind, prompt and creator, the
Scout / run / batch of the job, and the actions **Cancel run**, **Resume**, **Export
CSV** (one CSV per table) and ⋯ (**Copy job id**, **Copy link to this job**, **Open API
record**).

The results tabs come first — **Signals**, **Companies** (one row per mention; switch
**One row per company** for the job's company flags), **Summaries** (the analysis of each
article; **Record** opens the full row and, on demand, the raw record JSON) and
**Articles** (**Saved text** streams the stored text; "The saved text has expired" means
the artifact retention removed it) — then the operations tabs **Site runs** (with the
finder's judged sources and ranking for location jobs), **Sections**, **Tasks** and
**Events** (as the API pages them: oldest first). Every tab keeps its filters, density,
columns and page in the URL, so a link reproduces exactly what you see, and **Export
CSV** downloads the matching `/v1/jobs/{id}/export/<table>.csv`.

## 6. Retry a dead task / resume a partial run

A task that failed `max_attempts` times is **dead**; the job then finishes as *partial*.
On the job's **Tasks** tab (`/jobs/<id>/tasks`) the status chips count the tasks, the
table shows them as a tree (`parent_task_id`; untick **Show as tree** for a flat list
sorted by id) and dead rows carry a red last error and a tonal **Retry** button
(operators only). **Details** opens the task's payload, result and error (with its own
**Retry**). **Retry all dead** re-queues every dead task of the job in one go
(`POST /app/jobs/{id}/retry-dead`: forwarded to the pipeline when it has the route,
otherwise one `POST /v1/tasks/{id}/retry` per dead task — tasks that changed state
meanwhile are reported as skipped in the toast). A retry resets the attempts to 0; the
job returns to *analysing*.

A *partial* job is **resumed** from the Runs row (**Resume**) or the job header
(**Resume**); failed and cancelled runs resume from the row's ⋯ › **Resume with options**
or the header. The dialog "Resume this run?" takes the resume options of the API —
**Site timeout (s)**, **Memory mode**, **Re-analyse every article (reanalyze)**, **Re-run
company enrichment (reenrich)** and **Refetch dead articles (refetch_dead_articles)** —
and leaves the saved settings alone when a field is empty ("keep saved"). **Cancel**
(Runs row) or **Cancel run** (header) asks "Cancel this run?" → **Cancel run**; queued
tasks are dropped, running tasks stop after their current step and the run can be
resumed later.

## 7. Scouts

A Scout is a saved setup — county and state, the location phrase for the finder, the
industries, where the sites come from (the finder or your curated Data Sources) and the
settings overrides — that you run again and again from **Jobs › Scouts**
(`/jobs/scouts`). Operators and admins can create and run Scouts; viewers see the list.

1. **Create one.** Fill in **Jobs › New run**, tick **Save as Scout**, give it a name and
   create the jobs (**New Scout** in the Jobs header opens the form with the box already
   ticked; **Save Scout without running** stores it without a run). Names are unique;
   `409 scout_exists` means the name is taken, archived Scouts included.
2. **Run it.** **Run** on the Scout row asks "Run <name>?" — "This will create N jobs for
   <name> (<county>, <state>)…" — and **Create N jobs** starts one API job per industry
   for location Scouts, a single job for site-URL and seed Scouts. The jobs are created
   with `client_reference = ui:<batch id>:<industry slug>` (`:0` for the single-job
   kinds), so they stay linked to the Scout and to each other. The toast's **View runs**
   opens `/jobs?scout=<id>`; the Runs list shows a "batch n of N" chip on each job of a
   multi-job batch. A leg the API rejects (for example `422`) is recorded on the batch
   with its error and the other legs still run; when the API cannot be reached at all
   the run answers `502 pipeline_api_unavailable` and nothing is created.
3. **Read the row.** **Sources** reads "Finder · top N sites" (the `sites` setting) or
   "N seeds from Data Sources" (the active sources matching the county, state and any of
   the Scout's industries at that moment — new sources are picked up automatically);
   **Schedule** is always "Manual" (no scheduler yet). **Last run** is the status of the
   newest batch (the furthest stage while any job runs; Completed / Partial / Failed once
   all finished) with its age; **Runs** counts the batches; **Signals (last run)** sums
   the jobs' signal counts (refreshed every 30 s).
4. **Edit, duplicate, archive.** **Edit** (and the name link) opens the form with the
   Scout loaded (`/jobs/new?scout=<id>`) and the buttons **Run Scout** / **Save changes**;
   the ⋯ menu offers **View runs**, **Duplicate** (`…&duplicate=1` — the same setup as
   a new Scout named "<name> (copy)", with **Save as Scout** pre-checked; nothing changes
   on the original), **Edit** and **Archive** (confirm with **Archive**). Archiving hides the Scout
   (`DELETE /app/scouts/{id}` keeps the row with `archived_at`); its runs stay under
   Runs and `GET /app/scouts?archived=true` still lists it.
5. **Seed Scouts need sources.** A seed Scout with no active source for its county and
   state answers `422 no_active_sources`: add or restore a source first (section 8).

From a script, the same calls are `POST /app/scouts` (`ScoutInput`),
`POST /app/scouts/{id}/run`, `GET /app/scouts/{id}/jobs` (all matching Scout jobs, newest first) and `POST /app/batches` for a one-off fan-out without a Scout;
every call needs the session cookie plus `X-Requested-With: scout` and `X-CSRF-Token`.

## 8. Data Sources

**Data Sources** (`/sources`) is the curated list of local news sites per county and
state. Seed runs (New run › *Seeds from Data Sources*, seed Scouts, the row's ⋯ › **Run a
seed job**) explore exactly these sites; the finder never needs them but keeps
suggesting new ones. Operators and admins curate; viewers read and export. The tiles
at the top count **Active sources**, **Promoted from the finder**, **Median article acceptance rate** and **Removed**.

1. **Add a site.** **Add source** → **Name**, **URL** (`https://` is added when missing;
   the domain is the host without `www.`), **County** (with or without the word
   "County"), **State** (2-letter code or full name) and optional **Industries** from the
   NAICS catalog — leave industries empty to match every industry. A domain can be
   listed once per county and state (`409 source_exists`). The row's ⋯ menu has **Edit**
   (dialog "Edit source") and **Copy URL**.
2. **Import a CSV.** **Import CSV** ("Import sources from CSV") takes a file with the
   header `name,url,county,state,industries` (any column order; `industries` optional
   and `;`-separated, for example `Construction;Manufacturing`; states as codes or
   names), then **Import**:

   ```csv
   name,url,county,state,industries
   Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction;Manufacturing
   Range Wire,https://rangewire.com,Jefferson,CO,Construction
   ```

   Limits: 1 MB and 2,000 rows. The result lists what was imported and every skipped
   row with its line number and reason (missing name or county, invalid URL, unknown
   state, duplicate inside the file, already listed for that county and state).
   Imported rows carry the origin `csv`; **Download the CSV template** in the dialog
   gives the header line to start from.
3. **Promote a finder suggestion.** The card **Suggested by the finder** lists domains the
   finder kept recently that are not in your list: the judged-domain memory with the
   verdict `keep` (for "<County> County, <State>" and "<County>, <ST>") and the rankings
   of the last five location-industry jobs of that county and state (chosen or not, with
   tier and rank), de-duplicated by domain (candidates cached for 60 s by the console;
   listed and dismissed domains drop out at once). **Add to sources** opens the dialog
   pre-filled; the source keeps the finder's tier, rank, reason, judged date and job as
   its `finder` facts (origin `finder`). **Dismiss** hides a domain for that county and
   state for good (`ui.dismissed_suggestions`). The **State** / **County** / **Industry**
   filters of the toolbar narrow the suggestions too.
4. **Remove and restore.** **Remove** (confirm "Remove <name>?" → **Remove**) is a soft
   delete: the row keeps its history under **Status** `removed` (or `all`) and
   **Restore** brings it back. Removed sources are never seeded.
5. **Article acceptance rate.** Accepted articles divided by measured candidates
   across the site's runs in the last 30 days. If any included run has incomplete
   candidate history, the rate shows "Unavailable";
   it is not treated as zero. This is a retrieval measure, not signal accuracy.
   The median tile uses only complete measurements.
6. **Export.** **Export CSV** downloads the rows currently listed (filters applied) with
   their industries, origin, finder facts and acceptance measurements.

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
3. Click **Add filter** and pick a field: **State**, **County**, **Job industry**,
   **Company industry**, **Signal** (the catalog of `signals.json`), **Materiality**,
   **Revenue bin**, **Org kind**, **HQ scope**, **Date** (a range with the "Last 7 days" /
   "Last 30 days" presets), **Job id**, **Company key** or **Batch id**. Every active
   filter becomes a chip; click a chip's × to drop it, **Clear all** to start over.
   Filters, the open drawer, the page and the columns live in the URL, so the address
   bar is a shareable link.
4. The line at the right of the chips ("128 signals · 61 companies · 9 jobs") and the
   **By materiality** strip (split bar, counts, top signal) describe the whole filtered
   set, not only the page.
5. Use the two icon buttons at the right of the toolbar to switch **compact rows** and to
   **choose columns** (HQ scope, article source and the job columns are available on both
   screens; the chooser remembers the choice in the URL).

**Read a signal.** Click a company name, a row or the › at the end of a row. The drawer
shows the **Evidence** with its checks (verbatim match, name grounded), the role and the
confidence meter; the **Article** (title link, domain, publication date, when the run
accepted it, the article id, the main idea of the summary) with **Open article** (new
tab), **Saved text** (the text the pipeline saved; "expired" when the artifact retention
removed it) and **Summary record** (the full analysis record); the **Company profile**
from the enrichment flags (org kind, HQ scope, entity flag, industry, revenue bin,
enrichment source) with the **Across jobs** counts and **Open profile** (that company's
signals across runs); and the **Job** with its status. **Copy link** copies the drawer's
URL, **Export row** downloads that one signal as CSV, ‹ › step through the loaded rows,
`Esc` closes.

**Export.** **Export CSV** in the header downloads the filtered set
(`/app/signals/export.csv?…`, the pipeline `signals.csv` columns plus
`job_id, county, state, job_industry`). On a run's Signals tab, **signals.csv** downloads
that run's table straight from the pipeline API.

**Saved views.**
1. Set the filters and columns you want, click **Save view**, give it a name and tick
   **Share with everyone** if the whole team should see it, then **Save view**. The view
   is stored by the console (`ui.saved_views`); names are unique per account and screen.
2. Pick a view from **View: …** in the toolbar to apply it (`?view=<id>` in the URL);
   changing a filter afterwards detaches the URL from the view again.
3. **Manage views…** (last entry of the select) renames, shares/unshares and deletes views.
   Only the owner (or an admin) can change a view; shared views are read-only for others.

The explorer reads every matching job from the global pipeline API. List, summary
counts and CSV use the same filters; CSV includes all matching rows. Each row is one
signal mention within one job. A reused mention may therefore appear under several
jobs. Copied links include `detail=<mention_id>&detail_job=<job_id>` and load the exact
row even when it is outside the current page. Company profiles use the job's state
and access scope. Month-only publication dates show a month and year, without an
invented day; date filters include any matching part of that month.

## 10. Settings

**Settings** (`/settings`, opens on **Workers & health**) holds the operations and
platform pages: **API keys** · **Workers & health** · **Stats & costs** · **Exports** ·
**System** · **Preferences** and, for admins, **Users**. Everything on them comes from the
pipeline API through the BFF; rows that the API does not expose yet are marked "not
exposed by the API" rather than invented.

**Overview first.** The home page (`/`) shows four tiles — **Running jobs** (with queued /
finalizing counts and the number of Scouts behind them), **Signals · last 7 days** with
the delta against the previous 7 days, **Recorded model cost · today** with the delta
against yesterday ("—" plus a warning when a call lacked pricing), and **Dead tasks**
with the number new since yesterday — then **Active runs** (link to each job, batch tag,
stages, sites, signals, cost), **Recent signals** (the five newest; each opens the
explorer drawer), the **Needs attention** card (dead tasks → the job's Tasks tab,
partial and failed runs of the last 7 days → the job, slow or missing worker heartbeats
→ the worker's row, and "Pipeline API is not ready" → System) and the **Workers** by
role. Tiles refresh every 30 s, runs and attention every 5 s; **Refresh** refetches
everything at once.

### 10.1 API keys (`/settings/keys`, admin)

1. **Create key** → dialog "Create API key": **Name** (`A–Z a–z 0–9 _ . -`, unique) and
   **Role** (`reader` for GET routes and per-job CSVs, `operator` for mutations) →
   **Create key**.
2. The dialog "Key created" shows the plaintext **once**: copy it with the copy button
   and store it before clicking **I stored it**. It is never shown again and never
   stored in browser storage.
3. **Revoke** (any key, by name) → "Revoke key <name>?" → **Revoke key**. Clients using
   the key lose access at once.
4. The paginated table reads the server's key inventory. Operators and viewers see
   an explanation instead of inventory or controls. The console's own two keys are
   rotated through `.env.platform` (section 2).

### 10.2 Workers & health (`/settings/workers`)

- **Health tiles.** **API** (Database, Artifact store and Migrations checks plus the
  pipeline version, from the pipeline's `/readyz` and `/openapi.json`), **Proxy** (from
  the crawl workers' `proxy_ok` / `proxy_checked_at`: "US exit verified" when every
  checked crawl worker is ok; zone and traffic are "not exposed by the API"), **Queue**
  (Queued, Running, Failed · retrying, Dead — from the complete global task list;
  **Open dead tasks** lists the partial runs) and **Storage** (every row "not exposed by the API").
- **Workers table.** One row per instance: role, version, started, last heartbeat
  (amber "Slow heartbeat" after 30 s, red "Missing" after 90 s, "Gone" once the
  pipeline retires it), current tasks, proxy and status. **Logs** and **Drain** are
  shown but inert — the pipeline API has no route for them. A link of the form
  `/settings/workers#<instance_id>` (the Overview's attention items use it)
  highlights and scrolls to that row.
- **Dead tasks by category** sums the `failures` of `GET /v1/stats/daily` over the
  last 7 days; **Maintenance schedule** is the plan's static table (sweep_jobs 60 s,
  expire_artifacts hourly, purge_work_items daily 03:00 UTC, backup_database daily
  02:00 UTC, export_dataset on demand) — results are not exposed ("result not
  exposed"), check the maintenance worker's logs.

### 10.3 Stats & costs (`/settings/stats`)

Three 14-day sparklines (**Jobs**, **Signals**, **Recorded model cost**) over the daily
table of `GET /v1/stats/daily`, newest first: jobs, site runs, articles, companies,
signals, tokens in/out, cost (an **incomplete** tag marks days with unpriced calls — the
figure is the known cost) and a **failures** disclosure with the categories. **Load
more** follows the API's cursor 30 days at a time; **Export CSV** downloads the loaded
rows (every column, failures as `category: n; …`).

### 10.4 Exports (`/settings/exports`)

- **Per-job CSVs** (sources, site ranking, chosen seeds, sections, pages, links,
  articles, summaries, companies, signals, company flags) download instantly from the
  job header's **Export CSV** menu — any role.
- **Dataset export** (operators): tick the tables, optionally filter by state,
  county, job statuses and creation range, then **Start export** →
  `POST /v1/exports`. The export id is remembered in this browser and the table
  below polls `GET /v1/exports/{id}` every 5 s while it is queued or running; a
  **Download** link appears when the file is ready (served through the console, so
  no pipeline key is needed) and "expired" once the artifact store retired it. The
  × button forgets a row; the API keeps no list of exports.

### 10.5 System (`/settings/system`)

Versions and readiness in two cards (**Scout BFF**: version, Alembic head, start time,
last capability probe; **Pipeline API**: host, Ready / Not ready pill, version, prompt
version of the most recent job, every `/readyz` check), the table **Required pipeline
routes** with what each provides,
and the list **Not exposed by the pipeline API yet** (model prices, proxy zone and
traffic, storage, maintenance results). **Refresh** re-reads the pipeline; the
capability probe itself runs at startup and every `UI_CAPABILITY_REFRESH_SECONDS`
(default 300 s). The browser refreshes the capability map every 30 seconds.
Contract version 1 and authenticated key reads are required for readiness.

### 10.6 Preferences (`/settings/preferences`)

**Theme** (System / Light / Dark), **Density** (Comfortable / Compact rows), **Time
display** (UTC with the local time in tooltips, or Local) and the **Landing page** after
sign-in (Overview, Jobs › Runs or Signals). Every choice applies immediately, is saved
to your account (`PUT /app/prefs`) and confirmed with a toast; it follows you to any
browser you sign in from.

### 10.7 Users (`/settings/users`, admin)

See section 3.

## 11. Upgrade, rotate keys, back up the `ui` schema

**Upgrade the console.**

```bash
git -C ../multi-agent-articles-ui pull            # or checkout the release tag
# optional: UI_IMAGE_TAG=2.1.0 in .env.platform to name the image after the release
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
# put the two new keys into .env.platform (PIPELINE_OPERATOR_KEY / PIPELINE_READER_KEY), then:
dcu up -d ui
curl -sS -X DELETE http://127.0.0.1:8000/v1/api-keys/scout-ui-operator -H "X-API-Key: $OPERATOR_KEY"
curl -sS -X DELETE http://127.0.0.1:8000/v1/api-keys/scout-ui-reader -H "X-API-Key: $OPERATOR_KEY"
```

An admin can list, create and revoke the same keys from Settings › API keys (section 10.1).

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

## 12. Local development and checks

Use **Node 22**, pnpm 10 and Python 3.12. Local Docker is the integration setup in
section 1. To edit the frontend against that stack:

```bash
cd web
pnpm install --frozen-lockfile
pnpm dev                         # localhost:5173 proxies to the BFF on localhost:8080
```

For isolated UI development, use `pnpm dev:mock`. The MSW fixture accounts are
`admin@sympera.ai / scout-admin`, `operator@sympera.ai / scout-operator`,
`viewer@sympera.ai / scout-viewer`, and `newcomer@sympera.ai / scout-newcomer`.

Bare BFF processes automatically read the sibling pipeline `.env.platform`.
`PLATFORM_ENV_FILE=/absolute/path/.env.platform` overrides that path; process
variables take precedence. `.env` and `.env.ui` are not read. Bootstrap needs an
owner `UI_DATABASE_URL`; the running BFF needs the restricted `app_ui` login. Docker
sets these separately, so no manual URL swap is needed.

```bash
cd web
pnpm check
pnpm build
pnpm e2e                        # isolated browser/axe tests against preview:mock
```

At the UI repository root run `uv run ruff check .`, `uv run ruff format --check .`,
`uv run lint-imports` and `uv run pytest -q`. Database tests use a disposable
`UI_TEST_DATABASE_URL`. The separate combined acceptance harness supplies its own
local database, real API/BFF and deterministic saved articles; it does not run models
or crawl external websites. Never point that harness at normal pipeline data.

## 13. Troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| `dcu up` stops at `ui_migrate` | `dcu logs ui_migrate` | set `UI_DATABASE_PASSWORD`; make sure `POSTGRES_PASSWORD` matches the running database and the pipeline's `migrate` finished (`dcu ps`) |
| `ui` restarts in a loop | `dcu logs ui` | a required variable is missing (`PIPELINE_*_KEY`, `SESSION_SECRET` ≥ 32 chars) or `UI_DATABASE_URL` cannot log in (`UI_DATABASE_PASSWORD` changed without re-running `ui_migrate`) |
| `/readyz` → `database: false` | `dcu exec postgres psql -U article_owner -d article_pipeline -c '\du app_ui'` | re-run `dcu up -d ui_migrate` (recreates/alters the role), then `dcu up -d ui` |
| `/readyz` → `migrations: false` | `dcu logs ui_migrate` | re-run `ui_migrate`; the version table is `ui.alembic_version` |
| `/readyz` → `pipeline_api: false` | `curl http://127.0.0.1:8000/readyz`; `dcu ps api` | fix the pipeline API first; the console recovers on the next probe |
| Sign-in succeeds but the next request is `401 not_authenticated` | the cookie was dropped | plain `http://` on a non-localhost address needs `UI_SECURE_COOKIES=false` (dev only) — or use the HTTPS host |
| `403 csrf_failed` | the request lacks `X-Requested-With: scout` or `X-CSRF-Token` | the SPA always sends both; scripts must copy `csrf_token` from `GET /app/auth/me` |
| `403 password_change_required` everywhere | the account must change its password | open `/account/password` |
| `429 too_many_attempts` | too many failed sign-ins | wait 15 minutes (per e-mail) / 1 hour (per IP) or have an admin reset the password |
| `503 pipeline_api_unavailable` / `504 pipeline_api_timeout` | `PIPELINE_API_URL`, `dcu ps api` | the API is down or unreachable from the `ui` container (connect timeout 5 s, 3 attempts on GET) or did not answer within 30 s |
| `404 not_proxied` | the path or method is not in the `/v1` allowlist | only the pipeline routes listed in `docs/api/pipeline-routes.txt` are proxied, with role checks |
| Contract unavailable | `GET /app/capabilities`, Settings › System | use matching contract version 1 backend/UI and valid operator/reader keys; no limited-results fallback |
| Where are the logs? | `dcu logs -f ui` | one JSON line per request / proxied call: `user_id, role, method, path, status, duration_ms` — never a key |

### Website access policies (`/settings/access-policies`)

Operators and admins can inspect learned bot blocks and subscription requirements.
After website access changes, choose **Reset** and confirm **Reset policy**. The next
retrieval evaluates access again; resetting does not grant access to restricted
content. Viewers cannot read or reset this inventory.

### Counts and costs

Daily articles, companies and signals count first stored objects. A later job that
reuses one does not create another daily stored-object count. The global Signals
explorer counts rows per job, so its total can differ. **Recorded model cost** excludes
proxy transfer fees. Estimates use comparable completed jobs with complete recorded
costs and report how many incomplete jobs were excluded.
