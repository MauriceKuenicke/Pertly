import styles from "./Badge.module.css";

export type BadgeType = "optimistic" | "likely" | "pessimistic" | "neutral" | "danger" | "success";

const LABELS: Record<BadgeType, string> = {
  optimistic: "OPTIMISTIC",
  likely: "MOST LIKELY",
  pessimistic: "PESSIMISTIC",
  neutral: "DRAFT",
  danger: "OVER CAP",
  success: "DONE",
};

interface BadgeProps {
  type: BadgeType;
  label?: string;
}

export function Badge({ type, label }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[type]}`}>
      <span className={styles.dot} />
      {label ?? LABELS[type]}
    </span>
  );
}
