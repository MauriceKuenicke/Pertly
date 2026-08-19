# Spec: Time & Materials Pricing

Status: **active**. This describes the business logic and rules for the Time & Materials (T&M) pricing method — not how it's coded. If the running app disagrees with this document, that's a bug in one of the two; reconcile them.

## Purpose & when to use

T&M is Pertly's **fallback** pricing method (Value-Based Pricing is the default — see [`value-based-pricing.md`](value-based-pricing.md)). It prices an engagement as effort × day rate plus explicit risk buffers, for situations where scope is exploratory, time-boxed, or the business value genuinely can't be pinned down well enough to price against it directly.

Pertly's primary user is a **solo freelancer** setting their own rates and policies (small agencies are supported but secondary). Across both pricing methods, the app is trying to protect the user from three things at once, not one dominant risk: pricing too low, letting scope quietly expand past what was priced, and looking unpolished/amateur to the client. T&M's specific contribution to that is the not-to-exceed cap (protects against scope creep) and the explicit optimistic/likely/pessimistic range (protects against pricing off a single too-optimistic guess).

T&M covers two different commercial arrangements built on the same underlying estimate: billing for **actual time worked** (variable — the default), or agreeing a **single fixed price** upfront (see "Fixed-price mode" below). The deliverable breakdown and PERT math are identical either way; what changes is which number gets quoted and how it's billed.

## Core methodology

### 1. Per-deliverable three-point estimate

The project is broken into deliverables ("work packages"). For each one, the user enters three numbers in days:

- **Optimistic** — best case
- **Most likely**
- **Pessimistic** — worst case

From these:

- **Expected effort** = (Optimistic + 4 × Most likely + Pessimistic) ÷ 6 — the standard three-point (PERT) weighting, which counts the "most likely" case six times as heavily as either extreme. This turns a fuzzy range into one defensible number per deliverable instead of a single guess.
- **Uncertainty (σ)** = (Pessimistic − Optimistic) ÷ 6 — how much risk this specific deliverable carries.

**Business rule**: Optimistic ≤ Most likely ≤ Pessimistic is always enforced. If a user types values out of that order, the app quietly pushes the later bound up to meet the earlier one rather than rejecting the input or showing an error — entry stays frictionless, and the uncertainty math can never go negative (which would misleadingly read as "negative risk").

### 2. Day rate — blended or role-based

An estimate bills every work package the same way, chosen once per estimate:

- **Blended rate** — one day rate for everything.
- **Role-based rates** — each work package is assigned a role (e.g. Junior, Senior), each with its own day rate, so a team's mixed-seniority delivery is priced accurately instead of averaged away.

If a work package has no role assigned, or its role has since been removed from the roster, it automatically bills at the blended rate rather than being priced at zero — a line item should never silently disappear from the budget.

### 3. Combining the project total

- Expected effort and cost sum simply across all deliverables.
- **Combined uncertainty** across the whole project is computed as the root-sum-of-squares of each deliverable's uncertainty, not a simple sum — the statistically correct way to combine independent risks, so the project's overall risk band isn't overstated.
- **Overhead %** (non-billable effort: PM time, communications, ramp-up) is applied on top of the base delivery cost.
- **Contingency %** (buffer against estimation uncertainty) is then applied on top of the cost-plus-overhead subtotal — contingency compounds on overhead, it isn't a second markup on the raw cost.
- **Recommended Budget** = cost + overhead + contingency. This is the number the app tells the user to quote.

### 4. Not-to-exceed cap

A ceiling price, computed from every deliverable's *pessimistic* (worst-case) days, marked up by the same overhead and contingency percentages, compounded the same way, as the recommended budget.

**Invariant**: the cap can never be lower than the recommended budget being quoted. A "you'll never pay more than X" promise that's below the quoted price X would be a serious credibility failure — this has to hold for every possible input, including a very tight optimistic/pessimistic spread. (This was previously violated by a calculation bug and has since been fixed and is now explicitly protected against regressing.)

In fixed-price mode (below), this figure becomes one end of the risk-coverage slider's range — the 100% setting — rather than always being *the* quoted price outright; see "Fixed-price mode" for how much of it actually gets priced in.

### 5. Pass-through expenses

Hardware, licenses, travel, and similar costs are added **after** the recommended budget, at cost, with no overhead or contingency markup — those markups price labor, not reimbursed costs.

### 6. Payment schedule

Once the total (recommended budget + pass-through expenses) is known, the user picks a suggested payment schedule. In variable/actuals mode (the default), the options reflect that the final number isn't agreed in advance — both are open-ended, ongoing arrangements rather than a deposit-then-lump-sum structure:

| Schedule | Split | Default? |
|---|---|---|
| Monthly in Arrears | 100% billed monthly for actuals, no deposit | **yes** |
| Deposit & Monthly | 20% deposit (credited against the final invoice), 80% billed monthly in arrears | |

T&M defaults to monthly-in-arrears rather than a deposit/milestone structure, since it bills for actual time worked rather than a fixed deliverable. Neither option itemizes individual monthly invoices (T&M has no concept of engagement duration to itemize against) — they're framed as ongoing billing, not a fixed schedule.

A 50/50 split or a single payment on completion doesn't fit variable billing — those imply a total agreed in advance, which is what fixed-price mode is for (below).

### 7. Minimum viable estimate

An estimate can't be carried past the pricing step until at least one deliverable has a non-zero cost. This exists to catch an obvious mistake — an empty work breakdown, or one where every deliverable is still at zero days, would otherwise silently produce a €0 budget with no warning.

### 8. Effective day rate (internal only)

Alongside the recommended budget, T&M also surfaces the **effective day rate**: the blended day rate actually being realized on this estimate once overhead is folded in — base cost ÷ expected effort, marked up by the overhead percentage. In blended-rate mode this lands close to the day rate entered on the Assumptions step (just marked up by overhead); in role-based mode it's the true blended average across whatever mix of roles ended up doing the work, which the raw per-role rates alone don't show at a glance.

This mirrors Value-Based Pricing's break-even day rate: an internal profitability reference, never a client-facing figure. It appears in exactly two places — the in-app Summary step, and the Internal Detail proposal document — and nowhere else. Not the Pricing step (the estimate is still being shaped there), and not the client-facing proposal, for the same reason day rates are never disclosed to the client at all (see "What the client sees vs. what stays internal," below).

## What the client sees vs. what stays internal

The client-facing proposal never reveals a day rate — not even in role-based mode, where it shows only how many roles were involved, never their rates. Rate confidentiality is a hard rule, not a per-estimate choice. The client view shows: each deliverable's allocated share of the recommended budget, the total, the not-to-exceed cap, pass-through expenses, the payment schedule, and the assumptions/exclusions list.

The internal view additionally shows: the day rate (or full role roster and rates), the overhead/contingency percentages, the not-to-exceed cap's basis, a role-by-role cost breakdown, and the full optimistic/likely/pessimistic/expected/uncertainty table per deliverable.

Every T&M proposal also carries a fixed **governance checklist** — not-to-exceed alerting, reporting cadence, backlog ownership, change-handling process, and attaching assumptions/exclusions — presented as recommended practice for how the engagement should be run day to day. The copy stays neutral: it never invokes a company or an internal policy reference, since the user setting these terms is the one reading them.

Everything above describes variable/actuals mode, T&M's default. Fixed-price mode (below) changes several of these.

## Fixed-price mode

T&M can additionally be quoted as a **single fixed price** instead of billed against actual time — a toggle available only within the T&M branch (Value-Based Pricing is already effectively fixed-price by definition; see [`value-based-pricing.md`](value-based-pricing.md)), and independent of the role-based-pricing toggle. Turning it on changes what number gets quoted and how it's billed. It does **not** change how the estimate is built: the same deliverable breakdown, three-point ranges, day rates, overhead, and contingency all work identically either way. It's a commercial-terms layer on top of the same underlying estimate, not a different estimation method.

There's no Settings-level default for this toggle, unlike role-based pricing. Every new estimate starts in variable mode; switching to fixed-price is a deliberate, per-estimate choice each time.

**What changes:**

- **The quoted price becomes a risk-adjusted figure, not the plain recommended budget.** How much of the optimistic-pessimistic spread gets priced in is a slider the user sets (see "Risk coverage slider," below) rather than always defaulting to the full worst case. A fixed price means the freelancer absorbs any overrun beyond what they quoted, with nothing further to fall back on, so the risk coverage they choose is a real commercial decision, not a formality.
- **The "not-to-exceed cap" concept disappears from the client-facing view**, replaced by the fixed price itself — once the price is fixed, a second client-facing "ceiling" above it is redundant, there's nothing left to cap. Internally, both the expected-case figure and the full pessimistic-case ceiling (100% risk coverage) stay visible as reference points either side of the quote — "here's what I actually expect to spend" and "here's the absolute worst case if I'd priced in all of it" — so the freelancer can see how exposed the chosen risk coverage leaves them.
- **The payment schedule switches to a different preset list** (below).
- **The governance checklist swaps its cap-monitoring item for a change-order item** (below).
- **Pass-through expenses are unaffected.** They stay itemized and billed at cost on top of the fixed price, exactly as in variable mode and in VBP. "Fixed price" describes the professional fee, not a promise to absorb hardware, licensing, or travel costs too.

**Risk coverage slider** controls how much of the optimistic-pessimistic spread the fixed price prices in, from 0% (the plain expected-case cost) to 100% (the full pessimistic-case cost) — set on the Assumptions step, next to the Variable/Fixed toggle, and only shown in fixed-price mode. Mechanically, it interpolates linearly between the *pre-markup* expected cost and pessimistic cost, then applies the same overhead and contingency markup as every other build-up in this spec:

```
riskAdjustedCost = expectedCost + (pessimisticCost − expectedCost) × riskCoveragePct
fixedPrice       = (riskAdjustedCost × (1 + overheadPct)) × (1 + contingencyPct)
```

At 0% this is identical to the recommended-budget build-up; at 100% it's identical to the pessimistic-case/not-to-exceed build-up — so the slider's two ends exactly reproduce the two numbers that existed before this feature, and every value in between is a defensible blend of the two. Overhead and contingency percentages themselves are unaffected by the slider; only which pre-markup cost they're applied to changes.

**Default: 30%.** This intentionally leans toward the likely case rather than pricing in the full worst case (which most engagements don't hit), while still absorbing a meaningful slice of it rather than quoting the bare expected cost with zero cushion — a freelancer who accepts the default is covered for roughly moderate schedule slippage, not just the exact PERT expectation. Unlike role-based pricing there's no Settings-level default for this slider (see "Fixed-price mode has no Settings-level default," below, which extends to the risk-coverage slider too) — every new estimate starts at 30% and it's revisited per engagement, same as the fixed/variable choice itself.

**Payment schedule in fixed-price mode** reuses the same five presets Value-Based Pricing uses — Standard (30/40/30), Deposit & Delivery (50/50), Full Upfront (100% on signing), Payment on Completion (100% on delivery), Quarterly (25×4); see that spec's payment schedule section for the full table. A fixed-price T&M quote and a VBP quote are structurally identical at this point — one agreed number, split into milestones — so there's no reason for T&M to maintain a second copy of the same options. The variable-mode-only presets (Monthly in Arrears, Deposit & Monthly) don't apply here, since neither makes sense once there's no ongoing "actuals" to bill against.

**Governance checklist in fixed-price mode** replaces two of the five variable-mode items:

- *Not-to-exceed cap & alert threshold* is replaced with **change-order discipline**: any scope beyond what's priced here requires a written change order and a re-quoted fixed price before work starts — never an ad hoc addition to an invoice, since there's no cap left to bill up to.
- *Change handling*, which in variable mode reads "New scope goes on the backlog and gets billed" (billing-against-actuals language that doesn't hold once the price is fixed), is reworded to match: new scope requires a change order and a repriced fixed fee, not an invoice adjustment.
- *Assumptions & exclusions* is reworded too: in variable mode, a client-side dependency slipping becomes "their cost" (more billed hours). In fixed-price mode there's no extra billing to fall back on, so a broken assumption is grounds for a change order or a timeline slip instead, not a bigger invoice.
- *Reporting cadence* and *backlog ownership* are unaffected by billing structure and stay as-is.

## Business rules & decisions (the "why")

- **Silent range correction over validation errors.** Enforcing Optimistic ≤ Likely ≤ Pessimistic by auto-correcting rather than blocking keeps data entry fast; the tradeoff is a user won't be told their pessimistic number was too low, it'll just get quietly adjusted.
- **Uncertainty combines via root-sum-of-squares, not addition.** A deliberate statistical choice, called out explicitly in the app's own copy, so total project risk isn't overstated by naively adding per-deliverable ranges.
- **The not-to-exceed cap is framed as "the pessimistic case, marked up exactly like the quote."** This is meant to be defensible to a client as the genuine worst case, not an arbitrary buffer — and it's treated as a hard invariant that it can never read lower than the price being quoted.
- **A missing or deleted role never zeroes out a line item.** Falling back to the blended rate is a deliberate protection against a work package silently costing nothing.
- **The governance checklist is fixed, opinionated, non-configurable Pertly guidance** — not a per-user or per-organization policy setting. It represents Pertly's standard recommended practice for running a T&M engagement, the same for every user.
- **A zero-cost estimate is blocked rather than just discouraged.** A €0 recommended budget is never a legitimate final state to hand to a client, so it's enforced as a hard gate rather than a warning the user could ignore.
- **What determines the payment-schedule options is whether the total is agreed in advance, not which branch computed it.** That's why fixed-price T&M and VBP are meant to share one preset list (both produce a single agreed number), while variable T&M has its own, narrower list built around ongoing billing. The axis is "fixed commitment vs. variable actuals," which cuts across the T&M/VBP split rather than following it.
- **Fixed-price mode has no Settings-level default and role-based pricing does.** Role-based pricing is a roster the user builds up once and reuses; fixed-vs-variable is closer to a per-engagement contract decision that's worth actively choosing each time, not inheriting silently from a global default. The risk-coverage slider follows the same logic: every new estimate starts at a fixed 30%, not a Settings-configurable value, since how much worst case to price in is itself part of that per-engagement decision.
- **The risk-coverage slider interpolates cost, not days.** In role-based mode, work packages can bill at different rates, so there's no single "days" figure to blend between expected and pessimistic; interpolating the two already-computed cost totals sidesteps that and keeps the formula identical in blended and role-based mode.
- **The effective day rate is internal-only, shown only where other internal-only figures already live** (the Summary step, the Internal Detail document) — never the Pricing step or the client proposal, consistent with day rates never being disclosed to the client at all.

## Planned changes (decided, not yet built)

None currently outstanding.

## Open questions

None currently outstanding — the two open questions from the previous revision (whether to surface an effective day rate, and whether the fixed-price toggle needs a Settings-level default) were resolved in this round; see "Core methodology" §8 and "Business rules & decisions" above.
