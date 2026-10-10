import type { ReactNode } from "react";
import styles from "./Modal.module.css";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  /** When false, there's no close button and clicking the backdrop does nothing. Defaults to true. */
  dismissible?: boolean;
  children: ReactNode;
}

export function Modal({ title, description, onClose, dismissible = true, children }: ModalProps) {
  return (
    <div className={styles.backdrop} onClick={dismissible ? onClose : undefined}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{title}</h2>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {dismissible && (
            <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
