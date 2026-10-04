# Sympera Scout — operations runbook

For the person on duty. Assumes the Docker deployment of `README.md` (the pipeline's
Compose project with `compose.ui.yaml`), run from the pipeline repository with

```bash
alias dcu='docker compose -f compose.yaml -f ../multi-agent-articles-ui/compose.ui.yaml'
```

Operator tasks (first run, users, runs, upgrades) are in `HOWTO.md`; this file covers
health, logs, sessions, the audit log, retention, secret rotation and recovery.
Sections marked *(skeleton)* get their detail as the corresponding BFF module lands.

## 1. What runs where

| Service | Image | Role | Port | Depends on |
|---|---|---|---|---|
| `ui_migrate` | `scout-ui:${UI_IMAGE_TAG}` | one-shot: schema `ui`, roles, Alembic head, bootstrap admin | — | `postgres` healthy, pipeline `migrate` completed |
| `ui` | `scout-ui:${UI_IMAGE_TAG}` | FastAPI BFF: static SPA, `/app/*`, `/v1/*` proxy, `/healthz`, `/readyz` | `127.0.0.1:${UI_PORT:-8080}` → 8080 | `ui_migrate` completed, `api` healthy |
| `caddy` (pipeline's) | `caddy:2` | TLS + reverse proxy for `${API_DOMAIN}` → `api:8000` and `${UI_DOMAIN}` → `ui:8080` | 80, 443 | `api`, `ui` |

The container runs as UID 10001, the application tree is read-only, logs go to stdout
(json-file driver, 50 MB × 5). The BFF connects to PostgreSQL as `app_ui` and to the
pipeline API as `http://api:8000` with the two keys from the environment.

## 2. Health checks

```bash
curl -sS http://127.0.0.1:8080/healthz            # {"status": …}  — process up, no dependencies checked
curl -sS http://127.0.0.1:8080/readyz | jq        # {"status":"ready"|"not_ready","checks":{"database","migrations","pipeline_api"}}; 503 when not ready
curl -sS http://127.0.0.1:8000/readyz | jq        # the pipeline API's own readiness (database, artifact_store, migrations)
dcu ps                                            # ui should be "healthy" (Compose healthcheck polls /readyz every 10 s)
```

| `checks.*` failing | Meaning | Action |
|---|---|---|
| `database` | `app_ui` cannot connect or query schema `ui` | `dcu logs ui`; `dcu ps postgres`; re-run `dcu up -d ui_migrate` if the password changed |
| `migrations` | `ui.alembic_version` is not at the code's head | `dcu run --rm ui_migrate` then `dcu restart ui` |
| `pipeline_api` | the API's `/readyz` failed or `PIPELINE_API_URL` is unreachable | fix the pipeline first; the console recovers on the next probe without restart |

Signed-in users see the API readiness and their key role in the sidebar footer; the
Overview's "needs attention" lists `api_not_ready` as a fail item.

## 3. Logs

```bash
dcu logs -f ui                                    # follow
dcu logs --since 30m ui | jq -r 'select(.status >= 500)'
dcu logs --since 30m ui | jq -r 'select(.path | startswith("/v1/")) | [.ts,.user_id,.role,.method,.path,.status,.duration_ms] | @tsv'
dcu logs ui_migrate                               # bootstrap output of the last run
```

Format: one structlog JSON line per request and per proxied `/v1` call with `user_id,
role, method, path, status, duration_ms`. Keys, cookies, passwords and the session secret
are registered as secrets and redacted; `X-API-Key` query values are never logged.
`LOG_LEVEL` (default `INFO`) and `LOG_FORMAT` (`json`; `console` for development) are
environment variables — change them in `.env` and `dcu up -d ui`.

## 4. Sessions *(skeleton)*

- Cookie `scout_session` (signed id, `HttpOnly; SameSite=Lax; Secure`); row in
  `ui.sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, user_agent, ip)`.
  Idle expiry 12 h sliding (`UI_SESSION_IDLE_HOURS`), absolute 7 d
  (`UI_SESSION_ABSOLUTE_DAYS`). Sign-out deletes the row.
- Who is signed in right now:

  ```bash
  dcu exec postgres psql -U article_owner -d article_pipeline -c \
    "SELECT u.email, u.role, s.last_seen_at, s.expires_at, s.ip FROM ui.sessions s JOIN ui.users u ON u.id = s.user_id WHERE s.expires_at > now() ORDER BY s.last_seen_at DESC;"
  ```

- Force one user out: `DELETE FROM ui.sessions WHERE user_id = (SELECT id FROM ui.users WHERE email = '…');`
  Force everyone out: rotate `SESSION_SECRET` (section 7) or `TRUNCATE ui.sessions;`.
- Disable an account: Settings › Users (admin), or
  `UPDATE ui.users SET disabled_at = now() WHERE email = '…';` followed by deleting its sessions.
- Locked out (`429 too_many_attempts`): 10 failures per e-mail / 15 min, 60 per IP / h,
  counted in `ui.login_attempts (key, at)`; wait, or clear the counter:
  `DELETE FROM ui.login_attempts WHERE key LIKE '%<email>%';`.
- No admin can sign in (forgotten password): do **not** empty `ui.users` to re-trigger the
  bootstrap admin — the audit log references user ids. Compute a new argon2id hash with
  the BFF's own helper, inside the image:

  ```bash
  dcu run --rm --no-deps --entrypoint /app/.venv/bin/python ui \
      -c 'from scout_bff.auth.passwords import hash_password; print(hash_password("<temporary password>"))'
  ```

  then `UPDATE ui.users SET password_hash = '<hash>', must_change_password = true WHERE email = '…';`
  and delete that user's sessions. The user sets a real password at the next sign-in.
- Health response shapes: `/healthz` → `{status}`; `/readyz` as in section 2.

## 5. Audit log *(skeleton)*

Every unsafe `/app` call and every proxied unsafe `/v1` call inserts
`ui.audit_log (at, user_id, role, method, path, target jsonb, status, duration_ms)`.

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

| Table | Rule | Mechanism |
|---|---|---|
| `ui.sessions` | delete expired rows | hourly task in the BFF (`retention.py`) |
| `ui.login_attempts` | keep 24 h | hourly task |
| `ui.audit_log` | keep `UI_AUDIT_RETENTION_DAYS` (default 180) | hourly task (plan: monthly delete; the hourly task is cheap and keeps the table flat) |
| everything else (users, scouts, batches, sources, views, preferences) | kept | — |

To keep the audit log longer, raise `UI_AUDIT_RETENTION_DAYS` in `.env` and `dcu up -d ui`;
to archive before purging, `pg_dump -n ui -t ui.audit_log` (section 8).

## 7. Rotating secrets

| Secret | How | Effect |
|---|---|---|
| `PIPELINE_OPERATOR_KEY` / `PIPELINE_READER_KEY` | create new keys (`POST /v1/api-keys`), update `.env`, `dcu up -d ui`, revoke the old names (`DELETE /v1/api-keys/<name>`) — HOWTO §11 | none for users; proxied calls use the new keys after the restart |
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
additive; `ui_migrate` is idempotent.

Rollback: set `UI_IMAGE_TAG` back to the previous release and `dcu up -d ui`. Because
migrations are additive, an older BFF runs against a newer schema. Only if a release
notes a destructive migration: `dcu run --rm --entrypoint /app/.venv/bin/python ui_migrate -m alembic downgrade <revision>`
with the owner `UI_DATABASE_URL` in the environment, then start the older image.

## 10. Capacity and polling

The SPA polls at 5 s (live screens) / 30 s (calm) per open tab, paused in background
tabs; job resources use `ETag`/`If-None-Match` and mostly return `304`. Proxy limits:
connect 5 s, read 30 s for JSON, unbounded streams for CSV and article text, 3 retries
on connection errors for `GET` only. If the pipeline API shows load from the console,
the first lever is a 2 s per-path micro-cache in the BFF (ADR-UI-005); the second is
SSE.

## 11. Incident quick list

1. Console down → `dcu ps`, `dcu logs --since 10m ui caddy`; `dcu up -d ui`.
2. Everyone signed out unexpectedly → `SESSION_SECRET` changed or `ui.sessions` emptied;
   nothing to fix beyond signing in.
3. Runs cannot be created but reads work → the operator key was revoked or rotated
   without updating `.env` (`401 api_key_invalid` in `dcu logs ui`); rotate again (§7).
4. Viewers see an error on mutations → expected (`403`); only `operator`/`admin` mutate.
5. Pipeline down → the console stays up in read-only-ish mode with `pipeline_api: fail`
   and `503 pipeline_api_unavailable` on proxied calls; fix the pipeline.
