import type { HTMLAttributes, ReactNode } from "react";
import { InfoTooltip } from "./InfoTooltip";
import styles from "./Card.module.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  info?: string;
  headerExtra?: ReactNode;
}

export function Card({ title, description, info, headerExtra, className, children, ...rest }: CardProps) {
  return (
    <div className={`${styles.card} ${className ?? ""}`} {...rest}>
      {(title || headerExtra) && (
        <div className={styles.header}>
          <div className={styles.headerText}>
            {title && (
              <h3 className={styles.title}>
                {title}
                {info && <InfoTooltip text={info} />}
              </h3>
            )}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {headerExtra}
        </div>
      )}
      {children}
    </div>
  );
}
