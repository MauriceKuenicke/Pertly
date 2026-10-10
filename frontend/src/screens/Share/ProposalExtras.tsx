import type { ExpenseItem } from "../../types/estimate";
import type { PaymentMilestone } from "../../lib/calc";
import { formatMoney } from "../../lib/currency";
import styles from "./ProposalDoc.module.css";

/** Itemized pass-through costs (hardware, licenses, travel), shared between
 * the client and internal proposal views for both pricing methods. */
export function ExpensesSection({ expenses, currency }: { expenses: ExpenseItem[]; currency: string }) {
  if (expenses.length === 0) return null;
  return (
    <>
      <h2 className={styles.sectionHeading}>Pass-Through Expenses</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ITEM</th>
            <th className={styles.tableRight}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>{expense.label || "Untitled expense"}</td>
              <td className={styles.tableRight}>{formatMoney(expense.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Suggested payment schedule off the total quoted price (fee/budget plus
 * any pass-through expenses), shared across all four proposal views. */
export function PaymentScheduleSection({
  milestones,
  currency,
}: {
  milestones: PaymentMilestone[];
  currency: string;
}) {
  return (
    <>
      <h2 className={styles.sectionHeading}>Suggested Payment Schedule</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>MILESTONE</th>
            <th className={styles.tableRight}>SHARE</th>
            <th className={styles.tableRight}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((milestone) => (
            <tr key={milestone.label}>
              <td>{milestone.label}</td>
              <td className={styles.tableRight}>{milestone.pct}%</td>
              <td className={styles.tableRight}>{formatMoney(milestone.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
