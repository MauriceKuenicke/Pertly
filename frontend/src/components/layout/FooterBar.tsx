import type { ReactNode } from "react";
import styles from "./FooterBar.module.css";

interface FooterBarProps {
  left: ReactNode;
  right: ReactNode;
}

export function FooterBar({ left, right }: FooterBarProps) {
  return (
    <div className={styles.bar}>
      <div>{left}</div>
      <div className={styles.right}>{right}</div>
    </div>
  );
}
