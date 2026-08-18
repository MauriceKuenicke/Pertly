import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card } from "../../components/ui";
import {
  calcPaymentMilestones,
  calcRoleBreakdown,
  calcTimeMaterials,
  matchingPaymentSplitPresetId,
  PAYMENT_SPLIT_PRESETS,
  sumExpenses,
  TM_PAYMENT_SPLIT_PRESETS,
  type PaymentSplitPreset,
} from "../../lib/calc";
import { formatDays, formatMoney } from "../../lib/currency";
import type { WizardScreenProps } from "../wizardProps";
import { breadcrumbLabelFor, windowTitleFor } from "../wizardProps";
import styles from "./SummaryScreen.module.css";

const GOVERNANCE = [
  {
    title: "Not-to-exceed cap & alert threshold",
    body: "Flag it when burn approaches the ceiling. Don't wait for the invoice.",
  },
  { title: "Reporting cadence", body: "Weekly hours / burn-down plus a demo is the default." },
  { title: "Backlog ownership", body: "Name who on the client side decides priority sprint by sprint." },
  {
    title: "Change handling",
    body: "New scope goes on the backlog and gets billed. It never silently expands the cap.",
  },
  {
    title: "Assumptions & exclusions",
    body: "Attach the list this estimate depends on (see Step 1). Their delays are their cost on T&M.",
  },
];

// Fixed-price mode has no cap to monitor and no "just bill more" escape
// valve, so the two items that assumed ongoing actuals billing are
// reworded around change-order discipline instead (see
// specs/time-materials.md, "Fixed-price mode").
const GOVERNANCE_FIXED_PRICE = [
  {
    title: "Change-order discipline",
    body: "Extra scope beyond this estimate requires a written change order and a re-quoted fixed price before work starts — there's no cap left to bill up to, so nothing gets silently absorbed.",
  },
  { title: "Reporting cadence", body: "Weekly hours / burn-down plus a demo is the default." },
  { title: "Backlog ownership", body: "Name who on the client side decides priority sprint by sprint." },
  {
    title: "Change handling",
    body: "New scope goes through a change order, not straight onto the backlog. Agree the price change before starting the work, not after.",
  },
  {
    title: "Assumptions & exclusions",
    body: "Attach the list this estimate depends on (see Step 1). If a client-side dependency slips, that's grounds for a change order or a timeline slip — not a bigger invoice.",
  },
];

export function SummaryTMScreen({
  estimate,
  onChange,
  onGoToList,
  onGoToSettings,
  onNewEstimate,
  onStepClick,
  savedLabel,
  onBack,
  onNext,
}: WizardScreenProps) {
  const totals = calcTimeMaterials(estimate.timeMaterials, estimate.rateEffort, estimate.overheadRisk);
  const roleBreakdown = calcRoleBreakdown(estimate.timeMaterials, estimate.rateEffort);
  const currency = estimate.projectDetails.currency;
  const expensesTotal = sumExpenses(estimate.expenses);
  const isFixedPrice = estimate.timeMaterials.isFixedPrice;
  const riskCoveragePct = estimate.timeMaterials.fixedPriceRiskCoveragePct;
  // Fixed-price mode quotes a risk-adjusted figure between the expected
  // case and the full pessimistic case (see fixedPriceQuote in calc.ts),
  // instead of the plain expected-case recommended budget — the freelancer
  // absorbs any overrun beyond it, so how much of the worst case to price
  // in is a deliberate per-estimate choice (the risk coverage slider on
  // the Assumptions step).
  const quotedPrice = isFixedPrice ? totals.fixedPriceQuote : totals.recommendedBudget;
  const grandTotal = quotedPrice + expensesTotal;
  const paymentSplit = estimate.timeMaterials.paymentSplit;
  const milestones = calcPaymentMilestones(grandTotal, paymentSplit);
  const presetList = isFixedPrice ? PAYMENT_SPLIT_PRESETS : TM_PAYMENT_SPLIT_PRESETS;
  const activeSplitPresetId = matchingPaymentSplitPresetId(paymentSplit, presetList);
  const governance = isFixedPrice ? GOVERNANCE_FIXED_PRICE : GOVERNANCE;

  const selectPaymentSplitPreset = (preset: PaymentSplitPreset) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        ...e.timeMaterials,
        paymentSplit: preset.entries.map((entry) => ({ ...entry })),
      },
    }));
  };

  return (
    <WizardLayout
      windowTitle={windowTitleFor(estimate)}
      breadcrumbLabel={breadcrumbLabelFor(estimate)}
      currentStep={3}
      furthestStep={estimate.furthestStep}
      savedLabel={savedLabel}
      onGoToList={onGoToList}
      onNewEstimate={onNewEstimate}
      onGoToSettings={onGoToSettings}
      onStepClick={onStepClick}
      footer={
        <FooterBar
          left={
            <Button variant="ghost" onClick={onBack}>
              ← Back to Estimate
            </Button>
          }
          right={
            <>
              <span className={styles.stepText}>Step 3 of 4</span>
              <Button variant="primary" onClick={onNext}>
                Continue to Proposal →
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>{isFixedPrice ? "Here's Your Fixed Price" : "Here's Your Recommended Budget"}</h1>
          <p className={styles.pageSubtitle}>
            {isFixedPrice
              ? `Built from ${riskCoveragePct}% risk coverage (set on the Assumptions step), so you're covered for the share of the worst case you chose to price in.`
              : "Built from your work breakdown, overhead uplift, and contingency buffer."}
          </p>
        </div>

        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>{isFixedPrice ? "FIXED PRICE" : "RECOMMENDED BUDGET"}</span>
            <span className={styles.kpiValue}>{formatMoney(quotedPrice, currency)}</span>
            <span className={styles.kpiFoot}>Quote this as your target price</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>EXPECTED EFFORT</span>
            <span className={styles.kpiValue}>
              {formatDays(totals.expectedDays)} <span className={styles.kpiUnit}>days</span>
            </span>
            <span className={styles.kpiFoot}>± {formatDays(totals.sigmaDays, 2)} days combined uncertainty</span>
          </div>
          {isFixedPrice ? (
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>EXPECTED COST</span>
              <span className={styles.kpiValue}>{formatMoney(totals.recommendedBudget, currency)}</span>
              <span className={styles.kpiFoot}>Expected costs without risk adjustment — internal only, never shown to the client</span>
            </div>
          ) : (
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>NOT-TO-EXCEED CAP</span>
              <span className={styles.kpiValue}>{formatMoney(totals.notToExceedCap, currency)}</span>
              <span className={styles.kpiFoot}>Agree this ceiling with the client (pessimistic case)</span>
            </div>
          )}
        </div>

        <div className={styles.bottomRow}>
          <Card
            title="Cost Build-Up"
            description={
              isFixedPrice
                ? `How the fixed price was assembled, step by step, at ${riskCoveragePct}% risk coverage.`
                : "How the recommended budget was assembled, step by step."
            }
          >
            <div className={styles.buildRow}>
              <span>Base Delivery Cost</span>
              <span>{formatMoney(totals.baseCost, currency)}</span>
            </div>
            {isFixedPrice && (
              <>
                <div className={styles.buildRow}>
                  <span>
                    + Risk Coverage ({riskCoveragePct}% of {formatMoney(totals.baseCost, currency)}–
                    {formatMoney(totals.pessimisticCost, currency)})
                  </span>
                  <span>{formatMoney(totals.riskCoverageAmount, currency)}</span>
                </div>
                <div className={styles.buildRowSub}>
                  <span>Risk-Adjusted Cost</span>
                  <span>{formatMoney(totals.riskAdjustedCost, currency)}</span>
                </div>
              </>
            )}
            <div className={styles.buildRow}>
              <span>+ Overhead ({estimate.overheadRisk.overheadPct}%)</span>
              <span>
                {formatMoney(isFixedPrice ? totals.riskAdjustedOverheadAmount : totals.overheadAmount, currency)}
              </span>
            </div>
            <div className={styles.buildRowSub}>
              <span>Delivery Subtotal</span>
              <span>{formatMoney(isFixedPrice ? totals.riskAdjustedSubtotal : totals.deliverySubtotal, currency)}</span>
            </div>
            <div className={styles.buildRow}>
              <span>+ Contingency ({estimate.overheadRisk.contingencyPct}%)</span>
              <span>
                {formatMoney(isFixedPrice ? totals.riskAdjustedContingencyAmount : totals.contingencyAmount, currency)}
              </span>
            </div>
            <div className={styles.divider} />
            <div className={styles.buildRowTotal}>
              <span>{isFixedPrice ? "Fixed Price" : "Recommended Budget"}</span>
              <span className={styles.buildRowTotalValue}>{formatMoney(quotedPrice, currency)}</span>
            </div>
            {expensesTotal > 0 && (
              <>
                <div className={styles.buildRow}>
                  <span>+ Pass-Through Expenses</span>
                  <span>{formatMoney(expensesTotal, currency)}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.buildRowTotal}>
                  <span>Total Quoted Price</span>
                  <span className={styles.buildRowTotalValue}>{formatMoney(grandTotal, currency)}</span>
                </div>
              </>
            )}
          </Card>

          <Card
            title="Governance Checklist"
            description="Agree these with the client before you start. Company policy §4.4."
          >
            {governance.map((item) => (
              <div className={styles.govRow} key={item.title}>
                <span className={styles.checkIcon}>✓</span>
                <div>
                  <p className={styles.govTitle}>{item.title}</p>
                  <p className={styles.govBody}>{item.body}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Card title="Effective Day Rate" description="Internal only. Never appears on the client proposal.">
          <div className={styles.buildRow}>
            <span>Blended Day Rate, Overhead Included</span>
            <span>{formatMoney(totals.effectiveDayRate, currency)}</span>
          </div>
          <p className={styles.kpiFoot}>
            What you're actually netting per day once overhead is folded in, blended across whatever mix of rates got
            used.
          </p>
        </Card>

        {roleBreakdown.length > 0 && (
          <Card title="Team & Rate Split" description="Where the base delivery cost comes from, by role.">
            <div className={styles.milestoneRow}>
              {roleBreakdown.map((row) => (
                <div className={styles.milestone} key={row.roleId}>
                  <span className={styles.milestoneLabel}>{row.roleName || "Untitled role"}</span>
                  <span className={styles.milestoneAmount}>{formatMoney(row.cost, currency)}</span>
                  <span className={styles.milestonePct}>
                    {formatDays(row.days)} d at {formatMoney(row.dayRate, currency)}/day · {Math.round(row.pctOfCost)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="Suggested Payment Schedule" description="Pick the split that fits how this engagement will run.">
          <div className={styles.splitPresetRow}>
            {presetList.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`${styles.splitPreset} ${activeSplitPresetId === preset.id ? styles.splitPresetActive : ""}`}
                onClick={() => selectPaymentSplitPreset(preset)}
              >
                <span className={styles.splitPresetName}>{preset.name}</span>
                <span className={styles.splitPresetShape}>{preset.entries.map((e) => `${e.pct}%`).join(" / ")}</span>
                <span className={styles.splitPresetDesc}>{preset.description}</span>
              </button>
            ))}
          </div>
          <div className={styles.milestoneRow}>
            {milestones.map((m) => (
              <div className={styles.milestone} key={m.label}>
                <span className={styles.milestoneLabel}>{m.label}</span>
                <span className={styles.milestoneAmount}>{formatMoney(m.amount, currency)}</span>
                <span className={styles.milestonePct}>{m.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </WizardLayout>
  );
}
