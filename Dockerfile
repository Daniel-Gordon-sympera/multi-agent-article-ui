# Sympera Scout — one image for the SPA build and the FastAPI BFF.
# (BuildKit required: `RUN --mount=type=cache` — the default builder since Docker 23.)
#
# Stage "web"     node:22-alpine, pnpm 10.28.0 via corepack, builds web/dist.
# Stage "runtime" python:3.12-slim-bookworm, uv 0.12.6 (installed like the
#                 backend image), the BFF package and the built SPA copied to
#                 bff/scout_bff/static, non-root UID 10001, port 8080.
#
# Build:  docker build -t scout-ui:local .
# Run:    see compose.ui.yaml (the image is started from the pipeline's
#         Compose project; the healthcheck lives there, not here).

# ---------------------------------------------------------------------------
# Stage 1: build the SPA
# ---------------------------------------------------------------------------
FROM node:22-alpine AS web

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
WORKDIR /src/web

# corepack ships with Node 22; pin the pnpm release the contract names (§3).
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Dependencies first so that source edits do not invalidate the install layer.
COPY web/package.json web/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Then the sources; `pnpm build` = `tsc -b && vite build` → /src/web/dist.
COPY web .
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 2: the runtime image (BFF + static SPA)
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy
WORKDIR /app

# Same uv version and install method as the backend image. No apt packages:
# psycopg[binary] bundles libpq, so libpq5 is not needed.
RUN pip install --no-cache-dir uv==0.12.6

# Locked third-party dependencies first (cached until the lockfile changes).
COPY pyproject.toml uv.lock alembic.ini ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# The BFF package itself (hatchling, packages = ["bff/scout_bff"]); the second
# sync installs the project editable, so bff/scout_bff/static is found at
# runtime next to the package sources.
COPY bff ./bff
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# The built SPA, served by the BFF (contract §4.9).
COPY --from=web /src/web/dist ./bff/scout_bff/static

# Non-root runtime user; the application tree stays root-owned and read-only.
RUN useradd --create-home --uid 10001 scout
USER scout

EXPOSE 8080
CMD ["/app/.venv/bin/uvicorn", "scout_bff.app:app", "--host", "0.0.0.0", "--port", "8080"]
