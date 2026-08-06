import type { Estimate } from "../../types/estimate";
import { allocateBudgetByPackage, calcPaymentMilestones, calcTimeMaterials, sumExpenses } from "../../lib/calc";
import { formatMoney } from "../../lib/currency";
import { formatDate, todayPlusDays } from "../../lib/date";
import { ExpensesSection, PaymentScheduleSection } from "./ProposalExtras";
import styles from "./ProposalDoc.module.css";

interface Props {
  estimate: Estimate;
}

export function ClientOverviewTM({ estimate }: Props) {
  const currency = estimate.projectDetails.currency;
  const preparerName = estimate.projectDetails.preparerName;
  const totals = calcTimeMaterials(estimate.timeMaterials, estimate.rateEffort, estimate.overheadRisk);
  const allocations = allocateBudgetByPackage(totals);
  const validUntil = formatDate(todayPlusDays(14));
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedBudget + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.timeMaterials.paymentSplit);

  return (
    <div className={styles.doc}>
      <div className={styles.docHeader}>
        <div className={styles.avatar}>{(preparerName || "?").charAt(0).toUpperCase()}</div>
        <div>
          <p className={styles.preparer}>{preparerName || "Prepared by -"}</p>
          <p className={styles.validUntil}>Valid until {validUntil}</p>
        </div>
      </div>

      <h1 className={styles.docTitle}>{estimate.projectDetails.estimateName || "Project Estimate"}: Project Estimate</h1>

      <div className={styles.metaGrid}>
        <div>
          <span className={styles.metaLabel}>PREPARED FOR</span>
          <span className={styles.metaValue}>{estimate.projectDetails.clientName || "-"}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>PROJECT</span>
          <span className={styles.metaValue}>{estimate.projectDetails.estimateName || "-"}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>DATE</span>
          <span className={styles.metaValue}>{formatDate(new Date())}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>VALID UNTIL</span>
          <span className={styles.metaValue}>{validUntil}</span>
        </div>
      </div>

      <p className={styles.docParagraph}>
        The work below is split into {allocations.length} deliverable{allocations.length === 1 ? "" : "s"}, each priced from a
        best-case / likely / worst-case range with a risk buffer already folded in. You're billed for actual time worked, and
        the total is capped. You'll never pay above the not-to-exceed figure.
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>WORK PACKAGE</th>
            <th className={styles.tableRight}>INVESTMENT</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((row) => (
            <tr key={row.id}>
              <td>{row.name || "Untitled package"}</td>
              <td className={styles.tableRight}>{formatMoney(row.amount, currency)}</td>
            </tr>
          ))}
          <tr className={styles.tableTotal}>
            <td>Estimated investment</td>
            <td className={styles.tableRight}>{formatMoney(totals.recommendedBudget, currency)}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.capNote}>
        🔒 Not-to-exceed cap: {formatMoney(totals.notToExceedCap + expensesTotal, currency)}. You will never be billed
        above this.
      </div>

      <ExpensesSection expenses={estimate.expenses} currency={currency} />

      {expensesTotal > 0 && (
        <div className={styles.buildRowTotal}>
          <span>Total quoted price</span>
          <span>{formatMoney(grandTotal, currency)}</span>
        </div>
      )}

      <PaymentScheduleSection milestones={milestones} currency={currency} />

      <div className={styles.assumptions}>
        <h2 className={styles.sectionHeading}>Assumptions & exclusions</h2>
        {[...estimate.assumptions, ...estimate.exclusions].map((item, i) => (
          <p className={styles.bulletRow} key={i}>
            • {item}
          </p>
        ))}
      </div>
    </div>
  );
}
