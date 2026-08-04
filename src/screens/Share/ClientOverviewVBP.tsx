import type { Estimate } from "../../types/estimate";
import { calcPaymentMilestones, calcValueBased, sumExpenses } from "../../lib/calc";
import { formatMoney } from "../../lib/currency";
import { formatDate, formatWeeksRange, todayPlusDays } from "../../lib/date";
import { ExpensesSection, PaymentScheduleSection } from "./ProposalExtras";
import styles from "./ProposalDoc.module.css";

interface Props {
  estimate: Estimate;
}

export function ClientOverviewVBP({ estimate }: Props) {
  const currency = estimate.projectDetails.currency;
  const preparerName = estimate.projectDetails.preparerName;
  const totals = calcValueBased(estimate.valueBased);
  const validUntil = formatDate(todayPlusDays(14));
  const expensesTotal = sumExpenses(estimate.expenses);
  const grandTotal = totals.recommendedFee + expensesTotal;
  const milestones = calcPaymentMilestones(grandTotal, estimate.valueBased.paymentSplit);

  return (
    <div className={styles.doc}>
      <div className={styles.docHeader}>
        <div className={styles.avatar}>{(preparerName || "?").charAt(0).toUpperCase()}</div>
        <div>
          <p className={styles.preparer}>{preparerName || "Prepared by -"}</p>
          <p className={styles.validUntil}>Valid until {validUntil}</p>
        </div>
      </div>

      <h1 className={styles.docTitle}>{estimate.projectDetails.estimateName || "Project"}: Value-Based Proposal</h1>

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
        This proposal prices the engagement as a share of the value it creates for your business, not hours spent. Below is
        a conservative estimate of that value, and three ways to scope the work around it.
      </p>

      <div className={styles.valueStory}>
        <div className={styles.valueStoryItem}>
          <span className={styles.metaLabel}>COST OF STAYING AS-IS</span>
          <span className={styles.valueStoryAmount}>{formatMoney(totals.annualProblemCost, currency)} / yr</span>
          <p className={styles.valueStoryNote}>What the current process costs you today, left unaddressed.</p>
        </div>
        <div className={styles.valueStoryItem}>
          <span className={styles.metaLabel}>VALUE WE'LL CONSERVATIVELY CREATE</span>
          <span className={styles.valueStoryAmount}>{formatMoney(totals.conservativeValue, currency)} / yr</span>
          <p className={styles.valueStoryNote}>A conservative estimate. Moderate and best-case scenarios run higher.</p>
        </div>
      </div>

      <h2 className={styles.sectionHeading}>Three ways to scope this</h2>
      <div className={styles.tiersRow}>
        {estimate.valueBased.tiers.map((tier) => (
          <div className={styles.tierCol} key={tier.id}>
            <div className={styles.tierColHead}>
              <span className={styles.tierColName}>{tier.name}</span>
              {tier.id === estimate.valueBased.recommendedTierId && <span className={styles.tierColBadge}>RECOMMENDED</span>}
            </div>
            <span className={styles.tierColPrice}>{formatMoney(tier.price, currency)}</span>
            <span className={styles.tierColDuration}>{formatWeeksRange(tier.durationMinWeeks, tier.durationMaxWeeks)}</span>
            <p className={styles.tierColDesc}>{tier.description}</p>
          </div>
        ))}
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
