# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Pertly is a self-hosted, internal web app (FastAPI + React + SQLite, shipped as one `docker-compose.yml`). It walks a freelancer or agency through a 4-step wizard to produce a defensible project price and a client-ready proposal PDF. It began as an Electron desktop app; [`docs/DECISIONS.md`](docs/DECISIONS.md) records what changed in the move to a server and which product decisions are still open.

**Primary user.** It is a **solo freelancer** setting their own rates and policies. Small agencies are supported but secondary. That framing matters when deciding whether something should be a fixed, opinionated default or a per-user setting. Every account has its own estimates and default settings, and nothing is shared between accounts.

**Pricing methods ("branches").** There are two independent methods, picked per estimate in step 1:
- **Time & Materials (T&M):** three-point (PERT) estimation per work package → day-rate cost → overhead → contingency → recommended budget + not-to-exceed cap.
- **Value-Based Pricing (VBP):** annual value of the problem → conservative/moderate/aggressive scenarios → attribution → value capture rate → recommended fee → three pricing tiers.

**Specs.** The business logic lives in [`specs/time-materials.md`](specs/time-materials.md) and [`specs/value-based-pricing.md`](specs/value-based-pricing.md): the methodology, the rules, the rationale behind them, and known gaps. Accounts, roles, data ownership and storage rules live in [`specs/accounts-and-storage.md`](specs/accounts-and-storage.md). **Read the relevant spec before changing pricing or account logic.**

The specs are written deliberately at a *business* level: what the rule is and why, not which function implements it. The code (`frontend/src/lib/calc.ts`, the pricing screens, the backend services) is the source of truth for what currently runs. The specs are the source of truth for what it's supposed to do and why. If they disagree, reconcile both in your change:
- Whenever you touch a formula, default, threshold or business rule a spec documents, update the spec's prose.
- If a spec's "Planned changes" section describes something you just built, move it into the main body.
- Each spec has an "Open questions" section for product decisions nobody has made yet. Resolve those with the user (not by guessing) and fold the resolution back into the spec.

The HTTP contract is [`docs/API.md`](docs/API.md); keep it in sync with the routers.

## Commands

Everything goes through the root `Makefile` (`make help` lists all targets):

```bash
make up              # docker compose up -d --build → http://localhost:8080
make down / logs     # stop (data volume kept) / follow logs
make install         # uv sync (backend) + npm ci (frontend)
make install-browser # Chromium for local PDF export (once)
make dev             # migrate, then FastAPI :8000 + Vite :5173 (proxies /api) with hot reload
make check           # ruff lint+format check, tsc, pytest, vitest (= CI minus docker build)
make test-backend    # uv run pytest          (in backend/)
make test-frontend   # npm run test (vitest)  (in frontend/)
make migrate         # alembic upgrade head on the local dev DB (backend/data/pertly.db)
make migration m="…" # new plain-SQL migration
make backup          # online SQLite backup of the running container into ./backups/
```

You can run a single test directly:

```bash
cd backend && uv run pytest tests/test_estimates.py -k "private_per_user"
cd frontend && npx vitest run src/lib/calc.test.ts -t "combines package sigma via root-sum-of-squares"
```

CI (`.github/workflows/ci.yml`) runs three jobs on every PR and on pushes to `main`, and all of them must pass:
- backend: ruff check, ruff format --check, and pytest with Chromium installed, so the PDF tests run
- frontend: tsc, vitest and the Vite build
- `docker compose build`

## Architecture

### Deployment

`docker-compose.yml` runs two containers:
- **`frontend`**: nginx serving the Vite build. It is the only published port (`PERTLY_PORT`, default 8080). It proxies `/api/` to the backend and sets the CSP and security headers (`frontend/nginx.conf`).
- **`backend`**: uvicorn with a single worker, because the database is SQLite. It is not published. Its entrypoint runs `alembic upgrade head` first. Data lives in the named volume `pertly-data` at `/data/pertly.db`. The image also contains Playwright's headless Chromium and the Inter and emoji fonts for PDF rendering.

### Backend (`backend/`, Python 3.13, uv, src layout `src/pertly/`)

**Layout:**
- `common/config.py`: pydantic-settings `settings` plus `logger`. All config comes from env vars.
- `common/db.py`: `connect()` (one `sqlite3` connection per request, autocommit mode), `transaction(conn)` (`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`), `utc_now()`/`to_iso()` (fixed-precision ISO strings so they compare correctly in SQL), and `prepare_database()` (sets WAL once).
- `common/crypto.py`: argon2 hashing, session tokens (only the sha256 of a token is stored).
- `common/documents.py`: JSON serialization and the size limit for stored documents.
- `domains/deps.py`: `get_main_db`, `get_current_user`, `get_current_admin`, `get_pdf_renderer`, and `verify_client_header`.
- `domains/<domain>/` for `auth`, `user`, `estimate`, `settings`, `proposal` and `health`, each with `router.py`, `service.py` and `model.py`. `main.py` holds the app factory, lifespan, routers under `/api`, the validation-error handler and the session-cookie middleware. `cli.py` provides `pertly create-admin | import-json | backup`.

**Code conventions.** Keep them; the user cares about clean backend code.
- **Plain SQL only, no ORM.** Services hold hand-written, always parameterized SQL against `sqlite3` (`row_factory = sqlite3.Row`). They map rows to Pydantic models in `model.py` (e.g. `User.from_row`).
- **Alembic** is used without metadata. Each migration is a list of single SQL statements run through `op.execute` (SQLite runs one statement per call); see `migrations/versions/0001_initial.py` and `migrations/script.py.mako`. SQLAlchemy is only there because Alembic needs it. Never import it in app code.
- **Service classes** are `XService(db_session=conn)`, one per domain, and contain the database logic. Multi-statement writes that must be atomic use `with transaction(db):`. A service method that already opens a transaction must not be called inside another one.
- **Routers:**
  - One `APIRouter()` per domain. Every endpoint has `summary=`, `status_code=`, `deprecated=False`, `response_model=` (for JSON responses) and a docstring.
  - Form endpoints use `Form()`.
  - Errors are raised as `HTTPException(status_code=..., detail={"code": "UPPER_SNAKE", "message": "Human readable."})`. The frontend maps codes to messages in `frontend/src/lib/apiErrors.ts`, so a new code may need an entry there.
  - Request validation errors are normalized to `{"code": "VALIDATION_ERROR", ...}`.
- **Every estimate/settings query is scoped by `user_id`.** Estimate ids are unique per user (`UNIQUE(user_id, id)`), not globally.
- **Formatting:** ruff, line length 120 (`make format`).

**Auth and security model:**
- **Sessions:** HttpOnly + `SameSite=Strict` cookie `pertly_session`, backed by `user_sessions` (token hash, sliding expiry). When `get_current_user` extends a session, the `refresh_session_cookie` middleware re-issues the cookie.
- **CSRF:** every unsafe request must send `X-Pertly-Client: 1` (app-wide dependency `verify_client_header`). The frontend's `api.ts` always adds it.
- **First user:** the first registered user becomes admin. `ALLOW_REGISTRATION` controls registration after that. Admins can't modify, delete or password-reset themselves via the admin endpoints (`CANNOT_MODIFY_SELF`), and the last active admin is protected (`LAST_ADMIN`).

**Storage model.** Estimates and settings are stored as **opaque JSON documents** (`estimates.document`, `user_settings.document`) with exactly the frontend's `Estimate`/`Settings` shape. The backend validates only the top-level minimum (`id`, `status`, `pricingMethod`, `createdAt`, `updatedAt`), the id format and the 512 KiB size limit. Pricing logic and backfilling of new fields stay in the frontend. `estimates.seq` is the list position: it is set on first insert, an upsert never changes it, and the list is read with `ORDER BY seq DESC`. That reproduces "new/duplicated/imported estimates go on top; edits never reorder".

**PDF export.** `domains/proposal/service.py:PdfRenderer` is owned by the app lifespan (`app.state.pdf_renderer`, because the browser and asyncio primitives are bound to one event loop). It renders the frontend-built HTML as follows:
- It serves the HTML from a fake origin with a strict CSP response header.
- JavaScript is disabled, and every other request is aborted.
- The page is printed A4, with no margins and with backgrounds.
- Renders run under a concurrency limit and a timeout.

**Tests.** `backend/tests/` uses pytest with FastAPI's TestClient against a temporary SQLite file migrated through Alembic (`conftest.py`). Each test client gets its own app instance, because a TestClient runs the lifespan on its own event loop. PDF tests skip when Chromium is missing locally (`make install-browser`).

### Frontend (`frontend/`, React 18 + TypeScript + Vite)

**State: `frontend/src/state/`.**
- **`AuthContext.tsx`** holds the signed-in user, registration config, login/register/logout, and `sessionExpired`. Any 401 from `api.ts` while signed in opens `SessionExpiredModal` *without* unmounting app state, so unsaved edits survive a re-login. `App.tsx` mounts `<EstimatesProvider key={user.id}>`, so switching users always resets state.
- **`EstimatesContext.tsx`** is the single source of truth for estimate data: `{ estimates, settings }` plus the navigation `view` (`list | wizard | settings | account | users`). There is no router; this is state-based navigation, as in the desktop app. Every screen reads `activeEstimate` and calls `onChange(updater)` to mutate it immutably.
  - **Loading:** once per user, via `GET /api/estimates` and `GET /api/settings`. Settings are merged over `defaultSettings()`.
  - **Saving:** a 400 ms debounce, then a **diff-sync**. `lib/storeDiff.ts` compares the last-synced store with the current one *by reference*, so the immutable updates matter. It sends one `PUT /api/estimates/{id}` per changed or new estimate (new ones oldest-first, to keep list order), a `DELETE` per removed estimate, and `PUT /api/settings` if settings changed.
    - Only one sync runs at a time.
    - Network and 5xx errors retry with backoff.
    - Permanent 4xx rejections (e.g. 413) are set aside per object and shown to the user, so they never block other saves.
    - A 401 pauses syncing until re-login.
    - Labels come from `lib/saveStatus.ts`.
  - **Draft slot:** a newly created estimate lives in `draftEstimate`, not in `store.estimates`, until the user advances past step 1 or explicitly saves. An abandoned "New estimate" click is therefore never persisted.
  - **Other behaviour:** editing a `done` estimate resets it to `draft`. `flushPendingSaves()` runs before sign-out and when the tab is hidden.

**Wizard routing.** `App.tsx`'s `WizardRouter` switches on `activeEstimate.currentStep` (1–4) and `pricingMethod` to pick the T&M or VBP variant of the Pricing (step 2) and Summary (step 3) screens. Step 1 (Assumptions) and step 4 (Share) are shared by both methods. Screen components live under `frontend/src/screens/<Area>/` and share the `WizardScreenProps` contract (`screens/wizardProps.ts`). Auth, Account and Users (admin) screens live under `screens/Auth`, `screens/Account` and `screens/Users`.

**API client.** `frontend/src/lib/api.ts` is the only place that calls `fetch`. It uses same-origin credentials, adds the `X-Pertly-Client` header, throws a typed `ApiError {status, code, message}`, and emits the unauthorized event. `crypto.randomUUID` only exists in secure contexts, so `lib/id.ts` falls back to `getRandomValues`. Pertly is often served over plain `http://` internally.

**Pricing math is centralized.** All formulas live in `frontend/src/lib/calc.ts` and nowhere else: PERT expected/sigma, role-rate resolution, overhead/contingency layering, value-based scenario scaling, payment-split presets and break-even effort. Screens and the proposal-HTML generator both call into it; never re-derive a total inline in a component. `calc.test.ts` is the executable spec for edge cases (empty work-package list, zero fee, deleted-role fallback, cap-never-below-budget, etc.). Check it before assuming how a formula behaves at a boundary. The backend never computes prices.

**Two renderers of the same proposal, kept manually in sync.** Every proposal view exists twice:
- as a React component under `frontend/src/screens/Share/` (`ClientOverviewTM`, `ClientOverviewVBP`, `InternalDetailTM`, `InternalDetailVBP`), shown live in the app;
- as a hand-built HTML string in `frontend/src/lib/proposalHtml.ts` (`clientOverviewTmHtml`, etc.).

The HTML string is what gets POSTed to `/api/proposals/pdf` and printed. The PDF is *not* a print of the live React view.
- **Changing what a proposal shows means editing both the `.tsx` component and its `proposalHtml.ts` counterpart.**
- The PDF stylesheet (`STYLE` in `proposalHtml.ts`) hardcodes the same colour values as `styles/tokens.css`. Change both together.
- All free-text fields in `proposalHtml.ts` go through the local `esc()` HTML-escaper before interpolation. `proposalHtml.test.ts` locks this in as a regression test. Preserve that pattern for any new interpolated field, even though the backend renders with JS disabled and the network blocked.

**Estimate lifecycle helpers** live in `frontend/src/lib/newEstimate.ts`:
- `createEstimate(settings)` seeds a new estimate from the Settings defaults.
- `normalizeEstimate(estimate)` backfills fields added after the initial release (roles, payment splits, service lines). Every estimate coming from *outside the current session* (server load, share-code import, desktop-file import) must pass through it before the rest of the app touches it.
- `freshenEstimate`/`cloneEstimate`/`importEstimateFromShareCode` re-mint IDs for every nested list item (work packages, roles, value drivers, tiers) and remap cross-references (`roleId`, `recommendedTierId`) to the new IDs, so a duplicated or imported estimate never aliases the source's identifiers.

**Adding a field.** When you add a new field to `Estimate`/`TimeMaterialsData`/`ValueBasedData` (`frontend/src/types/estimate.ts`), you generally need to touch:
- the type
- `createEstimate`
- `normalizeEstimate` (backfill a default)
- `freshenEstimate`, if it's a list that needs fresh IDs
- `isEstimateShape` in `frontend/src/lib/shareCode.ts`, if it's structurally load-bearing for share-code validation

**No backend or migration change is needed** for fields inside the document. A new *required top-level* key would also need `REQUIRED_ESTIMATE_KEYS` in `backend/src/pertly/domains/estimate/model.py`; avoid that, because old documents won't have it.

**Formatting** goes through `frontend/src/lib/currency.ts` (`formatMoney`, `formatDays`, `currencySymbol`) and `frontend/src/lib/date.ts`. Currency support is a hardcoded `SYMBOLS` map of EUR/USD/GBP/CHF; unknown codes fall back to `"<CODE> "`. Use these instead of formatting numbers or dates ad hoc, so the PDF and the live view use identical wording.

**Styling** uses plain CSS Modules per component (`Foo.module.css` next to `Foo.tsx`), with no Tailwind or UI framework.
- The colour scheme is "Fichtengrün" (spruce green). Every colour is a token in `frontend/src/styles/tokens.css`, AA-contrast checked; use `var(--…)`, never hex values, in component CSS.
- Shared primitives live in `components/ui/` (Button, Card, Field, Slider, Modal, Badge, InfoTooltip, Icon).
- Layout chrome lives in `components/layout/` (WizardLayout, Sidebar with the user block, FooterBar, StepTopBar, CenteredPage for the auth screens).
