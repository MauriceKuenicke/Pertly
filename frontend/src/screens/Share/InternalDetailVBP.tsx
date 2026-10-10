import type { Estimate } from "../../types/estimate";
import { calcBreakEvenEffort, calcPaymentMilestones, calcValueBased, sumExpenses } from "../../lib/calc";
import { formatDays, formatMoney } from "../../lib/currency";
import { formatDate, formatWeeksRange } from "../../lib/date";
import { ExpensesSection, PaymentScheduleSection } from "./ProposalExtras";
import styles from "./ProposalDoc.module.css";

interface Props {
  estimate: Estimate;
}

export function InternalDetailVBP({ estimate }: Props) {
  const currency = estimate.projectDetails.currency;
  const totals = calcValueBased(estimate.valueBased);
  const tierB = estimate.valueBased.tiers.find((t) => t.id === estimate.valueBased.recommendedTierId) ?? estimate.valueBased.tiers[1];
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedFee + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.valueBased.paymentSplit);
  const breakEven = calcBreakEvenEffort(totals.recommendedFee, estimate.rateEffort, estimate.overheadRisk);

  return (
    <div className={styles.doc}>
      <div className={styles.internalBanner}>
        🔒 INTERNAL: includes attribution, value capture rate, and fee derivation. Do not forward to the client.
      </div>

      <h1 className={styles.docTitle}>{estimate.projectDetails.estimateName || "Project"}: Internal Fee Breakdown</h1>
      <p className={styles.docByline}>
        {estimate.projectDetails.clientName || "-"} · prepared by {estimate.projectDetails.preparerName || "-"} ·{" "}
        {formatDate(new Date())}
      </p>

      <div className={styles.assumptionsUsed}>
        <div>
          <span className={styles.metaLabel}>CONSERVATIVE IMPROVEMENT</span>
          <span className={styles.metaValue}>{Math.round(totals.conservativePct)}%</span>
        </div>
        <div>
          <span className={styles.metaLabel}>ATTRIBUTION</span>
          <span className={styles.metaValue}>{estimate.valueBased.attributionPct}%</span>
        </div>
        <div>
          <span className={styles.metaLabel}>VALUE CAPTURE RATE</span>
          <span className={styles.metaValue}>{estimate.valueBased.valueCaptureRatePct}%</span>
        </div>
        <div>
          <span className={styles.metaLabel}>TARGET ROI RANGE</span>
          <span className={styles.metaValue}>5–10×</span>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Value Drivers</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>VALUE DRIVER</th>
            <th className={styles.tableRight}>ANNUAL COST</th>
          </tr>
        </thead>
        <tbody>
          {estimate.valueBased.valueDrivers.map((driver) => (
            <tr key={driver.id}>
              <td>
                {driver.label}
                <div className={styles.tableSubtext}>{driver.hint}</div>
              </td>
              <td className={styles.tableRight}>{formatMoney(driver.annualAmount, currency)}</td>
            </tr>
          ))}
          <tr className={styles.tableTotal}>
            <td>Annual Problem Cost</td>
            <td className={styles.tableRight}>{formatMoney(totals.annualProblemCost, currency)}</td>
          </tr>
        </tbody>
      </table>

      <h2 className={styles.sectionHeading}>Fee Build-Up</h2>
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
      <div className={styles.buildRowTotal}>
        <span>Recommended Fee</span>
        <span>{formatMoney(totals.recommendedFee, currency)}</span>
      </div>
      <div className={styles.buildRow}>
        <span>Client ROI</span>
        <span>{totals.clientRoi.toFixed(1)}×</span>
      </div>
      {expensesTotal > 0 && (
        <>
          <div className={styles.buildRow}>
            <span>+ Pass-Through Expenses</span>
            <span>{formatMoney(expensesTotal, currency)}</span>
          </div>
          <div className={styles.buildRowTotal}>
            <span>Total Quoted Price</span>
            <span>{formatMoney(grandTotal, currency)}</span>
          </div>
        </>
      )}

      <h2 className={styles.sectionHeading}>Break-Even Effort</h2>
      <div className={styles.buildRow}>
        <span>Your Effective Day Rate ({estimate.overheadRisk.overheadPct}% Overhead)</span>
        <span>{formatMoney(breakEven.effectiveDayRate, currency)}</span>
      </div>
      <div className={styles.buildRowTotal}>
        <span>Break-Even Effort</span>
        <span>{formatDays(breakEven.breakEvenDays)} d</span>
      </div>

      <h2 className={styles.sectionHeading}>Tier Economics</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>TIER</th>
            <th>DURATION</th>
            <th className={styles.tableRight}>vs. {tierB?.name ?? "Tier B"}</th>
            <th className={styles.tableRight}>PRICE</th>
          </tr>
        </thead>
        <tbody>
          {estimate.valueBased.tiers.map((tier) => (
            <tr key={tier.id}>
              <td>
                {tier.name}
                {tier.description && <div className={styles.tableSubtext}>{tier.description}</div>}
              </td>
              <td>{formatWeeksRange(tier.durationMinWeeks, tier.durationMaxWeeks)}</td>
              <td className={styles.tableRight}>
                {tier.id === tierB?.id
                  ? "base fee"
                  : tierB && tierB.price > 0
                    ? `${(tier.price / tierB.price).toFixed(2)}× ${tierB.name}`
                    : "-"}
              </td>
              <td className={styles.tableRight}>{formatMoney(tier.price, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ExpensesSection expenses={estimate.expenses} currency={currency} />

      <PaymentScheduleSection milestones={milestones} currency={currency} />
    </div>
  );
}
