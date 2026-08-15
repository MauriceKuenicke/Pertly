# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Pertly is a local-first Electron desktop app that walks a freelancer/agency through a 4-step wizard to produce a defensible project price and a client-ready proposal PDF. Its primary user is a **solo freelancer** setting their own rates and policies (small agencies are supported but secondary) — that framing matters when deciding whether something should be a fixed, opinionated default or a per-user setting. There are two independent pricing methods ("branches") a user can pick per-estimate in step 1:

- **Time & Materials (T&M)**: three-point (PERT) estimation per work package → day-rate cost → overhead → contingency → recommended budget + not-to-exceed cap.
- **Value-Based Pricing (VBP)**: annual value of the problem → conservative/moderate/aggressive scenarios → attribution → value capture rate → recommended fee → three pricing tiers.

Full business logic for each branch — the methodology, the rules, the rationale behind them, and known gaps — is documented in [`specs/time-materials.md`](specs/time-materials.md) and [`specs/value-based-pricing.md`](specs/value-based-pricing.md). **Read the relevant spec before changing pricing logic.** These specs are written deliberately at a *business* level — what the rule is and why, not which function or file implements it — so they stay meaningful even as the code around them changes; the code (`src/lib/calc.ts` and the pricing screens) is the source of truth for what currently runs, and the specs are the source of truth for what it's supposed to do and why. If you find them disagreeing, reconcile both in your change: update the spec's prose whenever you touch a formula, default, threshold, or business rule it documents, and if a spec's "Planned changes" section describes something you just built, move it into the spec's main body and out of that section. Each spec also has an "Open questions" section for product decisions nobody has made yet — resolve those with the user (not by guessing) before building against them, and fold the resolution back into the spec, the same way this pass resolved the previous round's open questions.

There is no backend and no network calls (enforced by the CSP in `index.html`). All state is one JSON file (`estimates.json`) in Electron's per-user app data dir, read/written wholesale through IPC — see README.md for the exact paths and for user-facing product framing.

## Commands

```bash
npm run dev         # Vite dev server + Electron with hot reload
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (all tests, single pass)
npm run build        # tsc + vite build (compiles renderer + electron main/preload)
npm run dist         # build + electron-builder (produces installer in release/)
```

Run a single test file or case with vitest directly, e.g.:

```bash
npx vitest run src/lib/calc.test.ts
npx vitest run -t "combines package sigma via root-sum-of-squares"
```

CI (`.github/workflows/ci.yml`) runs `npm run typecheck` and `npm run test` on every PR and push to `main` — both must pass. There is no lint script.

You can also open `http://localhost:5173` in a plain browser instead of the Electron window for faster UI iteration; `src/lib/devPreviewShim.ts` stubs `window.pertly` in that case (PDF export just shows an alert).

## Architecture

**Process split.** `electron/main.ts` (main process) owns the `BrowserWindow`, the two IPC handlers (`store:read`/`store:write` in `electron/persistence.ts`, `pdf:export` which loads generated HTML into a hidden `BrowserWindow` and calls `printToPDF`), and is the only place that touches the filesystem. `electron/preload.ts` exposes exactly three methods on `window.pertly` (`readStore`, `writeStore`, `exportPdf`) via `contextBridge`; `contextIsolation`/`sandbox` are on and `nodeIntegration` is off, so the renderer (`src/`) never touches Node or the filesystem directly.

**State.** `src/state/EstimatesContext.tsx` is the single source of truth for the whole app: it holds `{ estimates: Estimate[], settings: Settings }`, loads it once via `window.pertly.readStore()`, and debounce-saves (400ms) on every change via `writeStore`. There's no per-screen local state for estimate data — every screen reads `activeEstimate` from context and calls `onChange(updater)` to mutate it immutably. Notable behavior: a newly-created estimate lives in a separate `draftEstimate` slot, not in `store.estimates`, until the user advances past step 1 or explicitly saves — so an abandoned "New estimate" click never pollutes the list.

**Wizard routing.** `src/App.tsx`'s `WizardRouter` switches on `activeEstimate.currentStep` (1–4) and `pricingMethod` to pick the T&M or VBP variant of the Pricing (step 2) and Summary (step 3) screens; step 1 (Assumptions) and step 4 (Share) are shared across both methods. Screen components live under `src/screens/<Area>/` and share the `WizardScreenProps` contract (`src/screens/wizardProps.ts`).

**Pricing math is centralized.** All formulas — PERT expected/sigma, role-rate resolution, overhead/contingency layering, value-based scenario scaling, payment-split presets, break-even effort — live in `src/lib/calc.ts` and nowhere else. Screens and the proposal-HTML generator both call into it; never re-derive a total inline in a component. `src/lib/calc.test.ts` is the executable spec for edge cases (empty work-package list, zero fee, deleted-role fallback, cap-never-below-budget, etc.) — check it before assuming a formula's behavior at a boundary.

**Two renderers of the same proposal, kept manually in sync.** Every proposal view exists twice: as a React component under `src/screens/Share/` (`ClientOverviewTM`, `ClientOverviewVBP`, `InternalDetailTM`, `InternalDetailVBP`, shown live in the app) and as a hand-built HTML string in `src/lib/proposalHtml.ts` (`clientOverviewTmHtml`, etc., which is what actually gets printed to PDF via `pdf:export` — the PDF is *not* a screenshot/print of the live React view). **Changing what a proposal shows means editing both the `.tsx` component and its `proposalHtml.ts` counterpart.** All free-text fields in `proposalHtml.ts` go through the local `esc()` HTML-escaper before interpolation — `proposalHtml.test.ts` locks this in as a regression test (an unescaped field there is a script-injection hole inside the Electron `BrowserWindow` used for PDF export). Preserve that pattern for any new interpolated field.

**Estimate lifecycle helpers** live in `src/lib/newEstimate.ts`:
- `createEstimate(settings)` seeds a new estimate from Settings defaults.
- `normalizeEstimate(estimate)` backfills fields added after initial release (roles, payment splits, service lines) — every estimate coming from *outside the current session* (disk load, share-code import) must pass through this before the rest of the app touches it.
- `freshenEstimate`/`cloneEstimate`/`importEstimateFromShareCode` all re-mint IDs for every nested list item (work packages, roles, value drivers, tiers) and remap cross-references (`roleId`, `recommendedTierId`) to the new IDs, so a duplicated or imported estimate never aliases the source's identifiers.

When adding a new field to `Estimate`/`TimeMaterialsData`/`ValueBasedData` (`src/types/estimate.ts`), you generally need to touch: the type, `createEstimate`, `normalizeEstimate` (backfill default), `freshenEstimate` if it's a list needing fresh IDs, and `isEstimateShape` in `src/lib/shareCode.ts` if it's structurally load-bearing for share-code validation.

**Formatting** goes through `src/lib/currency.ts` (`formatMoney`, `formatDays`, `currencySymbol` — currency support is a hardcoded `SYMBOLS` map of EUR/USD/GBP/CHF, unknown codes fall back to `"<CODE> "`) and `src/lib/date.ts`. Use these rather than formatting numbers/dates ad hoc, so PDF and live view stay pixel-identical to each other in wording.

**Styling** is plain CSS Modules per component (`Foo.module.css` next to `Foo.tsx`), no Tailwind/UI framework; shared primitives live in `src/components/ui/` (Button, Card, Field, Slider, Modal, Badge, InfoTooltip) and layout chrome in `src/components/layout/` (WizardLayout, Sidebar, FooterBar, WindowTitleBar, StepTopBar).
