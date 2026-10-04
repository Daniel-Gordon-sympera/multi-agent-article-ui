# Sympera Scout — operations runbook

For the person on duty. Assumes the Docker deployment of `README.md` (the pipeline's
Compose project with `compose.ui.yaml`), run from the pipeline repository with

```bash
alias dcu='docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml'
```

Operator tasks (first run, users, runs, upgrades) are in `HOWTO.md`; this file covers
health, logs, sessions, the audit log, retention, secret rotation, recovery and the
optional pipeline capabilities. Facts below are taken from the BFF modules named in
each section.

## 1. What runs where

| Service | Image | Role | Port | Depends on |
|---|---|---|---|---|
| `ui_migrate` | `scout-ui:${UI_IMAGE_TAG}` | one-shot: schema `ui`, roles, Alembic head, bootstrap admin (`bootstrap.py`) | — | `postgres` healthy, pipeline `migrate` completed |
| `ui` | `scout-ui:${UI_IMAGE_TAG}` | FastAPI BFF: static SPA, `/app/*`, `/v1/*` proxy, `/healthz`, `/readyz` | `127.0.0.1:${UI_PORT:-8080}` → 8080 | `ui_migrate` completed, `api` healthy |
| `caddy` (pipeline's) | `caddy:2` | TLS + reverse proxy for `${API_DOMAIN}` → `api:8000` and `${UI_DOMAIN}` → `ui:8080` | 80, 443 | `api`, `ui` |

The container runs as UID 10001, the application tree is read-only, logs go to stdout
(json-file driver, 50 MB × 5). The BFF connects to PostgreSQL as `app_ui` (pool of
`UI_DB_POOL_SIZE` connections, default 5, 30 s statement timeout) and to the pipeline
API at `http://api:8000` with the two keys from the environment. Two background tasks
start with the process: the capability probe (section 10) and the hourly retention
purge (section 6).

## 2. Health checks

```bash
curl -sS http://127.0.0.1:8080/healthz            # {"status":"ok"} — process up, no dependencies checked
curl -sS http://127.0.0.1:8080/readyz | jq        # {"status":"ready"|"not_ready","checks":{"database":bool,"migrations":bool,"pipeline_api":bool}}; 503 when not ready
curl -sS http://127.0.0.1:8000/readyz | jq        # the pipeline API's own readiness (database, artifact_store, migrations)
dcu ps                                            # ui should be "healthy" (Compose healthcheck polls /readyz every 10 s)
```

| `checks.*` false | Meaning (`app.py`, `db.py`) | Action |
|---|---|---|
| `database` | `app_ui` cannot connect or `SELECT 1` failed | `dcu logs ui`; `dcu ps postgres`; re-run `dcu up -d ui_migrate` if the password changed |
| `migrations` | `ui.alembic_version` is missing or not at the code's head (`0001_ui_schema`) | `dcu run --rm ui_migrate` then `dcu restart ui` |
| `pipeline_api` | the API's `/readyz` did not answer `status: ready` (checked on demand by each `/readyz` call) | fix the pipeline first; the console recovers on the next check without restart |

Signed-in users see "API ready" / "API not ready" with the pipeline version and their
role tag in the sidebar footer; the Overview's **Needs attention** card lists
"Pipeline API is not ready" as a fail item (`attention/service.py`), and Settings ›
System shows every `/readyz` check of the pipeline.

## 3. Logs

```bash
dcu logs -f ui                                    # follow
dcu logs --since 30m ui | jq -r 'select(.status >= 500)'
dcu logs --since 30m ui | jq -r 'select(.path | startswith("/v1/")) | [.ts,.user_id,.role,.method,.path,.status,.duration_ms] | @tsv'
dcu logs ui_migrate                               # bootstrap output of the last run
```

Format (`logging.py`): one structlog JSON line per request (`http_request`) and per
proxied `/v1` call (`proxy_call`) with `user_id, role, method, path, status, duration_ms`,
plus `ts`, `level`, `service: ui`, `version` and a `request_id` that is also returned
to the client as the `X-Request-Id` header. `/healthz` and `/readyz` are logged at
`DEBUG`, so they do not appear at the default level. Keys, cookies, passwords, CSRF
tokens and the session secret are registered as secrets and redacted wherever they
appear (also in audit targets and problem details); URL credentials and
`Authorization` / `X-API-Key` header values are masked by pattern. `LOG_LEVEL` (default
`INFO`) and `LOG_FORMAT` (`json`; `console` for development) are environment variables —
change them in `.env` and `dcu up -d ui`. `httpx`, `httpcore`, `uvicorn.access` and
`alembic` are kept at `WARNING`.

## 4. Sessions

- Cookie `scout_session` (itsdangerous-signed session id, `HttpOnly; SameSite=Lax;
  Secure` unless `UI_SECURE_COOKIES=false`, max-age = the absolute lifetime); row in
  `ui.sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, user_agent, ip)`
  (`auth/sessions.py`). Idle expiry 12 h sliding (`UI_SESSION_IDLE_HOURS`; `last_seen_at`
  and `expires_at` are renewed at most once a minute), absolute 7 d
  (`UI_SESSION_ABSOLUTE_DAYS`) counted from `created_at`; whichever comes first wins.
  Sign-out deletes the row; a password reset or disable by an admin deletes the user's
  other sessions.
- Who is signed in right now:

  ```bash
  dcu exec postgres psql -U article_owner -d article_pipeline -c \
    "SELECT u.email, u.role, s.last_seen_at, s.expires_at, s.ip FROM ui.sessions s JOIN ui.users u ON u.id = s.user_id WHERE s.expires_at > now() ORDER BY s.last_seen_at DESC;"
  ```

- Force one user out: `DELETE FROM ui.sessions WHERE user_id = (SELECT id FROM ui.users WHERE email = '…');`
  Force everyone out: rotate `SESSION_SECRET` (section 7) or `TRUNCATE ui.sessions;`.
- Disable an account: Settings › Users (admin), or
  `UPDATE ui.users SET disabled_at = now() WHERE email = '…';` followed by deleting its sessions.
- Locked out (`429 too_many_attempts`, `auth/rate_limit.py`): 10 failures per e-mail /
  15 min, 60 per IP / h, counted in `ui.login_attempts (key, at)` with keys
  `email:<address>` and `ip:<address>`; wait (the response carries `Retry-After`), or
  clear the counter: `DELETE FROM ui.login_attempts WHERE key = 'email:<address>';`.
- No admin can sign in (forgotten password): do **not** empty `ui.users` to re-trigger the
  bootstrap admin — the audit log references user ids. Compute a new argon2id hash with
  the BFF's own helper, inside the image:

  ```bash
  dcu run --rm --no-deps --entrypoint /app/.venv/bin/python ui \
      -c 'from scout_bff.auth.passwords import hash_password; print(hash_password("<temporary password>"))'
  ```

  then `UPDATE ui.users SET password_hash = '<hash>', must_change_password = true WHERE email = '…';`
  and delete that user's sessions. The user sets a real password at the next sign-in.

## 5. Audit log

Every unsafe (`POST/PUT/PATCH/DELETE`) `/app` call and every proxied unsafe `/v1` call
inserts `ui.audit_log (at, user_id, role, method, path, target jsonb, status, duration_ms)`
after the response is sent (`audit.py`; a failing insert is logged and never fails the
call). `target` is what the route recorded (for the proxy: the upstream path), with
secret-looking keys redacted.

```sql
-- who started, cancelled, resumed or retried what in the last 24 h
SELECT a.at, u.email, a.method, a.path, a.target, a.status
FROM ui.audit_log a LEFT JOIN ui.users u ON u.id = a.user_id
WHERE a.at > now() - interval '24 hours' ORDER BY a.at DESC;
-- everything one user did to one job
SELECT at, method, path, status FROM ui.audit_log
WHERE user_id = (SELECT id FROM ui.users WHERE email = '…') AND path LIKE '%/jobs/<job_id>%' ORDER BY at;
```

Pipeline-side, each job row carries `created_by` = the name of the API key used
(`scout-ui-operator` for every console user), so the console's audit log is the only
place that names the person.

## 6. Retention

The BFF runs `retention.py` as a background task: one purge at startup, then every
hour (`PURGE_INTERVAL_SECONDS = 3600`); a database error is logged
(`retention_purge_failed`) and the loop continues. Each pass logs `retention_purge`
with the row counts removed.

| Table | Rule | Mechanism |
|---|---|---|
| `ui.sessions` | delete rows with `expires_at <= now()` | hourly task |
| `ui.login_attempts` | keep 24 h | hourly task |
| `ui.audit_log` | keep `UI_AUDIT_RETENTION_DAYS` (default 180) | hourly task |
| everything else (users, scouts, batches, sources, views, preferences) | kept | — |

To keep the audit log longer, raise `UI_AUDIT_RETENTION_DAYS` in `.env` and `dcu up -d ui`;
to archive before purging, `pg_dump -n ui -t ui.audit_log` (section 8).

## 7. Rotating secrets

| Secret | How | Effect |
|---|---|---|
| `PIPELINE_OPERATOR_KEY` / `PIPELINE_READER_KEY` | create new keys (`POST /v1/api-keys`, or Settings › API keys as an admin), update `.env`, `dcu up -d ui`, revoke the old names (`DELETE /v1/api-keys/<name>`) — HOWTO §11 | none for users; proxied calls use the new keys after the restart |
| `SESSION_SECRET` | new `openssl rand -hex 32` in `.env`, `dcu up -d ui` | every session cookie becomes invalid: all users sign in again |
| `UI_DATABASE_PASSWORD` | new value in `.env`, `dcu up -d ui_migrate ui` | bootstrap alters role `app_ui`; the BFF restarts with the new password |
| `UI_BOOTSTRAP_ADMIN_PASSWORD` | remove it from `.env` after the first sign-in | it is only read while `ui.users` is empty |
| Caddy certificates | automatic (Let's Encrypt for public hosts, internal CA for `*.localhost`) | none |

## 8. Backup and restore of schema `ui`

The pipeline's maintenance worker dumps the whole database daily (`backup_database`
task; objects expire after 14 days) and that dump contains schema `ui`. For a UI-only
snapshot (before an upgrade, before bulk edits):

```bash
dcu exec -T postgres pg_dump -U article_owner -d article_pipeline -n ui -Fc > ui-$(date +%F).dump
```

Restore into the same database (UI data only; pipeline schemas untouched):

```bash
dcu stop ui
dcu exec -T postgres pg_restore -U article_owner -d article_pipeline --clean --if-exists --no-owner --no-privileges -n ui < ui-<date>.dump
dcu up -d ui_migrate ui        # re-applies grants to svc_ui/app_ui, checks the Alembic head
curl --fail http://127.0.0.1:8080/readyz
```

Restoring the whole pipeline database from the pipeline's backup (its README, "Scale,
upgrade and recover") brings schema `ui` back as well; run `ui_migrate` afterwards so the
roles and grants exist on the new cluster (roles are cluster-level and are not in a
schema dump).

## 9. Upgrade and rollback

Upgrade: HOWTO §11 (`dcu build ui && dcu up -d ui_migrate ui`). Migrations are
additive; `ui_migrate` is idempotent (it takes an advisory lock, so two concurrent runs
cannot collide).

Rollback: set `UI_IMAGE_TAG` back to the previous release and `dcu up -d ui`. Because
migrations are additive, an older BFF runs against a newer schema. Only if a release
notes a destructive migration: `dcu run --rm --entrypoint /app/.venv/bin/python ui_migrate -m alembic downgrade <revision>`
with the owner `UI_DATABASE_URL` in the environment, then start the older image.

## 10. Optional pipeline capabilities ("needs pipeline API update")

`capabilities.py` fetches the pipeline's `/openapi.json` at startup and every
`UI_CAPABILITY_REFRESH_SECONDS` (default 300) and derives eight booleans:
`signals_global`, `tasks_global`, `retry_dead`, `api_keys_list`, `sources_stats`,
`cost_estimate`, `jobs_industry_filter`, `jobs_reference_filter` (the backend PRs
B1–B4). A failed probe yields all `false` plus `probe_error` and a
`capability_probe_failed` warning in the logs. The map is published by
`GET /app/capabilities` (signed in) and shown on Settings › System ("Optional pipeline
routes", with the probe time); `/readyz` only re-checks the pipeline's readiness, not
the capabilities.

While a capability is `false` the console uses a bounded fallback (ADR-UI-007) and says
so on the screen: the Signals explorer merges the 20 most recent matching jobs
("degraded" banner), "Retry all dead" loops over the job's dead tasks, attention and
dead-task counts come from recent jobs and daily stats, Settings › API keys lists only
the keys created in this browser, the precision column and median tile on Data Sources
read "needs pipeline API update (B2)", the cost estimate uses the last 10 completed
jobs, and the Runs industry filter applies client-side. Nothing to do on duty: once the
pipeline is upgraded, the note disappears within one probe interval (or at once with
**Refresh** on Settings › System, which re-reads the pipeline, or a `dcu restart ui`).

## 11. Capacity and polling

The SPA polls at 5 s (live screens) / 30 s (calm) per open tab, paused in background
tabs; job resources use `ETag`/`If-None-Match` and mostly return `304`. Proxy limits
(`proxy/client.py`): connect 5 s, read 30 s for JSON, no read timeout for the streamed
CSV exports, artifacts and saved article text, 3 attempts on connection errors for `GET`
only; a connection failure answers `503 pipeline_api_unavailable`, a slow response
`504 pipeline_api_timeout`. The dashboard aggregates are cached per process for 5–10 s
(ADR-UI-013). If the pipeline API shows load from the console, the first lever is a
2 s per-path micro-cache in the BFF (ADR-UI-005); the second is SSE.

## 12. Incident quick list

1. Console down → `dcu ps`, `dcu logs --since 10m ui caddy`; `dcu up -d ui`.
2. Everyone signed out unexpectedly → `SESSION_SECRET` changed or `ui.sessions` emptied;
   nothing to fix beyond signing in.
3. Runs cannot be created but reads work → the operator key was revoked or rotated
   without updating `.env` (`401` from the pipeline on `proxy_call` lines in
   `dcu logs ui`); rotate again (section 7).
4. Viewers see an error on mutations → expected (`403`); only `operator`/`admin` mutate.
5. Pipeline down → the console stays up with `pipeline_api: false` on `/readyz`,
   "API not ready" in the sidebar and `503 pipeline_api_unavailable` on proxied calls;
   fix the pipeline.
6. A screen says "needs pipeline API update (B…)" → not an incident (section 10).
