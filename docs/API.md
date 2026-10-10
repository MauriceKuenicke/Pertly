# Pertly HTTP API

All endpoints live under `/api`. The OpenAPI schema is at `/api/openapi.json`.
Interactive Swagger docs are at `/api/docs` when talking to the backend directly
(`make dev-backend` → http://localhost:8000/api/docs). Behind nginx the strict
Content-Security-Policy blocks Swagger's CDN scripts, so use the dev server for them.

## Conventions

- **Auth:** an HttpOnly, `SameSite=Strict` session cookie (`pertly_session`) set by
  `POST /api/auth/login` or `POST /api/auth/register`. Sessions slide: while a user is
  active, the server extends the session (at most every 5 minutes) and re-issues the
  cookie on that response. Requests from the frontend use `credentials: "same-origin"`.
- **CSRF guard:** every request with an unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`)
  must carry the header `X-Pertly-Client: 1`. Missing header → `403 {code: "CLIENT_HEADER_MISSING"}`.
- **Errors:** every error body has the shape
  `{"detail": {"code": "SOME_CODE", "message": "Human readable."}}`.
  Request validation failures are `422 {"detail": {"code": "VALIDATION_ERROR", "message": "...", "errors": [...]}}`.
- **Unauthenticated** (no/expired/revoked session, or deactivated user) → `401 {code: "UNAUTHORIZED"}`.
- **Admin-only** endpoints for a non-admin → `403 {code: "FORBIDDEN"}`.
- Timestamps are ISO-8601 UTC strings.

## Types

```ts
// Returned by every user endpoint.
interface UserRead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}
```

Estimates and settings are stored as opaque JSON documents with exactly the
shape of the frontend's `Estimate` / `Settings` types (`frontend/src/types/estimate.ts`).
The backend validates only the structural minimum (see below); the frontend's
`normalizeEstimate` remains responsible for backfilling fields.

## Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/health` | none | `200 {"status": "ok"}` |

## Auth

| Method | Path | Body | Response / errors |
|---|---|---|---|
| GET | `/api/auth/config` | – | `200 {"registration_open": bool}`. True if `ALLOW_REGISTRATION` is on **or** no user exists yet. |
| POST | `/api/auth/register` | form: `first_name`, `last_name`, `email`, `password`, `confirm_password` | `201 UserRead` + session cookie (user is logged in). The first user ever becomes admin. Errors: `403 REGISTRATION_DISABLED`, `422 INVALID_MAIL`, `422 PASSWORD_MISMATCH`, `422 PASSWORD_REQUIREMENT`, `422 NAME_REQUIRED`, `409 ALREADY_IN_USE` |
| POST | `/api/auth/login` | form: `email`, `password` | `200 UserRead` + session cookie. Errors: `401 INVALID_CREDENTIALS`, `403 USER_INACTIVE` |
| POST | `/api/auth/logout` | – | `204`, session deleted, cookie cleared. Works (204) even without a valid session. |

Password requirements: at least 8 characters, one digit, one lower-case and one upper-case letter.

## Current user

| Method | Path | Body | Response / errors |
|---|---|---|---|
| GET | `/api/users/me` | – | `200 UserRead` |
| PUT | `/api/users/me/password` | form: `current_password`, `new_password`, `confirm_password` | `204`. All *other* sessions of the user are revoked. Errors: `401 INVALID_CREDENTIALS` (wrong current password), `422 PASSWORD_MISMATCH`, `422 PASSWORD_REQUIREMENT` |

## User administration (admin only)

| Method | Path | Body | Response / errors |
|---|---|---|---|
| GET | `/api/users` | – | `200 UserRead[]` ordered by creation |
| POST | `/api/users` | form: `first_name`, `last_name`, `email`, `password`, `is_admin` (bool, default false) | `201 UserRead`. Errors as for register (minus `REGISTRATION_DISABLED`/`PASSWORD_MISMATCH`) |
| PATCH | `/api/users/{user_id}` | JSON `{"is_active"?: bool, "is_admin"?: bool}` | `200 UserRead`. Deactivating revokes all sessions. Errors: `404 USER_NOT_FOUND`, `409 CANNOT_MODIFY_SELF` (admin changing own flags), `409 LAST_ADMIN` |
| DELETE | `/api/users/{user_id}` | – | `204`, user and all their data deleted. Errors: `404 USER_NOT_FOUND`, `409 CANNOT_MODIFY_SELF`, `409 LAST_ADMIN` |
| POST | `/api/users/{user_id}/password` | form: `new_password` | `204`, all sessions of that user revoked. Errors: `404 USER_NOT_FOUND`, `409 CANNOT_MODIFY_SELF` (use `/api/users/me/password`), `422 PASSWORD_REQUIREMENT` |

## Estimates (scoped to the current user)

| Method | Path | Body | Response / errors |
|---|---|---|---|
| GET | `/api/estimates` | – | `200 Estimate[]`, newest *first-stored* first (same order the desktop app kept: new/duplicated/imported estimates are prepended). |
| PUT | `/api/estimates/{estimate_id}` | JSON `Estimate` | `200 Estimate`. Upsert: creates on first PUT (appended to the top of the list), replaces the document afterwards without changing list position. Errors: `422 ID_MISMATCH` (body `id` ≠ path), `422 INVALID_ESTIMATE` (missing `id`/`status`/`pricingMethod`/`createdAt`/`updatedAt`), `422 VALIDATION_ERROR` (body is not a JSON object, or the path id is malformed), `413 DOCUMENT_TOO_LARGE` (over 512 KiB) |
| DELETE | `/api/estimates/{estimate_id}` | – | `204`. Errors: `404 ESTIMATE_NOT_FOUND` |

`estimate_id` must match `^[A-Za-z0-9_-]{1,64}$`. IDs are unique *per user*.

## Settings (scoped to the current user)

| Method | Path | Body | Response / errors |
|---|---|---|---|
| GET | `/api/settings` | – | `200 Settings` document, or `200 {}` if the user never saved settings (the frontend merges over `defaultSettings()`). |
| PUT | `/api/settings` | JSON `Settings` | `200 Settings`. Errors: `422 VALIDATION_ERROR` (not a JSON object), `413 DOCUMENT_TOO_LARGE` |

## Proposal PDF

| Method | Path | Body | Response / errors |
|---|---|---|---|
| POST | `/api/proposals/pdf` | JSON `{"html": string, "filename": string}` | `200 application/pdf` with `Content-Disposition: attachment; filename="<filename>"`. A4, no margins, backgrounds printed. Errors: `413 DOCUMENT_TOO_LARGE`, `422 VALIDATION_ERROR`, `503 PDF_UNAVAILABLE` (renderer failed/timed out) |

The HTML is rendered in headless Chromium with JavaScript disabled, served under a
strict `Content-Security-Policy` response header, and with every other request
aborted; it must be fully self-contained (inline styles only). Rendering (including
waiting for one of the limited render slots) times out after 20 s.
