# Spec: Marketing Website

Status: **active**. Built and live in `docs/` on `main`. This document should be kept in sync with the actual site the same way the pricing specs are kept in sync with `calc.ts`. If they disagree, that's a bug in one of the two.

One manual step is still required and can't be done from here: GitHub Pages needs to be turned on for this repo (**Settings → Pages → Source: Deploy from a branch → `main` / `docs`**). Once that's saved, the site is live at `https://mauricekuenicke.github.io/Pertly/`.

## Purpose

A small, static marketing site for Pertly, hosted on GitHub Pages, whose only job is to help someone land on the app, understand in under a minute what it does and why it's different, and download it. It is not a web version of the app, not a docs site, and not a growth-marketing funnel. Closer to a well-made one-pager than a "product website."

## Goals

- Primary call-to-action: **download the app** (link to the latest GitHub Release installers).
- Secondary: make the case for *why* someone should trust a random desktop app enough to download and run it. The local-first/no-telemetry story is the strongest asset here and should be treated as a first-class selling point, not a footnote.
- Frame Pertly as **free and open source**, now that the repo has an actual license.
- Look intentionally *not* like a generic AI-generated SaaS landing page. See "Things to actively avoid" below, this was explicit in the brief and should be treated as a real constraint, not a vibe.
- Copy across the whole site avoids em-dashes, by house style. Use a period, comma, colon, or parentheses instead, whatever the sentence actually calls for.

## Non-goals

- No user accounts, forms that submit anywhere, or backend of any kind.
- No analytics or tracking scripts. Consistent with the app's own zero-telemetry positioning: a marketing site that tracks visitors while advertising "no telemetry" would undercut its own pitch.
- No CMS, no build step, no framework. Plain HTML/CSS/JS, hand-written.
- Not trying to rank for competitive SEO terms or run paid acquisition. This is a landing page for people who already have some reason to look (a link from a forum post, GitHub, word of mouth), not a lead-gen machine.

## Audience & voice

Primary audience: solo freelancers pricing their own work (matches the app's primary user). Secondary: small agencies.

**Voice: warm and approachable.** Talks to "you" directly, acknowledges the actual moment of anxiety (typing a number into an email and hitting send), doesn't hide behind corporate plural ("our platform," "users") or false enthusiasm. Confident but not salesy, closer to how the README already talks ("numbers you can defend, not gut feel") than to typical landing-page copy.

### Things to actively avoid

Called out explicitly in the brief, worth keeping as a checklist while writing/reviewing copy and layout:

- Generic SaaS visual clichés: gradient-blob backgrounds, floating 3D shapes, identical rounded-icon-in-a-circle feature grids.
- Stock photography. No smiling people at laptops. Real screenshots of the app carry the visual weight instead.
- Fake social proof. No invented testimonials, fake logos, made-up user counts. Pertly doesn't have public users yet, so the site shouldn't pretend it does.
- Hype-y copy: no "supercharge," "revolutionize," "game-changing," rhetorical "Tired of X?" openers, or exclamation-point energy.
- Being cagey about the rough edges. See the code-signing warning below. Naming a real flaw plainly is more convincing than pretending it doesn't exist, and it's the opposite of how AI-generated landing pages tend to read.
- Em-dashes, anywhere in the copy. See "Goals" above.

## Information architecture

Two pages:

- `index.html`: everything. Hero, problem framing, how it works, screenshots, download, FAQ, footer.
- `methods.html`: a deeper (but still marketing-level, no formulas) look at Time & Materials vs. Value-Based Pricing, since that distinction is genuinely non-obvious and deserves more room than a homepage section. Linked from a homepage teaser section, not from primary nav (keeps the header simple: logo, "Methods," "GitHub," a download button).

## Visual design system

### Palette: same family as the app, tuned for a marketing context

Reuses the app's actual tokens (`src/styles/tokens.css`) rather than inventing a new brand, per the "same family, site-tuned" decision:

| Use | Value | Source |
|---|---|---|
| Accent / primary | `#a8564e` (terracotta) | `--brand-primary` |
| Accent hover | `#954a43` | `--brand-primary-hover` |
| Light background | `#f5f0ec` (cream) | `--bg-app` |
| Card / surface | `#ffffff` | `--bg-surface` |
| Subtle fill | `#f1e8e5` | `--bg-subtle` |
| Dark section background | `#2a1116` (deep maroon) | `--bg-inverse` |
| Body text | `#2a1116` | `--text-primary` |
| Secondary text | `#6b5450` | `--text-secondary` |
| Borders | `#e5d9d6` / `#d4c2be` | `--border-default` / `--border-strong` |
| Secondary accent (badges, small highlights only) | `#b8823a` (ochre) | `--estimate-pessimistic` |

The one addition beyond a direct token reuse: the ochre accent gets promoted from its narrow in-app role (pessimistic-case badges) to a general secondary accent for the site, so there are two warm accent colors to work with for things like kicker labels and the FAQ's active-question state, without introducing a new hue that would make the site feel like a different brand from the app.

### Typography

- **Body & UI text: Inter** (same as the app, already self-hosted via `@fontsource/inter`, so this is free consistency).
- **Display headlines: Fraunces**, a warm serif with real character (ball terminals, optical-size variation) rather than a neutral corporate serif. Self-hosted as static `.woff2` files, no Google Fonts CDN call. Keeps the "nothing calls out to a third party" story intact even though it's not strictly required for a marketing site.
- Headlines run large, set with a slightly tightened letter-spacing and `text-wrap: balance` so multi-line headlines break evenly instead of leaving a lonely short line. Body copy stays modest; this is a page people skim, not read end to end.

### Layout principles

- Real app screenshots, shown inside a simple flat browser-chrome frame (a plain rounded rectangle with a thin top bar). Echoes the app's own proposal-preview chrome (`ProposalDoc`/Share screen), rather than a glossy device mockup PNG.
- Asymmetric hero: headline and copy on one side, a single screenshot on the other, slightly rotated and offset rather than perfectly centered. Reads as considered rather than templated.
- No icon-in-a-circle feature grids. Where a list of points is needed (e.g. "how it works"), it's numbered steps paired with a screenshot per step, not abstract icons.
- Generous whitespace; sections separated by color-block changes (cream, white, dark maroon) rather than hard rules everywhere.
- Rounded corners and shadow values reuse the app's own `--radius-*` / `--shadow-*` scale for visual continuity.

### Motion & interaction

Added in a later pass, to read as more contemporary without reaching for the clichés in "Things to actively avoid":

- **Sticky, blurred header.** `position: sticky` with `backdrop-filter: blur()` and a soft translucent background; picks up a subtle border and shadow once the page has scrolled a few pixels (`.is-scrolled`, toggled by `script.js`).
- **Scroll-reveal.** Major content blocks (`[data-reveal]`) fade and rise into place the first time they cross into the viewport, via a small `IntersectionObserver` in `script.js`. The FAQ list staggers its four items slightly (`[data-reveal="stagger"]`). Fully progressive enhancement: content is plain and visible with JS disabled, and `prefers-reduced-motion: reduce` disables the animation entirely rather than just speeding it up.
- **Hover polish.** Buttons lift a pixel with a soft colored shadow; screenshot frames lift more noticeably on hover; nav links get an animated underline; FAQ rows tint on hover. All standard, tasteful micro-interactions, nothing that would read as a gimmick.

## Screenshots

Five real screenshots were captured against the running dev server with realistic sample data (a "€34,398 fixed-price website redesign" T&M estimate and a "€9,352 ops-automation" VBP estimate), headless via Playwright, and live at `docs/assets/screenshots/`:

| File | Shows |
|---|---|
| `tm-work-breakdown.png` | T&M work breakdown table + live cost-build-up sidebar |
| `tm-cost-buildup.png` | T&M Summary step: fixed-price KPIs, cost build-up card, governance checklist |
| `vbp-fee-derivation.png` | VBP scenario cards, attribution/value-capture sliders, fee derivation panel, pricing tiers |
| `client-proposal.png` | The client-facing PDF-style proposal (Share screen, T&M) |
| `vbp-client-tiers.png` | The client-facing VBP proposal's three pricing tiers (Diagnostic Sprint / Core Rollout / Full Automation Program), with names and descriptions filled in, plus payment schedule and assumptions below |

Not yet captured, worth considering later: the Assumptions screen (risk-coverage slider) and the All Estimates list. Low priority; the five above already cover the core "here's the math, here's what you send" narrative for both pricing methods.

Image placement as built: **`vbp-client-tiers.png` is the hero image** (the tiered proposal reads as the most immediately legible "this is what you get" shot). "How it works" steps 2 to 4 use `tm-work-breakdown.png`, `vbp-fee-derivation.png`, and `vbp-client-tiers.png` again. `methods.html` pairs `tm-work-breakdown.png` + `tm-cost-buildup.png` for Time & Materials and `vbp-fee-derivation.png` + `vbp-client-tiers.png` for Value-Based Pricing.

## Page-by-page content

Copy below matches what's shipped in `docs/`. If you edit the HTML, update this too.

### `index.html`

**Header**: wordmark "Pertly" (no icon mark, per the logo decision below), nav: "Methods," "GitHub," a filled "Download" button.

**Hero**

> ### Send a price you can stand behind.
> Pertly walks you through a short wizard and hands back a number backed by real math, plus a client-ready proposal to send. Everything stays on your machine. Nothing is ever sent anywhere.
>
> **[Download Pertly]**  ·  [View on GitHub →]

Image: `vbp-client-tiers.png`, offset to one side, inside the browser-chrome frame.

**"Why this exists"**

> ### The spreadsheet was never the problem.
> Most freelancers already have a system: a spreadsheet, a gut-feel multiplier, a number that felt right last time. It works, until a client pushes back and you're left explaining a figure you can't fully account for. Pertly doesn't replace your judgment. It gives the number underneath it a paper trail: a range, a confidence interval, a value calculation you can walk someone through line by line.

**"How it works"**: four numbered steps, each with a short line; steps 2 to 4 each carry a screenshot.

1. **Set your assumptions.** Day rate, overhead, risk buffer, and which pricing model actually fits: effort-based or value-based.
2. **Break down the work, or quantify the value.** A handful of numbers per deliverable. Optimistic, likely, pessimistic. Pertly does the weighting. *(screenshot: `tm-work-breakdown.png`)*
3. **Get a defensible number.** A not-to-exceed cap, or a recommended fee checked against a target ROI, never a single unexplained guess. *(screenshot: `vbp-fee-derivation.png`)*
4. **Send a proposal.** Client-ready PDF, your day rate and margins hidden automatically. Choose from a few tiers, or one clean number. *(screenshot: `vbp-client-tiers.png`)*

**Two methods teaser**

> ### Effort-based or value-based: your call, every time.
> Rule of thumb: if you can put a number on what the work is worth to the client, price the value. If the impact is hard to quantify or the scope is exploratory, price the effort. Pertly supports both, and switching doesn't mean leaving the wizard.
>
> [Learn how the two methods work →](methods.html)

*(Reuses the app's own "rule of thumb" line from the Assumptions screen, deliberately, to keep the voice consistent between app and site.)*

**"Nothing leaves your machine"** (dark section, `--bg-inverse`)

> ### Nothing leaves your machine.
> No account. No cloud sync. No analytics on this website or in the app. Every estimate is a single JSON file on your own computer, enforced by a strict content-security policy in the app itself, not just a line in a privacy policy nobody reads.

**Download**

> ### Get Pertly
> Free, and the code is on GitHub.
>
> **[Download for macOS]**   **[Download for Windows]**
>
> *Heads up: builds aren't code-signed yet, so macOS and Windows will show a warning the first time you open it. Normal for a small open-source tool. See the FAQ below for the two-second fix.*

Both buttons, plus the header button, point at `https://github.com/MauriceKuenicke/Pertly/releases/latest` (GitHub resolves this to whichever release is newest, so the site never goes stale as new versions ship).

**FAQ**

> **Is my data really private?**
> Yes. Pertly doesn't talk to the network at all. That's enforced by the app's Content Security Policy, not just a promise. Every estimate lives in one JSON file on your machine. Delete the app, delete the file, and there's nothing left anywhere.
>
> **Why two pricing methods?**
> Not every engagement prices the same way. Time & Materials breaks work into deliverables and prices the effort, with a not-to-exceed cap so scope creep doesn't quietly become unbilled time. Value-Based Pricing prices the outcome instead, useful when you can point to a real number the work will save or make the client, and you'd rather not leave money on the table billing by the hour.
>
> **Why does my computer warn me not to open this?**
> Because the installers aren't code-signed. That costs money this project hasn't spent yet. macOS will call it "damaged"; it isn't. Right-click the app and choose **Open**, or run `xattr -cr /Applications/Pertly.app` in Terminal, and it'll open normally after that. Windows SmartScreen may show a similar one-time warning: click **More info → Run anyway**.
>
> **Is it free?**
> Yes, and it's open source. No account, no subscription, nothing to unlock later.

**Footer**: wordmark, GitHub link, Releases link, License link, "No cookies, no analytics, no tracking: not on this page, not in the app."

### `methods.html`

> # Two ways to price a project
>
> Every estimate in Pertly picks one of two methods. Both end in the same place: a number and a proposal. They just get there differently.
>
> ## Time & Materials
> *(screenshots: `tm-work-breakdown.png`, then `tm-cost-buildup.png`)*
> You break the project into deliverables and estimate each one three ways: optimistic, most likely, pessimistic. Pertly turns that into an expected effort and a confidence range, then layers on overhead and a contingency buffer. You get a recommended budget and a not-to-exceed cap: a ceiling the client can hold you to, and you can hold yourself to.
>
> Good for: exploratory work, scope that's likely to shift, anything where "we'll figure it out as we go" is an honest description of the engagement.
>
> ## Value-Based Pricing
> *(screenshots: `vbp-fee-derivation.png`, then `vbp-client-tiers.png`)*
> You quantify what the problem is costing the client today (wasted time, errors, delayed revenue), then work out a conservative, moderate, and aggressive case for how much of that you'll recover. Your fee is a share of the conservative case, checked against a target return so the client is getting a good deal and you're not leaving money on the table. It lands as a tiered proposal, so the client picks a scope, not just a price.
>
> Good for: work with a measurable business outcome, where the value you create is worth more than the hours it takes.
>
> ## Which one do I use?
> Rule of thumb: if you can put a number on the value, price the value. If you can't, or the scope is too fuzzy to trust that number yet, price the effort. You're not locked in; every new estimate picks fresh.
>
> [← Back to Pertly](index.html)

## Logo & favicon

Decision: **wordmark only**, no icon mark, for the site's actual branding (nav, footer, hero). "Pertly" set in Fraunces.

A favicon still needs an icon; a wordmark doesn't read at 16 to 32px. Resolution: a small square monogram reusing the app's own sidebar mark (terracotta square, white "P"), generated as a simple SVG favicon. Not a second logo, just a practical concession to browser tab real estate.

## Technical constraints

- Plain HTML/CSS/JS, hand-written, no build step, no framework, no npm dependency for the site itself.
- Lives in `docs/` on `main`; GitHub Pages configured to serve from `main` / `docs` (Settings → Pages → Deploy from a branch). No GitHub Actions workflow needed for deployment.
- No analytics, no third-party embeds, no tracking pixels.
- Fonts self-hosted as static `.woff2` under `docs/assets/fonts/`. No Google Fonts (or any other) CDN request.
- Minimal vanilla JS only for: the mobile nav toggle, the header's scrolled-shadow state, and the scroll-reveal `IntersectionObserver`. The FAQ accordion uses native `<details>`/`<summary>` and needs no JS at all. No client-side framework.
- Fully responsive; no fixed desktop-only layouts.
- Basic accessibility: semantic landmarks, alt text on every screenshot, visible focus states, sufficient color contrast (the dark maroon-on-cream palette already reads well here), and all motion gated behind `prefers-reduced-motion`.

### File layout (as built)

```
docs/
  index.html
  methods.html
  styles.css
  script.js                # nav toggle, header scroll state, scroll-reveal observer
  assets/
    favicon.svg            # terracotta square, white "P", reuses the app's sidebar mark
    fonts/                 # Inter (400/500/600/700/800) + Fraunces (400/600/700), self-hosted .woff2
    screenshots/
      tm-work-breakdown.png
      tm-cost-buildup.png
      vbp-fee-derivation.png
      client-proposal.png
      vbp-client-tiers.png
```

## Resolved decisions

- **License: MIT.** `LICENSE` added at the repo root, `package.json`'s `license` field updated from `UNLICENSED` to `MIT`. The repo was already public.
- **Download buttons: static links.** Both buttons, plus the header button, point at `https://github.com/MauriceKuenicke/Pertly/releases/latest`, no JS version-fetch. Simpler, zero extra requests, and GitHub keeps it correct automatically.
- **Additional screenshots: not needed.** The five captured shots (see above) cover both methods end-to-end; the Assumptions screen and All Estimates list were left out as planned.
- **Hero image: `vbp-client-tiers.png`.** Swapped from the original `client-proposal.png` pick; the tiered pricing view reads as a more immediately compelling "here's the deliverable" shot for a first-time visitor.
- **No em-dashes anywhere in site copy.** House style, applied across every page and this spec's own quoted copy blocks.
- **Motion and hover polish.** Sticky/blurred header, scroll-reveal on content sections, and richer hover states on buttons, screenshots, and nav links. Added to read as more contemporary without reintroducing the clichés in "Things to actively avoid."

## Open questions

- **Copy review.** The copy has been through one full revision pass already. Still worth a periodic read-through on the live site.
- **GitHub Pages toggle.** See the note at the top of this document; needs a one-time manual setting change in the repo.
