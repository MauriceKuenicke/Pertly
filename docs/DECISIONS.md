# Decisions: desktop → internal SaaS migration

Pertly moved from an Electron desktop app (one local `estimates.json`) to a self-hosted web app: FastAPI, React, SQLite and Docker Compose. The work was done on the `SaaS-Rewrite` branch without the product owner available. This file records every assumption made along the way and the decisions still waiting for an answer.

## Open decisions

Each item below is implemented with the default shown. Changing one is a small, local change.

| # | Question | Current default | Where to change it |
|---|---|---|---|
| 1 | **Self-registration:** may anyone who can reach the server create an account? | Open (`ALLOW_REGISTRATION=true`). The first account always becomes admin. | Env var. With `false`, admins create accounts in the Users screen. |
| 2 | **HTTPS:** will Pertly sit behind TLS? | Plain HTTP (`COOKIE_SECURE=false`), which works on `http://<host>:8080`. | Env var `COOKIE_SECURE=true` plus a TLS reverse proxy in front of port 8080. |
| 3 | **Sharing between colleagues:** should estimates be visible across accounts (team workspace, shared read access)? | No. Accounts are fully private and sharing works through the existing share code, the same as on the desktop. | New table (e.g. `estimate_shares`) plus API and UI. `specs/accounts-and-storage.md` needs updating. |
| 4 | **Admins and content:** should admins see or recover other users' estimates? | No. Admins manage accounts, not content. | Admin endpoints in `domains/estimate`. |
| 5 | **Concurrent edits:** the same account open in two tabs or devices. | Last write wins per estimate. An estimate deleted in tab A is re-created if tab B (opened earlier) saves it again. | Optimistic locking (`If-Match` / `updatedAt` precondition → 409) or delete tombstones. |
| 6 | **Login rate limiting.** | None, beyond argon2's cost per attempt. Acceptable on an internal network. | Add a throttle (per IP/email) in `domains/auth`, or at the reverse proxy. |
| 7 | **Password policy.** | 8+ characters, with a digit, a lower-case and an upper-case letter. This matches the provided style example. | `password_is_valid` in `domains/user/service.py` and `PASSWORD_RULES` in `frontend/src/lib/apiErrors.ts`. |
| 8 | **Session length.** | 30 days, sliding. | `SESSION_TTL_DAYS`. |
| 9 | **MCP / Claude Desktop integration** (branch `Feature-MCP`). | Not migrated. It ran inside Electron over a local socket. A server version would be a separate MCP server talking to the REST API with a per-user API token. | New work. Needs API tokens, which are not implemented. |
| 10 | **Marketing website** (`docs/` GitHub Pages site and `specs/marketing-website.md`). | Deleted on this branch. It advertised desktop downloads that no longer exist. Still available on `main` and in git history. | `git checkout main -- docs/index.html docs/methods.html docs/script.js docs/styles.css docs/assets specs/marketing-website.md` |
| 11 | **URL routing:** deep links to an estimate, browser back button. | None. Navigation is in-app state, as on the desktop, so the browser's Back button leaves the app. | Would need a router (e.g. `react-router`) and mapping `view`/`activeEstimateId` to URLs. |

## Assumptions and decisions taken

### Architecture
- **The pricing logic stays in the frontend.** This covers `calc.ts`, `normalizeEstimate`, the proposal HTML generator and the share code, so the "all features behave exactly as before" requirement holds by construction. The backend handles accounts, persistence and PDF rendering. It never computes prices.
- **Estimates and settings are stored as JSON documents** in SQLite (`TEXT` columns with `CHECK (json_valid(...))`), not normalized into ~10 child tables.
  - **Why:** the estimate shape evolves on the client and is backfilled by `normalizeEstimate`. A normalized schema would duplicate that logic on the server, need a migration for every new field, and risk lossy round-trips (`undefined` vs `null`, ordering).
  - **What is still plain SQL:** the schema, the upserts and the scoping are hand-written SQL.
  - **When to revisit:** when the server needs to query *inside* estimates (reporting, search). SQLite's JSON functions or generated columns can then index individual fields.
- **Plain SQL with the standard-library `sqlite3` module; no ORM.** SQLAlchemy is installed only because Alembic requires it to run migrations. It is never imported by application code.
- **One uvicorn worker.** SQLite allows one writer at a time. WAL mode plus `BEGIN IMMEDIATE` for multi-statement writes keeps this robust at internal-team scale.
- **Python 3.13** with the `python:3.13-slim-bookworm` base image (Debian bookworm, because Playwright's system dependencies are well supported there). **Node 22** builds the frontend.

### Data and behaviour
- **One account = the old desktop app.** Each user has private estimates and private default settings, matching the spec's framing that the primary user is a solo freelancer.
- **List order is preserved** with a server-side `seq` that is set on first insert and never changed by an update. New, duplicated and imported estimates appear on top; edits never reorder. The frontend sends new estimates oldest-first so the order holds.
- **Saving:** the desktop app wrote the whole store 400 ms after each change. The web app keeps the 400 ms debounce and the "Saving…" / "Saved just now" labels, but sends only what changed (per-estimate `PUT`/`DELETE`, settings `PUT`).
  - New behaviour that had no desktop equivalent:
    - Network errors show "Not saved – retrying…" and retry with backoff.
    - A save the server rejects (e.g. an estimate over 512 KiB) is reported and skipped, so it doesn't block other saves.
    - An expired session opens a re-login dialog that keeps unsaved edits.
  - A warning appears when leaving the page with unsaved changes.
- **Draft semantics are unchanged.** A new estimate is stored only after step 1 is completed or "Save As Draft" is clicked. Reloading the browser with an unsaved draft on screen loses it, just as quitting the desktop app did.
- **PDF export:** the desktop app opened a native "Save as" dialog. The web app downloads the file under the same suggested filename.
- **The PDF font is Inter** (installed in the backend image). The desktop export used the OS system font (SF Pro on macOS), so line breaks in PDFs can differ slightly from older exports. An emoji font is installed for the 📌 and 🔒 markers.
- **Moving desktop data over** works two ways. A user can do it from Settings → "Import From Pertly Desktop"; an operator can run `make docker-import-json`. Existing estimates are never overwritten. Settings are replaced only on request, or when the account has none yet.

### UI
- **Colour scheme "Fichtengrün"** (spruce green), primary `#2f5d4b`. Every text/background token pair was checked for WCAG AA (≥ 4.5:1). The changes that follow from that:
  - **Optimistic PERT badge:** now blue. Green-on-green would no longer be distinguishable from the brand-coloured "likely" badge.
  - **Pessimistic badge:** a darker ochre, because the old amber failed AA as small text.
  - **Danger and success colours:** darkened slightly to pass AA.
- **Electron-specific window chrome is removed.** That covers the frameless title bar, drag regions, the native minimum window size and `user-select: none`. The window title now sets the browser tab title. The app keeps a minimum layout size of 1040×640 and scrolls below it.
- **A new user block** in the sidebar (name, Account, Users for admins, Sign Out), plus new Login, Register, Account and Users screens built from the existing UI primitives.

### Security
- **Sessions:**
  - The session cookie is HttpOnly and `SameSite=Strict`, and only the token's sha256 hash is stored server-side.
  - Expiry is sliding.
  - Deactivating a user, an admin password reset or a self-service password change revokes the relevant sessions.
- **CSRF:** every state-changing request must carry the `X-Pertly-Client: 1` header. Browsers only allow same-origin scripts to set custom headers, and no CORS policy is configured.
- **Content-Security-Policy:**
  - nginx sends a strict CSP (`default-src 'self'`, no inline scripts, no third-party origins), so the app still makes no external requests.
  - Swagger UI (`/api/docs`) is therefore only usable on the backend dev server, not behind nginx.
- **PDF rendering** runs headless Chromium with JavaScript disabled, every request except the document itself aborted, and a CSP response header. There is a size limit, a concurrency limit and a timeout. The frontend's HTML escaping (`esc()`) remains the primary defence.
- **Login timing:** unknown emails still pay for a password-hash check, so response timing doesn't reveal which accounts exist.

### Removed
- **Electron:** `electron/` (main, preload, persistence), `electron-builder`, `vite-plugin-electron*`, the release workflow that built `.dmg`/`.exe` installers, and the dev-only browser shim.
- **Marketing site:** the GitHub Pages site (`docs/*.html`, `docs/assets/`) and its spec (see open decision 10).
- **Local build artifacts:** `dist-electron/` and `release/` were deleted. Note: `~/.claude.json` still registers an MCP server named `pertly` that pointed into `release/mac-arm64/Pertly.app`. That entry no longer works and can be removed (see open decision 9).
