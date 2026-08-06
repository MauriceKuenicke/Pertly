import type { Estimate, ExpenseItem } from "../types/estimate";
import {
  allocateBudgetByPackage,
  calcBreakEvenEffort,
  calcPaymentMilestones,
  calcRoleBreakdown,
  calcTimeMaterials,
  calcValueBased,
  sumExpenses,
  type PaymentMilestone,
  type RoleBreakdownRow,
} from "./calc";
import { formatDays, formatMoney } from "./currency";
import { formatDate, formatWeeksRange, todayPlusDays } from "./date";

// This HTML is loaded into a BrowserWindow (electron/main.ts, pdf:export) to
// be printed to PDF. Every field below can contain arbitrary user-typed text
// (estimate/client/preparer names, work package names, assumptions, tier
// copy), so it must be escaped before interpolation. Otherwise a value like
// `<img src=x onerror=...>` would run script or load a remote URL in that
// window, breaking the app's "never makes a network request" promise too.
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #2a1116; margin: 0; padding: 48px 56px; }
  h1 { font-size: 22px; font-weight: 800; margin: 0 0 20px; }
  h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; }
  p { line-height: 1.6; font-size: 13px; color: #6b5450; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th { text-align: left; font-size: 10.5px; font-weight: 600; color: #9c8480; padding: 8px 4px; border-bottom: 1px solid #e5d9d6; }
  td { padding: 10px 4px; border-bottom: 1px solid #e5d9d6; color: #6b5450; }
  .r { text-align: right; }
  .total td { border-top: 1.5px solid #d4c2be; border-bottom: none; font-weight: 700; color: #2a1116; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 16px; background: #f1e8e5; border-radius: 10px; margin: 16px 0; }
  .meta div span { display: block; }
  .meta .label { font-size: 10px; font-weight: 600; letter-spacing: 0.4px; color: #9c8480; margin-bottom: 3px; }
  .meta .value { font-size: 13px; font-weight: 600; color: #2a1116; }
  .row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
  .row.total { font-weight: 700; color: #2a1116; border-top: 1px solid #d4c2be; padding-top: 8px; margin-top: 4px; }
  .banner { padding: 12px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600; margin-bottom: 16px; }
  .banner.danger { background: #f6e3e1; color: #bc4038; }
  .banner.brand { background: #f4e4e1; color: #a8564e; }
  .header { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #e5d9d6; margin-bottom: 20px; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: #a8564e; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .preparer { margin: 0; font-size: 13px; font-weight: 600; color: #2a1116; }
  .valid { margin: 2px 0 0; font-size: 12px; color: #9c8480; }
  .bullets p { margin: 4px 0; font-size: 12.5px; }
  .sub { font-size: 11px; color: #9c8480; margin-top: 2px; }
  .tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 8px; }
  .tier { border: 1px solid #e5d9d6; border-radius: 10px; padding: 16px; }
  .tier .name { font-weight: 700; font-size: 13.5px; }
  .tier .price { font-size: 18px; font-weight: 800; display: block; margin-top: 6px; }
  .tier .duration { font-size: 11.5px; color: #9c8480; }
  .tier .desc { font-size: 11.5px; color: #6b5450; margin-top: 6px; }
  .value-story { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .value-story .item { background: #f1e8e5; border-radius: 10px; padding: 16px; }
  .value-story .amount { font-size: 19px; font-weight: 800; display: block; margin-top: 4px; }
`;

function wrap(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head><body>${body}</body></html>`;
}

function metaGrid(rows: [string, string][]): string {
  return `<div class="meta">${rows
    .map(([label, value]) => `<div><span class="label">${label}</span><span class="value">${value}</span></div>`)
    .join("")}</div>`;
}

function bullets(items: string[]): string {
  return `<div class="bullets">${items.map((i) => `<p>• ${esc(i)}</p>`).join("")}</div>`;
}

function expensesSectionHtml(expenses: ExpenseItem[], currency: string): string {
  if (expenses.length === 0) return "";
  return `
    <h2>Pass-through expenses</h2>
    <table><thead><tr><th>ITEM</th><th class="r">AMOUNT</th></tr></thead><tbody>
      ${expenses.map((e) => `<tr><td>${esc(e.label || "Untitled expense")}</td><td class="r">${formatMoney(e.amount, currency)}</td></tr>`).join("")}
    </tbody></table>
  `;
}

function paymentScheduleHtml(milestones: PaymentMilestone[], currency: string): string {
  return `
    <h2>Suggested payment schedule</h2>
    <table><thead><tr><th>MILESTONE</th><th class="r">SHARE</th><th class="r">AMOUNT</th></tr></thead><tbody>
      ${milestones.map((m) => `<tr><td>${esc(m.label)}</td><td class="r">${m.pct}%</td><td class="r">${formatMoney(m.amount, currency)}</td></tr>`).join("")}
    </tbody></table>
  `;
}

function roleBreakdownHtml(roleBreakdown: RoleBreakdownRow[], currency: string): string {
  if (roleBreakdown.length === 0) return "";
  return `
    <h2>Team & rate breakdown</h2>
    <table><thead><tr><th>ROLE</th><th class="r">DAY RATE</th><th class="r">DAYS</th><th class="r">COST</th><th class="r">% OF COST</th></tr></thead><tbody>
      ${roleBreakdown
        .map(
          (r) =>
            `<tr><td>${esc(r.roleName || "Untitled role")}</td><td class="r">${formatMoney(r.dayRate, currency)}</td><td class="r">${formatDays(r.days)}</td><td class="r">${formatMoney(r.cost, currency)}</td><td class="r">${Math.round(r.pctOfCost)}%</td></tr>`,
        )
        .join("")}
    </tbody></table>
  `;
}

function clientOverviewTmHtml(estimate: Estimate): string {
  const currency = estimate.projectDetails.currency;
  const preparerName = estimate.projectDetails.preparerName;
  const totals = calcTimeMaterials(estimate.timeMaterials, estimate.rateEffort, estimate.overheadRisk);
  const allocations = allocateBudgetByPackage(totals);
  const validUntil = formatDate(todayPlusDays(14));
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedBudget + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.timeMaterials.paymentSplit);

  return wrap(
    "Project Estimate",
    `
    <div class="header">
      <div class="avatar">${esc((preparerName || "?").charAt(0).toUpperCase())}</div>
      <div><p class="preparer">${esc(preparerName || "Prepared by -")}</p><p class="valid">Valid until ${validUntil}</p></div>
    </div>
    <h1>${esc(estimate.projectDetails.estimateName || "Project Estimate")}: Project Estimate</h1>
    ${metaGrid([
      ["PREPARED FOR", esc(estimate.projectDetails.clientName || "-")],
      ["PROJECT", esc(estimate.projectDetails.estimateName || "-")],
      ["DATE", formatDate(new Date())],
      ["VALID UNTIL", validUntil],
    ])}
    <p>The work below is split into ${allocations.length} deliverables, each priced from a best-case / likely / worst-case range with a risk buffer already folded in. You're billed for actual time worked, and the total is capped. You'll never pay above the not-to-exceed figure.</p>
    <table><thead><tr><th>WORK PACKAGE</th><th class="r">INVESTMENT</th></tr></thead><tbody>
      ${allocations.map((r) => `<tr><td>${esc(r.name || "Untitled package")}</td><td class="r">${formatMoney(r.amount, currency)}</td></tr>`).join("")}
      <tr class="total"><td>Estimated investment</td><td class="r">${formatMoney(totals.recommendedBudget, currency)}</td></tr>
    </tbody></table>
    <div class="banner brand">🔒 Not-to-exceed cap: ${formatMoney(totals.notToExceedCap + expensesTotal, currency)}. You will never be billed above this.</div>
    ${expensesSectionHtml(estimate.expenses, currency)}
    ${expensesTotal > 0 ? `<div class="row total"><span>Total quoted price</span><span>${formatMoney(grandTotal, currency)}</span></div>` : ""}
    ${paymentScheduleHtml(milestones, currency)}
    <h2>Assumptions & exclusions</h2>
    ${bullets([...estimate.assumptions, ...estimate.exclusions])}
  `,
  );
}

function internalDetailTmHtml(estimate: Estimate): string {
  const currency = estimate.projectDetails.currency;
  const useRoleBasedPricing = estimate.timeMaterials.useRoleBasedPricing;
  const totals = calcTimeMaterials(estimate.timeMaterials, estimate.rateEffort, estimate.overheadRisk);
  const roleBreakdown = calcRoleBreakdown(estimate.timeMaterials, estimate.rateEffort);
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedBudget + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.timeMaterials.paymentSplit);
  const roleNameFor = (roleId: string | undefined) => {
    const role = estimate.timeMaterials.roles.find((r) => r.id === roleId);
    return role ? role.name || "Untitled role" : "Unassigned";
  };

  return wrap(
    "Internal Cost Breakdown",
    `
    <div class="banner danger">🔒 INTERNAL: includes day rate, overhead and margin. Do not forward to the client.</div>
    <h1>${esc(estimate.projectDetails.estimateName || "Project")}: Internal Cost Breakdown</h1>
    <p style="margin-top:-12px">${esc(estimate.projectDetails.clientName || "-")} · prepared by ${esc(estimate.projectDetails.preparerName || "-")} · ${formatDate(new Date())}</p>
    ${metaGrid([
      ["DAY RATE", useRoleBasedPricing ? `Role-based (${estimate.timeMaterials.roles.length})` : formatMoney(estimate.rateEffort.dayRate, currency)],
      ["OVERHEAD", `${estimate.overheadRisk.overheadPct}%`],
      ["CONTINGENCY", `${estimate.overheadRisk.contingencyPct}%`],
      ["NTE CAP BASIS", "Pessimistic case"],
    ])}
    <h2>Cost build-up</h2>
    <div class="row"><span>Base delivery cost (${useRoleBasedPricing ? `${formatDays(totals.expectedDays)} d across roles` : `${formatDays(totals.expectedDays)} d × ${formatMoney(estimate.rateEffort.dayRate, currency)}`})</span><span>${formatMoney(totals.baseCost, currency)}</span></div>
    <div class="row"><span>+ Overhead (${estimate.overheadRisk.overheadPct}%)</span><span>${formatMoney(totals.overheadAmount, currency)}</span></div>
    <div class="row"><span>+ Contingency (${estimate.overheadRisk.contingencyPct}%)</span><span>${formatMoney(totals.contingencyAmount, currency)}</span></div>
    <div class="row total"><span>Recommended budget</span><span>${formatMoney(totals.recommendedBudget, currency)}</span></div>
    <div class="row"><span>Not-to-exceed cap</span><span>${formatMoney(totals.notToExceedCap, currency)}</span></div>
    ${
      expensesTotal > 0
        ? `<div class="row"><span>+ Pass-through expenses</span><span>${formatMoney(expensesTotal, currency)}</span></div>
    <div class="row total"><span>Total quoted price</span><span>${formatMoney(grandTotal, currency)}</span></div>`
        : ""
    }
    ${roleBreakdownHtml(roleBreakdown, currency)}
    <h2>Detailed work breakdown</h2>
    <table><thead><tr><th>#</th><th>WORK PACKAGE</th>${useRoleBasedPricing ? "<th>ROLE</th>" : ""}<th class="r">O</th><th class="r">M</th><th class="r">P</th><th class="r">EXPECTED</th><th class="r">σ</th><th class="r">COST</th></tr></thead><tbody>
      ${totals.rows
        .map(
          (row, i) =>
            `<tr><td>${i + 1}</td><td>${esc(row.name || "Untitled package")}</td>${useRoleBasedPricing ? `<td>${esc(roleNameFor(row.roleId))}</td>` : ""}<td class="r">${row.optimisticDays}</td><td class="r">${row.likelyDays}</td><td class="r">${row.pessimisticDays}</td><td class="r">${formatDays(row.expectedDays)}</td><td class="r">±${formatDays(row.sigmaDays, 2)}</td><td class="r">${formatMoney(row.cost, currency)}</td></tr>`,
        )
        .join("")}
      <tr class="total"><td></td><td>Total</td>${useRoleBasedPricing ? "<td></td>" : ""}<td class="r">${totals.totalOptimisticDays}</td><td class="r">${totals.totalLikelyDays}</td><td class="r">${totals.totalPessimisticDays}</td><td class="r">${formatDays(totals.expectedDays)}</td><td class="r">±${formatDays(totals.sigmaDays, 2)}</td><td class="r">${formatMoney(totals.baseCost, currency)}</td></tr>
    </tbody></table>
    ${expensesSectionHtml(estimate.expenses, currency)}
    ${paymentScheduleHtml(milestones, currency)}
  `,
  );
}

function clientOverviewVbpHtml(estimate: Estimate): string {
  const currency = estimate.projectDetails.currency;
  const preparerName = estimate.projectDetails.preparerName;
  const totals = calcValueBased(estimate.valueBased);
  const validUntil = formatDate(todayPlusDays(14));
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedFee + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.valueBased.paymentSplit);

  return wrap(
    "Value-Based Proposal",
    `
    <div class="header">
      <div class="avatar">${esc((preparerName || "?").charAt(0).toUpperCase())}</div>
      <div><p class="preparer">${esc(preparerName || "Prepared by -")}</p><p class="valid">Valid until ${validUntil}</p></div>
    </div>
    <h1>${esc(estimate.projectDetails.estimateName || "Project")}: Value-Based Proposal</h1>
    ${metaGrid([
      ["PREPARED FOR", esc(estimate.projectDetails.clientName || "-")],
      ["PROJECT", esc(estimate.projectDetails.estimateName || "-")],
      ["DATE", formatDate(new Date())],
      ["VALID UNTIL", validUntil],
    ])}
    <p>This proposal prices the engagement as a share of the value it creates for your business, not hours spent. Below is a conservative estimate of that value, and three ways to scope the work around it.</p>
    <div class="value-story">
      <div class="item"><span class="label" style="font-size:10px;font-weight:600;color:#9c8480">COST OF STAYING AS-IS</span><span class="amount">${formatMoney(totals.annualProblemCost, currency)} / yr</span><p style="margin:4px 0 0;font-size:11.5px">What the current process costs you today, left unaddressed.</p></div>
      <div class="item"><span class="label" style="font-size:10px;font-weight:600;color:#9c8480">VALUE WE'LL CONSERVATIVELY CREATE</span><span class="amount">${formatMoney(totals.conservativeValue, currency)} / yr</span><p style="margin:4px 0 0;font-size:11.5px">A conservative estimate. Moderate and best-case scenarios run higher.</p></div>
    </div>
    <h2>Three ways to scope this</h2>
    <div class="tiers">
      ${estimate.valueBased.tiers
        .map(
          (t) =>
            `<div class="tier"><span class="name">${esc(t.name)}${t.id === estimate.valueBased.recommendedTierId ? " ★" : ""}</span><span class="price">${formatMoney(t.price, currency)}</span><span class="duration">${formatWeeksRange(t.durationMinWeeks, t.durationMaxWeeks)}</span><p class="desc">${esc(t.description)}</p></div>`,
        )
        .join("")}
    </div>
    ${expensesSectionHtml(estimate.expenses, currency)}
    ${expensesTotal > 0 ? `<div class="row total"><span>Total quoted price</span><span>${formatMoney(grandTotal, currency)}</span></div>` : ""}
    ${paymentScheduleHtml(milestones, currency)}
    <h2>Assumptions & exclusions</h2>
    ${bullets([...estimate.assumptions, ...estimate.exclusions])}
  `,
  );
}

function internalDetailVbpHtml(estimate: Estimate): string {
  const currency = estimate.projectDetails.currency;
  const totals = calcValueBased(estimate.valueBased);
  const tierB = estimate.valueBased.tiers.find((t) => t.id === estimate.valueBased.recommendedTierId) ?? estimate.valueBased.tiers[1];
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedFee + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.valueBased.paymentSplit);
  const breakEven = calcBreakEvenEffort(totals.recommendedFee, estimate.rateEffort, estimate.overheadRisk);

  return wrap(
    "Internal Fee Breakdown",
    `
    <div class="banner danger">🔒 INTERNAL: includes attribution, value capture rate, and fee derivation. Do not forward to the client.</div>
    <h1>${esc(estimate.projectDetails.estimateName || "Project")}: Internal Fee Breakdown</h1>
    <p style="margin-top:-12px">${esc(estimate.projectDetails.clientName || "-")} · prepared by ${esc(estimate.projectDetails.preparerName || "-")} · ${formatDate(new Date())}</p>
    ${metaGrid([
      ["CONSERVATIVE IMPROVEMENT", `${Math.round(totals.conservativePct)}%`],
      ["ATTRIBUTION", `${estimate.valueBased.attributionPct}%`],
      ["VALUE CAPTURE RATE", `${estimate.valueBased.valueCaptureRatePct}%`],
      ["TARGET ROI RANGE", "5–10×"],
    ])}
    <h2>Value drivers</h2>
    <table><thead><tr><th>VALUE DRIVER</th><th class="r">ANNUAL COST</th></tr></thead><tbody>
      ${estimate.valueBased.valueDrivers.map((d) => `<tr><td>${esc(d.label)}</td><td class="r">${formatMoney(d.annualAmount, currency)}</td></tr>`).join("")}
      <tr class="total"><td>Annual problem cost</td><td class="r">${formatMoney(totals.annualProblemCost, currency)}</td></tr>
    </tbody></table>
    <h2>Fee build-up</h2>
    <div class="row"><span>Annual problem cost</span><span>${formatMoney(totals.annualProblemCost, currency)}</span></div>
    <div class="row"><span>× Conservative improvement (${Math.round(totals.conservativePct)}%)</span><span>${formatMoney(totals.conservativeValue, currency)}</span></div>
    <div class="row"><span>× Attribution (${estimate.valueBased.attributionPct}%)</span><span>${formatMoney(totals.attributionValue, currency)}</span></div>
    <div class="row total"><span>Recommended fee</span><span>${formatMoney(totals.recommendedFee, currency)}</span></div>
    <div class="row"><span>Client ROI</span><span>${totals.clientRoi.toFixed(1)}×</span></div>
    ${
      expensesTotal > 0
        ? `<div class="row"><span>+ Pass-through expenses</span><span>${formatMoney(expensesTotal, currency)}</span></div>
    <div class="row total"><span>Total quoted price</span><span>${formatMoney(grandTotal, currency)}</span></div>`
        : ""
    }
    <h2>Break-even effort</h2>
    <div class="row"><span>Your effective day rate (${estimate.overheadRisk.overheadPct}% overhead)</span><span>${formatMoney(breakEven.effectiveDayRate, currency)}</span></div>
    <div class="row total"><span>Break-even effort</span><span>${formatDays(breakEven.breakEvenDays)} d</span></div>
    <h2>Tier economics</h2>
    <table><thead><tr><th>TIER</th><th>DURATION</th><th class="r">vs. ${esc(tierB?.name ?? "Tier B")}</th><th class="r">PRICE</th></tr></thead><tbody>
      ${estimate.valueBased.tiers
        .map(
          (t) =>
            `<tr><td>${esc(t.name)}${t.description ? `<div class="sub">${esc(t.description)}</div>` : ""}</td><td>${formatWeeksRange(t.durationMinWeeks, t.durationMaxWeeks)}</td><td class="r">${t.id === tierB?.id ? "base fee" : tierB && tierB.price > 0 ? `${(t.price / tierB.price).toFixed(2)}× ${esc(tierB.name)}` : "-"}</td><td class="r">${formatMoney(t.price, currency)}</td></tr>`,
        )
        .join("")}
    </tbody></table>
    ${expensesSectionHtml(estimate.expenses, currency)}
    ${paymentScheduleHtml(milestones, currency)}
  `,
  );
}

export function buildProposalHtml(estimate: Estimate, tab: "client" | "internal"): { html: string; suggestedName: string } {
  const isVBP = estimate.pricingMethod === "value-based";
  const base = (estimate.projectDetails.estimateName || "Estimate").replace(/[^a-z0-9]+/gi, "-");

  if (tab === "client") {
    return {
      html: isVBP ? clientOverviewVbpHtml(estimate) : clientOverviewTmHtml(estimate),
      suggestedName: `${base}${isVBP ? "-Value-Proposal" : "-Estimate"}.pdf`,
    };
  }
  return {
    html: isVBP ? internalDetailVbpHtml(estimate) : internalDetailTmHtml(estimate),
    suggestedName: `${base}-Internal${isVBP ? "-Fee" : ""}.pdf`,
  };
}
