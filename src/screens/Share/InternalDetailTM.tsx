import type { Estimate } from "../../types/estimate";
import { calcPaymentMilestones, calcRoleBreakdown, calcTimeMaterials, sumExpenses } from "../../lib/calc";
import { formatDays, formatMoney } from "../../lib/currency";
import { formatDate } from "../../lib/date";
import { ExpensesSection, PaymentScheduleSection } from "./ProposalExtras";
import styles from "./ProposalDoc.module.css";

interface Props {
  estimate: Estimate;
}

export function InternalDetailTM({ estimate }: Props) {
  const currency = estimate.projectDetails.currency;
  const useRoleBasedPricing = estimate.timeMaterials.useRoleBasedPricing;
  const totals = calcTimeMaterials(estimate.timeMaterials, estimate.rateEffort, estimate.overheadRisk);
  const roleBreakdown = calcRoleBreakdown(estimate.timeMaterials, estimate.rateEffort);
  const expensesTotal = sumExpenses(estimate.expenses);
  const isFixedPrice = estimate.timeMaterials.isFixedPrice;
  const riskCoveragePct = estimate.timeMaterials.fixedPriceRiskCoveragePct;
  const quotedPrice = isFixedPrice ? totals.fixedPriceQuote : totals.recommendedBudget;
  const grandTotal = quotedPrice + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.timeMaterials.paymentSplit);

  const roleNameFor = (roleId: string | undefined) => {
    const role = estimate.timeMaterials.roles.find((r) => r.id === roleId);
    return role ? role.name || "Untitled role" : "Unassigned";
  };

  return (
    <div className={styles.doc}>
      <div className={styles.internalBanner}>
        🔒 INTERNAL: includes day rate, overhead and margin. Do not forward to the client.
      </div>

      <h1 className={styles.docTitle}>{estimate.projectDetails.estimateName || "Project Estimate"}: Internal Cost Breakdown</h1>
      <p className={styles.docByline}>
        {estimate.projectDetails.clientName || "-"} · prepared by {estimate.projectDetails.preparerName || "-"} ·{" "}
        {formatDate(new Date())}
      </p>

      <div className={styles.assumptionsUsed}>
        <div>
          <span className={styles.metaLabel}>DAY RATE</span>
          <span className={styles.metaValue}>
            {useRoleBasedPricing
              ? `Role-based (${estimate.timeMaterials.roles.length})`
              : formatMoney(estimate.rateEffort.dayRate, currency)}
          </span>
        </div>
        <div>
          <span className={styles.metaLabel}>OVERHEAD</span>
          <span className={styles.metaValue}>{estimate.overheadRisk.overheadPct}%</span>
        </div>
        <div>
          <span className={styles.metaLabel}>CONTINGENCY</span>
          <span className={styles.metaValue}>{estimate.overheadRisk.contingencyPct}%</span>
        </div>
        <div>
          <span className={styles.metaLabel}>{isFixedPrice ? "PRICING STRUCTURE" : "NTE CAP BASIS"}</span>
          <span className={styles.metaValue}>{isFixedPrice ? "Fixed Price" : "Pessimistic Case"}</span>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Cost Build-Up</h2>
      {isFixedPrice ? (
        <>
          <div className={styles.buildRow}>
            <span>Base Delivery Cost</span>
            <span>{formatMoney(totals.baseCost, currency)}</span>
          </div>
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
          <div className={styles.buildRow}>
            <span>+ Overhead ({estimate.overheadRisk.overheadPct}%)</span>
            <span>{formatMoney(totals.riskAdjustedOverheadAmount, currency)}</span>
          </div>
          <div className={styles.buildRowSub}>
            <span>Delivery Subtotal</span>
            <span>{formatMoney(totals.riskAdjustedSubtotal, currency)}</span>
          </div>
          <div className={styles.buildRow}>
            <span>+ Contingency ({estimate.overheadRisk.contingencyPct}%)</span>
            <span>{formatMoney(totals.riskAdjustedContingencyAmount, currency)}</span>
          </div>
          <div className={styles.buildRowTotal}>
            <span>Fixed Price (Quote This)</span>
            <span>{formatMoney(quotedPrice, currency)}</span>
          </div>
          <div className={styles.buildRow}>
            <span>Expected Cost (Internal Reference, Not Shown to Client)</span>
            <span>{formatMoney(totals.recommendedBudget, currency)}</span>
          </div>
          <div className={styles.buildRow}>
            <span>Not-to-Exceed Ceiling (Internal Reference, 100% Risk Coverage)</span>
            <span>{formatMoney(totals.notToExceedCap, currency)}</span>
          </div>
        </>
      ) : (
        <>
          <div className={styles.buildRow}>
            <span>
              Base Delivery Cost (
              {useRoleBasedPricing
                ? `${formatDays(totals.expectedDays)} d across roles`
                : `${formatDays(totals.expectedDays)} d × ${formatMoney(estimate.rateEffort.dayRate, currency)}`}
              )
            </span>
            <span>{formatMoney(totals.baseCost, currency)}</span>
          </div>
          <div className={styles.buildRow}>
            <span>+ Overhead ({estimate.overheadRisk.overheadPct}%)</span>
            <span>{formatMoney(totals.overheadAmount, currency)}</span>
          </div>
          <div className={styles.buildRowSub}>
            <span>Delivery Subtotal</span>
            <span>{formatMoney(totals.deliverySubtotal, currency)}</span>
          </div>
          <div className={styles.buildRow}>
            <span>+ Contingency ({estimate.overheadRisk.contingencyPct}%)</span>
            <span>{formatMoney(totals.contingencyAmount, currency)}</span>
          </div>
          <div className={styles.buildRowTotal}>
            <span>Recommended Budget (Quote This)</span>
            <span>{formatMoney(totals.recommendedBudget, currency)}</span>
          </div>
          <div className={styles.buildRow}>
            <span>Not-to-Exceed Cap (Pessimistic Case)</span>
            <span>{formatMoney(totals.notToExceedCap, currency)}</span>
          </div>
        </>
      )}
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

      <h2 className={styles.sectionHeading}>Effective Day Rate</h2>
      <div className={styles.buildRow}>
        <span>Blended Day Rate, Overhead Included</span>
        <span>{formatMoney(totals.effectiveDayRate, currency)}</span>
      </div>

      {roleBreakdown.length > 0 && (
        <>
          <h2 className={styles.sectionHeading}>Team & Rate Breakdown</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ROLE</th>
                <th className={styles.tableRight}>DAY RATE</th>
                <th className={styles.tableRight}>DAYS</th>
                <th className={styles.tableRight}>COST</th>
                <th className={styles.tableRight}>% OF COST</th>
              </tr>
            </thead>
            <tbody>
              {roleBreakdown.map((row) => (
                <tr key={row.roleId}>
                  <td>{row.roleName || "Untitled role"}</td>
                  <td className={styles.tableRight}>{formatMoney(row.dayRate, currency)}</td>
                  <td className={styles.tableRight}>{formatDays(row.days)}</td>
                  <td className={styles.tableRight}>{formatMoney(row.cost, currency)}</td>
                  <td className={styles.tableRight}>{Math.round(row.pctOfCost)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 className={styles.sectionHeading}>Detailed Work Breakdown</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>WORK PACKAGE</th>
            {useRoleBasedPricing && <th>ROLE</th>}
            <th className={styles.tableRight}>O</th>
            <th className={styles.tableRight}>M</th>
            <th className={styles.tableRight}>P</th>
            <th className={styles.tableRight}>EXPECTED</th>
            <th className={styles.tableRight}>σ</th>
            <th className={styles.tableRight}>COST</th>
          </tr>
        </thead>
        <tbody>
          {totals.rows.map((row, i) => (
            <tr key={row.id}>
              <td>{i + 1}</td>
              <td>{row.name || "Untitled package"}</td>
              {useRoleBasedPricing && <td>{roleNameFor(row.roleId)}</td>}
              <td className={styles.tableRight}>{formatDays(row.optimisticDays)}</td>
              <td className={styles.tableRight}>{formatDays(row.likelyDays)}</td>
              <td className={styles.tableRight}>{formatDays(row.pessimisticDays)}</td>
              <td className={styles.tableRight}>{formatDays(row.expectedDays)}</td>
              <td className={styles.tableRight}>±{formatDays(row.sigmaDays, 2)}</td>
              <td className={styles.tableRight}>{formatMoney(row.cost, currency)}</td>
            </tr>
          ))}
          <tr className={styles.tableTotal}>
            <td />
            <td>Total</td>
            {useRoleBasedPricing && <td />}
            <td className={styles.tableRight}>{formatDays(totals.totalOptimisticDays)}</td>
            <td className={styles.tableRight}>{formatDays(totals.totalLikelyDays)}</td>
            <td className={styles.tableRight}>{formatDays(totals.totalPessimisticDays)}</td>
            <td className={styles.tableRight}>{formatDays(totals.expectedDays)}</td>
            <td className={styles.tableRight}>±{formatDays(totals.sigmaDays, 2)}</td>
            <td className={styles.tableRight}>{formatMoney(totals.baseCost, currency)}</td>
          </tr>
        </tbody>
      </table>

      <ExpensesSection expenses={estimate.expenses} currency={currency} />

      <PaymentScheduleSection milestones={milestones} currency={currency} />
    </div>
  );
}
