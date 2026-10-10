# Pertly

**Price projects with numbers you can defend, not gut feel.**

Pertly is a self-hosted web app for anyone who quotes client projects. A 4-step wizard (Assumptions → Pricing → Summary → Proposal) turns your assumptions into a defensible price and a client-ready proposal PDF. Two pricing methods are supported:

- **Value-Based Pricing:** the fee is derived from the annual value of the client's problem and checked against a target ROI. It comes with three pricing tiers.
- **Time & Materials:** three-point (PERT) estimates per work package, with overhead, contingency and a not-to-exceed cap, or a fixed price.

Pertly runs as an internal SaaS on your own server. Everyone signs in with their own account, and every account keeps its own estimates and default rates. The client proposal never shows day rates or margins. The internal view shows the full build-up. Both export to PDF in one click.

## Quick start (Docker)

You need Docker with the Compose plugin.

```bash
docker compose up -d --build      # or: make up
```

Open <http://localhost:8080>. **The first person to register becomes the admin.** To pre-create the admin instead, see [Configuration](#configuration). Stop the stack with `make down`; your data stays in the `pertly-data` Docker volume.

## Configuration

Every setting is optional. Copy `.env.example` to `.env` to change one:

| Variable | Default | Purpose |
|---|---|---|
| `PERTLY_PORT` | `8080` | Host port of the web UI |
| `ALLOW_REGISTRATION` | `true` | Self-registration after the first account. With `false`, admins create accounts in the **Users** screen. |
| `COOKIE_SECURE` | `false` | Set to `true` when Pertly is served over HTTPS |
| `SESSION_TTL_DAYS` | `30` | How long an idle sign-in lasts |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | unset | Creates this admin on first start, if no account exists yet |
| `LOG_LEVEL` | `INFO` | Backend log level |

Pertly makes no outbound network calls. It needs no mail server, CDN or external API, so it runs fine on an isolated internal network. For HTTPS, put any TLS-terminating reverse proxy in front of port 8080 and set `COOKIE_SECURE=true`.

## Accounts

- **Users** have their own estimates and default settings. Nobody else, admins included, can see them. To hand an estimate to a colleague, use **Share Estimate** on step 4. They import the code as their own copy.
- **Admins** additionally manage accounts in the **Users** screen: create, deactivate, promote, reset passwords, delete.
- There are no emails. A forgotten password is reset by an admin, who hands over the new one in person.
- From the command line: `make docker-create-admin EMAIL=you@example.com FIRST=Ada LAST=Lovelace`.

## Moving over from Pertly Desktop

The former desktop app kept everything in one `estimates.json`:

| OS | Location |
|---|---|
| macOS | `~/Library/Application Support/Pertly/estimates.json` |
| Windows | `%APPDATA%\Pertly\estimates.json` |
| Linux | `~/.config/Pertly/estimates.json` |

There are two ways to bring it over:

- **Each user, themselves:** **Settings → Import From Pertly Desktop**.
- **An operator, for a user:** `make docker-import-json FILE=path/to/estimates.json EMAIL=user@example.com`. Add `REPLACE_SETTINGS=1` to also overwrite their default settings.

Either way, imported estimates keep their order. Estimates the account already has are skipped, so running the import twice is safe.

## Backups

```bash
make backup        # consistent snapshot of the live database into ./backups/
```

The database is a single SQLite file in the `pertly-data` volume (`/data/pertly.db`). Always back it up with `make backup`, which uses SQLite's online backup API. Don't copy the live file. To restore a snapshot:
1. Stop the stack.
2. Copy the snapshot into the volume as `pertly.db`.
3. Start the stack again.

## Development

You need [uv](https://docs.astral.sh/uv/), Node 22+ and GNU make.

```bash
make install          # uv sync + npm ci
make install-browser  # Chromium for local PDF export (once)
make dev              # migrations, then FastAPI on :8000 + Vite on :5173 with hot reload
```

Open <http://localhost:5173>; Vite proxies `/api` to the backend. Useful targets:

| Target | What it does |
|---|---|
| `make check` | Lint, typecheck and run all tests (the same checks as CI, except the Docker build) |
| `make test-backend` / `make test-frontend` | Run one test suite |
| `make migration m="add foo"` | Create a new plain-SQL Alembic migration |
| `make help` | List every target |

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, plain CSS Modules, Vitest. Served by nginx, which also proxies `/api`. |
| Backend | FastAPI on Python 3.13, managed with uv. SQLite through the standard-library `sqlite3` module with **plain SQL, no ORM**. Alembic migrations, also written in plain SQL. Argon2 password hashing and server-side sessions. |
| PDF export | Headless Chromium (Playwright) in the backend container. JavaScript is disabled and the network is blocked while it renders. |
| Deployment | One `docker-compose.yml` with two containers: `frontend` (nginx, published) and `backend` (internal only). |

See [`docs/API.md`](docs/API.md) for the HTTP API, [`specs/`](specs/) for the business rules, and [`docs/DECISIONS.md`](docs/DECISIONS.md) for the decisions taken when Pertly moved from desktop to server.
