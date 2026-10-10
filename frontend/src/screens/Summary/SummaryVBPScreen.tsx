import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card } from "../../components/ui";
import {
  calcBreakEvenEffort,
  calcPaymentMilestones,
  calcValueBased,
  matchingPaymentSplitPresetId,
  PAYMENT_SPLIT_PRESETS,
  sumExpenses,
  type PaymentSplitPreset,
} from "../../lib/calc";
import { formatDays, formatMoney } from "../../lib/currency";
import { formatWeeksRange } from "../../lib/date";
import type { WizardScreenProps } from "../wizardProps";
import { breadcrumbLabelFor, windowTitleFor } from "../wizardProps";
import styles from "./SummaryScreen.module.css";

const CHECKS = [
  {
    title: "Client agreed the value number themselves",
    body: "Not just accepted yours. They said it out loud in the call.",
  },
  {
    title: "Fee anchors to the conservative scenario",
    body: "Never quote off moderate or aggressive. That's upside, not the ask.",
  },
  {
    title: "Assumptions behind the value calc are written down",
    body: "Attach them. See the Step 1 hints for what drove each number.",
  },
  {
    title: "Fee checked against the 5–10× ROI target",
    body: "If ROI is below 5×, revisit attribution or value capture rate.",
  },
];

export function SummaryVBPScreen({
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
  const totals = calcValueBased(estimate.valueBased);
  const currency = estimate.projectDetails.currency;
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedFee + expensesTotal;
  const breakEven = calcBreakEvenEffort(totals.recommendedFee, estimate.rateEffort, estimate.overheadRisk);
  const paymentSplit = estimate.valueBased.paymentSplit;
  const milestones = calcPaymentMilestones(grandTotal, paymentSplit);
  const activeSplitPresetId = matchingPaymentSplitPresetId(paymentSplit);

  const selectPaymentSplitPreset = (preset: PaymentSplitPreset) => {
    onChange((e) => ({
      ...e,
      valueBased: {
        ...e.valueBased,
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
              ← Back to Pricing
            </Button>
          }
          right={
            <>
              <span className={styles.stepText}>Step 3 of 4: Value-Based Pricing</span>
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
          <h1 className={styles.pageTitle}>Here's Your Recommended Fee</h1>
          <p className={styles.pageSubtitle}>Built from the value you quantified, scaled by attribution and value capture rate.</p>
        </div>

        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>RECOMMENDED FEE</span>
            <span className={styles.kpiValue}>{formatMoney(totals.recommendedFee, currency)}</span>
            <span className={styles.kpiFoot}>Quote this as your target price</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>CONSERVATIVE VALUE</span>
            <span className={styles.kpiValue}>{formatMoney(totals.conservativeValue, currency)}</span>
            <span className={styles.kpiFoot}>
              Range across scenarios: {formatMoney(totals.conservativeValue, currency)} – {formatMoney(totals.aggressiveValue, currency)}
            </span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>CLIENT ROI</span>
            <span className={styles.kpiValue}>
              {totals.clientRoi.toFixed(1)} <span className={styles.kpiUnit}>×</span>
            </span>
            <span className={styles.kpiFoot}>Target range: 5–10×</span>
          </div>
        </div>

        <Card title="Your Tiered Proposal" description="The three packages built from the derived fee. This is what gets sent to the client next.">
          <div className={styles.tiersGrid}>
            {estimate.valueBased.tiers.map((tier) => (
              <div
                className={`${styles.tierCard} ${tier.id === estimate.valueBased.recommendedTierId ? styles.tierCardRecommended : ""}`}
                key={tier.id}
              >
                <div className={styles.tierCardHead}>
                  <span className={styles.tierCardName}>{tier.name}</span>
                  {tier.id === estimate.valueBased.recommendedTierId && (
                    <span className={styles.tierCardBadge}>RECOMMENDED</span>
                  )}
                </div>
                <span className={styles.tierCardPrice}>{formatMoney(tier.price, currency)}</span>
                <span className={styles.tierCardDuration}>{formatWeeksRange(tier.durationMinWeeks, tier.durationMaxWeeks)}</span>
                {tier.description && <p className={styles.tierCardDesc}>{tier.description}</p>}
              </div>
            ))}
          </div>
        </Card>

        <div className={styles.bottomRow}>
          <Card title="Fee Build-Up" description="How the recommended fee was assembled, step by step.">
            <div className={styles.buildRow}>
              <span>Annual Problem Cost</span>
              <span>{formatMoney(totals.annualProblemCost, currency)}</span>
            </div>
            <div className={styles.buildRow}>
              <span>× Conservative Improvement ({Math.round(totals.conservativePct)}%)</span>
              <span>{formatMoney(totals.conservativeValue, currency)}</span>
            </div>
            <div className={styles.buildRow}>
              <span>× Attribution ({estimate.valueBased.attributionPct}%)</span>
              <span>{formatMoney(totals.attributionValue, currency)}</span>
            </div>
            <div className={styles.buildRow}>
              <span>× Value Capture Rate ({estimate.valueBased.valueCaptureRatePct}%)</span>
              <span>{formatMoney(totals.recommendedFee, currency)}</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.buildRowTotal}>
              <span>Recommended Fee</span>
              <span className={styles.buildRowTotalValue}>{formatMoney(totals.recommendedFee, currency)}</span>
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
            title="Before You Propose"
            description="Confirm each of these before sending the fee."
          >
            {CHECKS.map((item) => (
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

        <Card title="Break-Even Effort" description="Internal only. Never appears on the client proposal.">
          <div className={styles.buildRow}>
            <span>Your Effective Day Rate ({estimate.overheadRisk.overheadPct}% Overhead)</span>
            <span>{formatMoney(breakEven.effectiveDayRate, currency)}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.buildRowTotal}>
            <span>Break-Even Effort</span>
            <span className={styles.buildRowTotalValue}>{formatDays(breakEven.breakEvenDays)} d</span>
          </div>
          <p className={styles.kpiFoot}>
            Spend more than this delivering the work and you're effectively earning less than your normal day rate.
          </p>
        </Card>

        <Card title="Suggested Payment Schedule" description="Pick the split that fits the engagement.">
          <div className={styles.splitPresetRow}>
            {PAYMENT_SPLIT_PRESETS.map((preset) => (
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
