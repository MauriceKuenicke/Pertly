#!/bin/sh
# Container entrypoint: apply pending migrations, then run the API server.
# Extra arguments are passed through to uvicorn (e.g. `--log-level debug`).
# Single worker on purpose: SQLite is the database.
set -eu

cd /app

alembic upgrade head

exec uvicorn pertly.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips='*' \
    --no-server-header \
    "$@"
