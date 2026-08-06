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
  const grandTotal = totals.recommendedBudget + expensesTotal;
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
          <span className={styles.metaLabel}>NTE CAP BASIS</span>
          <span className={styles.metaValue}>Pessimistic case</span>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Cost build-up</h2>
      <div className={styles.buildRow}>
        <span>
          Base delivery cost (
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
        <span>Delivery subtotal</span>
        <span>{formatMoney(totals.deliverySubtotal, currency)}</span>
      </div>
      <div className={styles.buildRow}>
        <span>+ Contingency ({estimate.overheadRisk.contingencyPct}%)</span>
        <span>{formatMoney(totals.contingencyAmount, currency)}</span>
      </div>
      <div className={styles.buildRowTotal}>
        <span>Recommended budget (quote this)</span>
        <span>{formatMoney(totals.recommendedBudget, currency)}</span>
      </div>
      <div className={styles.buildRow}>
        <span>Not-to-exceed cap (pessimistic case)</span>
        <span>{formatMoney(totals.notToExceedCap, currency)}</span>
      </div>
      {expensesTotal > 0 && (
        <>
          <div className={styles.buildRow}>
            <span>+ Pass-through expenses</span>
            <span>{formatMoney(expensesTotal, currency)}</span>
          </div>
          <div className={styles.buildRowTotal}>
            <span>Total quoted price</span>
            <span>{formatMoney(grandTotal, currency)}</span>
          </div>
        </>
      )}

      {roleBreakdown.length > 0 && (
        <>
          <h2 className={styles.sectionHeading}>Team & rate breakdown</h2>
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

      <h2 className={styles.sectionHeading}>Detailed work breakdown</h2>
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
              <td className={styles.tableRight}>{row.optimisticDays}</td>
              <td className={styles.tableRight}>{row.likelyDays}</td>
              <td className={styles.tableRight}>{row.pessimisticDays}</td>
              <td className={styles.tableRight}>{formatDays(row.expectedDays)}</td>
              <td className={styles.tableRight}>±{formatDays(row.sigmaDays, 2)}</td>
              <td className={styles.tableRight}>{formatMoney(row.cost, currency)}</td>
            </tr>
          ))}
          <tr className={styles.tableTotal}>
            <td />
            <td>Total</td>
            {useRoleBasedPricing && <td />}
            <td className={styles.tableRight}>{totals.totalOptimisticDays}</td>
            <td className={styles.tableRight}>{totals.totalLikelyDays}</td>
            <td className={styles.tableRight}>{totals.totalPessimisticDays}</td>
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
