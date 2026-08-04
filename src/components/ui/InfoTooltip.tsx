import styles from "./InfoTooltip.module.css";

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.icon} aria-label="More information">
        i
      </button>
      <span className={styles.tooltip} role="tooltip">
        {text}
      </span>
    </span>
  );
}
