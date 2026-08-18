import { IconInfo } from "./Icon";
import styles from "./InfoTooltip.module.css";

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.icon} aria-label="More information">
        <IconInfo width={11} height={11} strokeWidth={2} />
      </button>
      <span className={styles.tooltip} role="tooltip">
        {text}
      </span>
    </span>
  );
}
