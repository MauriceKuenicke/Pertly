# Pertly

**Price projects with numbers you can defend, not gut feel.**

Pertly is a local-first desktop app for freelancers and small agencies who are tired of guessing at project pricing. Instead of a fragile spreadsheet you're afraid to touch, it walks you through a focused 4-step wizard and hands you back a number you can stand behind, plus a polished proposal ready to send.

Price it however fits the engagement:

- **Time & Materials**: three-point (PERT) estimation turns an optimistic, likely, and pessimistic range per deliverable into one defensible budget, with combined uncertainty and a not-to-exceed cap calculated for you.
- **Value-Based Pricing**: quantify what the problem costs the client today, then derive a fee as a share of the value you'll create, checked against a target ROI so you don't leave money on the table.

Every estimate lives as a JSON file on your own machine. No account, no subscription, no cloud sync, no telemetry. Your rates and your clients' numbers stay exactly where you put them.

## Why Pertly

- 🧮 **Two pricing models, one workflow.** Switch between Time & Materials and Value-Based Pricing without leaving the wizard.
- 🔒 **Genuinely local-first.** A single `estimates.json` on disk and no network calls, period. That's enforced by a strict Content-Security-Policy in the renderer, not just a claim in this README.
- 📄 **Client-ready output, automatically.** The client-facing proposal hides your day rate and margins; the internal view keeps the full build-up for your team. One click exports either as a PDF.
- ⚡ **Four steps, no spreadsheet gymnastics.** Assumptions, Pricing, Summary, Proposal, with totals recalculating live as you type.

## Tech stack

- [Electron](https://www.electronjs.org/): desktop shell
- [React](https://react.dev/) + TypeScript: UI
- [Vite](https://vitejs.dev/) (`vite-plugin-electron`): dev server and bundler
- Plain CSS (CSS Modules), no UI framework, no Tailwind
- [Vitest](https://vitest.dev/): unit tests
- [electron-builder](https://www.electron.build/): packaging installers

No database, no ORM, no state-management library: app state is a React Context backed by a single JSON file. This keeps the whole thing easy to read top-to-bottom in one sitting.

## Where your data lives

All estimates are stored in a single `estimates.json` file inside Electron's standard per-user application-data folder:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Pertly/estimates.json` |
| Windows | `%APPDATA%\Pertly\estimates.json` |
| Linux | `~/.config/Pertly/estimates.json` |

Nothing is written anywhere else: no system directories, no registry entries, no background services. Uninstalling the app and deleting that one folder removes Pertly completely.

## Setup

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
```

## Run in development

```bash
npm run dev
```

This starts the Vite dev server and launches the Electron window with hot reload. You can also open `http://localhost:5173` directly in a regular browser to iterate on UI faster. A small dev-only shim mocks the persistence/PDF bridge so the app still runs; PDF export just shows an alert outside Electron.

## Testing

```bash
npm run test
```

Runs the Vitest unit suite: PERT/value-based pricing math, currency and date formatting, and a regression test that verifies the proposal HTML properly escapes user input before it's printed to PDF.

To type-check without building, run `npm run typecheck`.

## Build a native executable

```bash
npm run dist
```

This compiles the app and runs `electron-builder`, producing an installer for your current platform in `release/`:

- macOS: `.dmg`
- Windows: NSIS `.exe` installer
- Linux: `.AppImage`
