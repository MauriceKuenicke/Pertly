import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card } from "../../components/ui";
import { calcPaymentMilestones, calcTimeMaterials, sumExpenses } from "../../lib/calc";
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

export function SummaryTMScreen({
  estimate,
  onGoToList,
  onGoToSettings,
  onNewEstimate,
  onStepClick,
  savedLabel,
  onBack,
  onNext,
}: WizardScreenProps) {
  const totals = calcTimeMaterials(estimate.timeMaterials.workPackages, estimate.rateEffort, estimate.overheadRisk);
  const currency = estimate.projectDetails.currency;
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedBudget + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal);

  return (
    <WizardLayout
      windowTitle={windowTitleFor(estimate)}
      breadcrumbLabel={breadcrumbLabelFor(estimate)}
      currentStep={3}
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
          <h1 className={styles.pageTitle}>Here's your recommended budget</h1>
          <p className={styles.pageSubtitle}>Built from your work breakdown, overhead uplift, and contingency buffer.</p>
        </div>

        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>RECOMMENDED BUDGET</span>
            <span className={styles.kpiValue}>{formatMoney(totals.recommendedBudget, currency)}</span>
            <span className={styles.kpiFoot}>Quote this as your target price</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>EXPECTED EFFORT</span>
            <span className={styles.kpiValue}>
              {formatDays(totals.expectedDays)} <span className={styles.kpiUnit}>days</span>
            </span>
            <span className={styles.kpiFoot}>± {formatDays(totals.sigmaDays, 2)} days combined uncertainty</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>NOT-TO-EXCEED CAP</span>
            <span className={styles.kpiValue}>{formatMoney(totals.notToExceedCap, currency)}</span>
            <span className={styles.kpiFoot}>Agree this ceiling with the client (pessimistic case)</span>
          </div>
        </div>

        <div className={styles.bottomRow}>
          <Card
            title="Cost build-up"
            description="How the recommended budget was assembled, step by step."
          >
            <div className={styles.buildRow}>
              <span>Base delivery cost</span>
              <span>{formatMoney(totals.baseCost, currency)}</span>
            </div>
            <div className={styles.buildRow}>
              <span>+ Overhead ({estimate.overheadRisk.overheadPct}%)</span>
              <span>{formatMoney(totals.overheadAmount, currency)}</span>
            </div>
            <div className={styles.buildRowSub}>
              <span>Delivery subtotal</span>
              <span>{formatMoney(totals.deliverySubtotal, currency)}</span>
            </div>
            <div className={styles.buildRow}>
              <span>+ Contingency ({estimate.overheadRisk.contingencyPct}%)</span>
              <span>{formatMoney(totals.contingencyAmount, currency)}</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.buildRowTotal}>
              <span>Recommended budget</span>
              <span>{formatMoney(totals.recommendedBudget, currency)}</span>
            </div>
            {expensesTotal > 0 && (
              <>
                <div className={styles.buildRow}>
                  <span>+ Pass-through expenses</span>
                  <span>{formatMoney(expensesTotal, currency)}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.buildRowTotal}>
                  <span>Total quoted price</span>
                  <span>{formatMoney(grandTotal, currency)}</span>
                </div>
              </>
            )}
          </Card>

          <Card
            title="Governance checklist"
            description="Agree these with the client before you start. Company policy §4.4."
          >
            {GOVERNANCE.map((item) => (
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

        <Card
          title="Suggested payment schedule"
          description="A defensible default split for the total quoted price. Adjust to fit the engagement."
        >
          <div className={styles.milestoneRow}>
            {milestones.map((m) => (
              <div className={styles.milestone} key={m.label}>
                <span className={styles.milestoneLabel}>{m.label.toUpperCase()}</span>
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
