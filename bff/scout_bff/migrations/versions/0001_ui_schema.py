"""The whole `ui` schema: accounts, sessions, scouts, batches, sources, views, audit."""

from alembic import op

revision = "0001_ui_schema"
down_revision = None
branch_labels = None
depends_on = None

TABLES_IN_CREATION_ORDER = (
    "users",
    "sessions",
    "login_attempts",
    "scouts",
    "batches",
    "batch_jobs",
    "sources",
    "saved_views",
    "preferences",
    "audit_log",
    "dismissed_suggestions",
)

UPGRADE_STATEMENTS = (
    """
    CREATE TABLE ui.users (
      id uuid PRIMARY KEY,
      email citext UNIQUE NOT NULL,
      name text NOT NULL,
      role text NOT NULL CHECK (role IN ('admin','operator','viewer')),
      password_hash text NOT NULL,
      must_change_password boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      disabled_at timestamptz,
      last_login_at timestamptz)
    """,
    """
    CREATE TABLE ui.sessions (
      id text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES ui.users(id),
      csrf_token text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      user_agent text,
      ip text)
    """,
    "CREATE INDEX sessions_user_id_idx ON ui.sessions (user_id)",
    "CREATE INDEX sessions_expires_at_idx ON ui.sessions (expires_at)",
    """
    CREATE TABLE ui.login_attempts (
      key text NOT NULL,
      at timestamptz NOT NULL DEFAULT now())
    """,
    "CREATE INDEX login_attempts_key_at_idx ON ui.login_attempts (key, at)",
    """
    CREATE TABLE ui.scouts (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('location_industry','seeds','url')),
      county text NOT NULL,
      state_code char(2) NOT NULL,
      location text,
      url text,
      industries text[] NOT NULL DEFAULT '{}',
      source_mode text NOT NULL CHECK (source_mode IN ('finder','seeds')),
      settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by uuid REFERENCES ui.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz,
      UNIQUE (name))
    """,
    """
    CREATE TABLE ui.batches (
      id uuid PRIMARY KEY,
      scout_id uuid REFERENCES ui.scouts(id),
      run_number int,
      requested jsonb NOT NULL,
      created_by uuid REFERENCES ui.users(id),
      created_at timestamptz NOT NULL DEFAULT now())
    """,
    """
    CREATE TABLE ui.batch_jobs (
      batch_id uuid NOT NULL REFERENCES ui.batches(id),
      position int NOT NULL,
      industry text,
      job_id uuid,
      client_reference text NOT NULL UNIQUE,
      error jsonb,
      PRIMARY KEY (batch_id, position))
    """,
    "CREATE INDEX batch_jobs_job_id_idx ON ui.batch_jobs (job_id)",
    """
    CREATE TABLE ui.sources (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      domain text NOT NULL,
      url text NOT NULL,
      county text NOT NULL,
      state_code char(2) NOT NULL,
      industries text[] NOT NULL DEFAULT '{}',
      origin text NOT NULL CHECK (origin IN ('manual','finder','csv')),
      finder jsonb,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
      created_by uuid REFERENCES ui.users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      removed_at timestamptz,
      UNIQUE (domain, county, state_code))
    """,
    """
    CREATE TABLE ui.saved_views (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES ui.users(id),
      name text NOT NULL,
      route text NOT NULL,
      search jsonb NOT NULL,
      columns text[],
      shared boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, route, name))
    """,
    """
    CREATE TABLE ui.preferences (
      user_id uuid PRIMARY KEY REFERENCES ui.users(id),
      prefs jsonb NOT NULL DEFAULT '{}'::jsonb)
    """,
    """
    CREATE TABLE ui.audit_log (
      id bigserial PRIMARY KEY,
      at timestamptz NOT NULL DEFAULT now(),
      user_id uuid,
      role text,
      method text NOT NULL,
      path text NOT NULL,
      target jsonb,
      status int,
      duration_ms int)
    """,
    "CREATE INDEX audit_log_at_idx ON ui.audit_log (at)",
    "CREATE INDEX audit_log_user_id_at_idx ON ui.audit_log (user_id, at)",
    """
    CREATE TABLE ui.dismissed_suggestions (
      domain text NOT NULL,
      county text NOT NULL,
      state_code char(2) NOT NULL,
      dismissed_by uuid REFERENCES ui.users(id),
      dismissed_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (domain, county, state_code))
    """,
)


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for table in reversed(TABLES_IN_CREATION_ORDER):
        op.execute(f"DROP TABLE IF EXISTS ui.{table} CASCADE")
