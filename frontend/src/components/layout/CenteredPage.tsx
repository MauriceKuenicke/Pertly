import type { ReactNode } from "react";
import styles from "./CenteredPage.module.css";

interface CenteredPageProps {
  children: ReactNode;
  /** Narrow (sign-in forms) or regular width. */
  width?: "narrow" | "regular";
}

/** Full-page centered column with the Pertly logo on top: sign-in, registration and app-level errors. */
export function CenteredPage({ children, width = "narrow" }: CenteredPageProps) {
  return (
    <div className={styles.page}>
      <div className={`${styles.column} ${width === "regular" ? styles.columnRegular : ""}`}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>P</div>
          <span className={styles.logoText}>Pertly</span>
        </div>
        {children}
      </div>
    </div>
  );
}
