# Spec: Accounts & Storage

This describes the business rules for who can use a Pertly instance and where their work is kept, not how it's coded. The pricing logic itself is specified in [`time-materials.md`](time-materials.md) and [`value-based-pricing.md`](value-based-pricing.md).

## Purpose & context

Pertly runs as an internal, self-hosted web application. One instance serves a team (typically a freelancer collective or a small agency) from a single server. Each person signs in with their own account. Pertly's primary user is still a **solo freelancer** setting their own rates and policies: an account behaves exactly like the former desktop app did for one person, now available from any browser on the internal network.

## Accounts

- **Sign-in** uses an email address and a password. There are no email flows: no verification, no "forgot password" mail. The instance never sends mail.
- **Passwords** need at least 8 characters, including a digit, a lower-case letter and an upper-case letter.
- **Emails are unique per instance** and are treated case-insensitively.
- **Sessions** last 30 days from the last activity (configurable). Signing out ends only the current browser's session.
- **Changing your own password** requires the current one. It signs out every other browser of that user and keeps the current one signed in.

## Roles

There are two roles: **user** and **admin**.

- **Users** manage their own estimates and settings.
- **Admins** additionally manage accounts:
  - list them
  - create them (also while self-registration is closed)
  - activate or deactivate them
  - grant or revoke the admin role
  - set a new password, which they hand over in person
  - delete them
- **Deactivating** an account signs it out everywhere and blocks sign-in, but keeps its data. **Deleting** an account removes the account together with all its estimates and settings, permanently.
- **An admin cannot change or delete their own account** from the admin screen. This prevents accidental self-lockout.
- **The instance always keeps at least one active admin.**

## Getting the first account

- **Whoever registers first on a fresh instance becomes admin.** Registration is always possible while no account exists, so an install can never lock itself out.
- **Alternatively, the operator can pre-create the admin**, either via configuration (applied only while the instance has no accounts) or via the command line. Do this before exposing a fresh instance on a shared network.
- **After the first account exists**, self-registration is open by default and can be switched off. When it is off, only admins create accounts.

## Data ownership & privacy

- **Estimates and default settings belong to exactly one account.** Nobody else sees them, admins included: the admin screen manages accounts, not their content.
- **Sharing between colleagues** works the same way it did on the desktop: through the share code on step 4, which the recipient imports as their own independent copy.
- **The server stores each estimate exactly as the app works with it.** The pricing rules are applied by the app, so a stored estimate always reopens with identical numbers.
- **The list order** stays as it always has been: new, duplicated and imported estimates appear on top, and editing never reorders the list.
- **Saving is automatic.** Every change is saved shortly after it's made, and the screen shows "Saving…" / "Saved just now".
  - If the server can't be reached, the app keeps the changes, shows "Not saved – retrying…", and retries on its own.
  - If the session expired, the app asks the user to sign in again without losing what's on screen.
- **A brand-new estimate is only stored once the user continues past step 1 or saves it as a draft.** An abandoned "New estimate" click leaves nothing behind (unchanged from the desktop app).
- **The same account open in two browser tabs:** the most recent save of an estimate wins.

## PDF export

- **Proposals are turned into PDFs on the server.** The result is A4, edge to edge, with backgrounds, the same as the desktop export. It then downloads in the browser.
- **The client view and the internal view** follow the rules in the pricing specs: day rates and margins never appear in the client view.
- **Rendering never loads anything external and never runs scripts** contained in user-entered text.

## Moving from the desktop app

People who used Pertly Desktop keep their work. Their local data file can be brought over in two ways:
- **By the user**, from the Settings screen ("Import from Pertly Desktop").
- **By an operator**, on the command line for a given account.

The import works like this:
- Imported estimates keep their desktop order.
- Estimates the account already has are skipped, never overwritten.
- The desktop default settings are taken over only if the account has none yet, or if the user explicitly asks for it.

## Planned changes

None currently outstanding.

## Open questions

See `docs/DECISIONS.md` § "Open decisions" for product questions the migration deliberately left at a default.
