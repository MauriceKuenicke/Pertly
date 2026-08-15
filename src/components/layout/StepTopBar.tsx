import styles from "./StepTopBar.module.css";

const STEPS: { n: 1 | 2 | 3 | 4; label: string }[] = [
  { n: 1, label: "Assumptions" },
  { n: 2, label: "Pricing" },
  { n: 3, label: "Summary" },
  { n: 4, label: "Proposal" },
];

interface StepTopBarProps {
  breadcrumbLabel: string;
  currentStep: 1 | 2 | 3 | 4;
  furthestStep: 1 | 2 | 3 | 4;
  onBreadcrumbClick: () => void;
  onStepClick?: (step: 1 | 2 | 3 | 4) => void;
  savedLabel?: string;
}

export function StepTopBar({
  breadcrumbLabel,
  currentStep,
  furthestStep,
  onBreadcrumbClick,
  onStepClick,
  savedLabel,
}: StepTopBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.breadcrumb}>
        <button className={styles.breadcrumbLink} onClick={onBreadcrumbClick}>
          Estimates
        </button>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{breadcrumbLabel}</span>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step, i) => {
          const isDone = step.n <= furthestStep && step.n !== currentStep;
          const isActive = step.n === currentStep;
          const clickable = Boolean(onStepClick) && step.n <= furthestStep;
          return (
            <div className={styles.stepGroup} key={step.n}>
              {i > 0 && <span className={styles.connector} />}
              <button
                className={styles.step}
                onClick={() => clickable && onStepClick?.(step.n)}
                disabled={!clickable}
                type="button"
              >
                <span className={`${styles.circle} ${isDone || isActive ? styles.circleFilled : ""} ${isActive ? styles.circleActive : ""}`}>
                  {isDone ? "✓" : step.n}
                </span>
                <span className={`${styles.stepLabel} ${isDone || isActive ? styles.stepLabelActive : ""}`}>{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.saved}>
        {savedLabel && (
          <>
            <span className={styles.savedDot} />
            <span>{savedLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
