import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { StepTopBar } from "./StepTopBar";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import styles from "./WizardLayout.module.css";

interface WizardLayoutProps {
  /** Shown as the browser tab title. */
  windowTitle: string;
  breadcrumbLabel: string;
  currentStep: 1 | 2 | 3 | 4;
  furthestStep: 1 | 2 | 3 | 4;
  savedLabel?: string;
  onGoToList: () => void;
  onNewEstimate: () => void;
  onGoToSettings?: () => void;
  onStepClick?: (step: 1 | 2 | 3 | 4) => void;
  footer: ReactNode;
  children: ReactNode;
}

export function WizardLayout({
  windowTitle,
  breadcrumbLabel,
  currentStep,
  furthestStep,
  savedLabel,
  onGoToList,
  onNewEstimate,
  onGoToSettings,
  onStepClick,
  footer,
  children,
}: WizardLayoutProps) {
  useDocumentTitle(windowTitle);
  return (
    <div className={styles.window}>
      <div className={styles.contentRow}>
        <Sidebar activeView="wizard" onGoToList={onGoToList} onNewEstimate={onNewEstimate} onGoToSettings={onGoToSettings} />
        <div className={styles.main}>
          <StepTopBar
            breadcrumbLabel={breadcrumbLabel}
            currentStep={currentStep}
            furthestStep={furthestStep}
            onBreadcrumbClick={onGoToList}
            onStepClick={onStepClick}
            savedLabel={savedLabel}
          />
          <div className={styles.contentArea}>{children}</div>
          {footer}
        </div>
      </div>
    </div>
  );
}
