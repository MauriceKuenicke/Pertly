# syntax=docker/dockerfile:1
#
# Pertly backend: FastAPI + SQLite + headless Chromium (Playwright) for PDFs.
#
# Two stages:
#   builder - resolves the locked dependency set into /app/.venv with uv
#   runtime - slim Python + fonts + Chromium headless shell, runs as uid 10001

ARG PYTHON_IMAGE=python:3.13-slim-bookworm

############################
# builder
############################
FROM ${PYTHON_IMAGE} AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.21 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Dependencies first (only pyproject.toml + uv.lock), so source edits don't
# invalidate this layer.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    uv sync --frozen --no-dev --no-install-project

# Then the project itself (README.md is referenced by pyproject's `readme`).
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

############################
# runtime
############################
FROM ${PYTHON_IMAGE} AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/app/.venv/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DATABASE_PATH=/data/pertly.db

# Fonts used by the proposal PDFs (Inter) plus emoji coverage for free text.
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-inter fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv

# Chromium headless shell + its OS libraries (needs root for apt). Done before
# copying the source so code changes don't re-download the browser.
RUN playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R a+rX /ms-playwright

COPY src ./src
COPY alembic.ini ./
COPY migrations ./migrations
COPY --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN groupadd --gid 10001 pertly \
    && useradd --uid 10001 --gid pertly --create-home --home-dir /home/pertly \
       --shell /usr/sbin/nologin pertly \
    && mkdir -p /data \
    && chown pertly:pertly /data

VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

USER pertly

ENTRYPOINT ["docker-entrypoint.sh"]
