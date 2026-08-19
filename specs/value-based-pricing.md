# Spec: Value-Based Pricing

Status: **active**. This describes the business logic and rules for Value-Based Pricing (VBP) — not how it's coded. If the running app disagrees with this document, that's a bug in one of the two; reconcile them.

## Purpose & when to use

VBP is Pertly's **default** pricing method (pre-selected for every new estimate; T&M is the fallback — see [`time-materials.md`](time-materials.md)). It prices an engagement as a share of the annual business value it creates for the client, rather than hours spent, for situations where that value can be reasonably quantified — which the app treats as the common case, not the exception.

Pertly's primary user is a **solo freelancer** setting their own rates and policies. Value-based pricing exists to help that freelancer get paid for outcomes/expertise rather than time, while still protecting them (and the client) from an indefensible number — hence the value drivers being written down explicitly, the fee always anchoring to a conservative case, and an ROI sanity check before the number goes out the door.

## Core methodology

### 1. Quantify the problem

The user fills in five fixed, standard value-driver categories with an annual dollar amount each — what the problem costs the client today if left unsolved:

- Time wasted / year
- Errors & rework / year
- Revenue drag / year
- Compliance / risk / year
- Opportunity cost / year

**Annual Problem Cost** = the sum of all five. This is the foundation of everything downstream — every later number is a percentage of this one, so under-counting it here understates the whole pitch. This is a deliberately fixed, standard framework rather than a customizable list, so every value-based estimate is built on the same proven set of questions.

### 2. Estimate value potential (three scenarios)

The user sets one **Conservative improvement %** — a defensible, realistic estimate of how much of the annual problem cost this engagement will actually eliminate (typically 20–40%). Two more scenarios scale off it automatically, purely to illustrate upside to the client:

- **Moderate** = Conservative × 1.5 (capped at 100%)
- **Aggressive** = Conservative × 2 (capped at 100%)

Each scenario's dollar value = Annual Problem Cost × its percentage.

### 3. Derive the fee

**Fee = Conservative Value × Attribution % × Value Capture Rate %**

- **Attribution %** (typically 60–100%) accounts for the fact that the client's own team, tools, or timing also contributed to the outcome — not all of the value created is fairly "ours" to price against.
- **Value Capture Rate %** (typically 5–25%, 15% is a common baseline) is what fair-market slice of the attributed value becomes the fee: lower for simple/commoditized work, higher for rare or highly specialized expertise.

**Business rule**: the fee is always priced off the **Conservative** scenario, never Moderate or Aggressive. This is checked explicitly before a proposal goes out — quoting off an upside scenario would mean overselling the ask.

### 4. Sanity-check the fee

**Client ROI** = Conservative Value ÷ Fee. Target band: **5–10×**. Below 5× the fee is underpriced (revisit attribution or value capture rate); above 10× the client is being asked to pay more than the value story supports. This target band is a fixed Pertly default, not user-configurable. It is surfaced in the UI as a neutral "target range", never as a company or organizational policy.

**Break-even effort** (internal only, never shown to the client) = Fee ÷ effective day rate (the freelancer's normal day rate marked up by overhead only, not contingency — contingency buffers estimation uncertainty, which doesn't apply the same way to a value-based fixed fee). This answers "how many days of delivery work does this fee cover before I'm effectively earning less than my normal rate" — an internal profitability guardrail against overservicing a fixed-fee engagement.

### 5. Scope the engagement into tiers

The same underlying fee is packaged into three tiers (A, B, C) so the client gets a choice instead of a single yes/no — proven to increase close rates. Tier B is the recommended tier and equals the derived fee itself; Tier A is priced lower (roughly 0.55× the fee, a smaller/shorter scope) and Tier C higher (roughly 1.65×, a larger/premium scope). Each tier also carries an editable name, duration range, and client-facing description.

**Business rule**: tier prices always stay mathematically consistent with the current fee. If any upstream input changes the derived fee, all three tier prices recalculate to match it — intentionally, even if that means overwriting a price the user had typed in manually. The product goal is that the tiers can never drift out of sync with the value story; a manual edit not surviving a later recalculation is an accepted tradeoff, not a bug.

### 6. Payment schedule

Once the total (fee + any pass-through expenses) is known, the user picks a milestone-style schedule appropriate to a fixed-fee engagement:

| Schedule | Split | Default? |
|---|---|---|
| Standard | 30% deposit / 40% midpoint / 30% final | **yes** |
| Deposit & Delivery | 50% / 50% | |
| Full Upfront | 100% on signing | |
| Payment on Completion | 100% on delivery | |
| Quarterly | 25% / 25% / 25% / 25% | |

This same list is shared with Time & Materials' fixed-price mode (see [`time-materials.md`](time-materials.md)'s "Fixed-price mode" section) — a fixed-price T&M quote and a VBP quote are structurally identical at the payment-schedule stage: one agreed number, split into milestones. It isn't VBP-exclusive so much as it's the preset list for "the total is agreed in advance," which VBP always is.

### 7. Pass-through expenses

Same treatment as Time & Materials: hardware, licenses, travel, etc. are added on top of the fee at cost, with no markup.

## What the client sees vs. what stays internal

The client-facing proposal tells the value story — the annual cost of staying as-is, the conservative value that will be created, and the three tiers — without ever mentioning attribution %, value capture rate %, or break-even effort. Revealing the fee's cost-basis math would undercut the pitch that the client is paying for value created, not hours or margin.

The internal view additionally shows: the per-driver breakdown behind the annual problem cost, the conservative/attribution/capture-rate percentages, the full fee build-up, the target ROI band, break-even effort, and each tier's price expressed as a multiple of the recommended tier.

Every VBP proposal also carries a fixed **"before you propose" checklist** before it's finalized: the client agreed to the value number themselves (not just accepted the user's), the fee is anchored to the conservative scenario, the assumptions behind the value calculation are written down, and the fee has been checked against the 5–10× ROI target.

## Business rules & decisions (the "why")

- **The fee is always anchored to the conservative scenario.** Moderate and aggressive exist purely to show upside without ever becoming the basis of the ask — enforced by the formula itself and reinforced by an explicit pre-proposal checklist item.
- **Attribution and value capture rate are kept as two separate levers**, not one combined "our share" number. Attribution answers "how much of this value is even ours to claim"; value capture rate answers "what's a fair price for the share that is ours." Keeping them separate makes each independently defensible in a client conversation.
- **Break-even effort deliberately excludes the contingency markup** that the not-to-exceed cap includes on the T&M side — contingency buffers *estimation* uncertainty in delivery, which is a different concern from a fixed fee's internal profitability check.
- **Tier prices intentionally always win over manual edits**, staying locked to the derived fee rather than becoming independently editable once touched — internal consistency between the fee and the tiers matters more than preserving a one-off manual price.
- **The five value-driver categories are a fixed, standard framework**, not a customizable list — consistency across every value-based estimate is preferred over per-estimate flexibility here.
- **The 5–10× ROI target band and the "before you propose" checklist are fixed, opinionated, non-configurable Pertly guidance** — the same standard for every user, not a per-organization policy setting.
- **Rates, overhead, and day-rate math never appear on the client-facing VBP view at all**, not even in summarized form — the entire client narrative is value-based, and any cost-basis language would undercut it.

## Planned changes (decided, not yet built)

None currently outstanding.

## Open questions

None currently outstanding — the main open product questions (tier auto-sync behavior, fixed vs. configurable value drivers, fixed vs. configurable policy checklists/ROI target, and the unbuilt "service lines" idea, which was dropped rather than built) were resolved in the interview behind this revision; see "Business rules & decisions" above.
