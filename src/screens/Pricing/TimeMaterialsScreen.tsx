import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card } from "../../components/ui";
import { calcTimeMaterials, normalizeWorkPackageDays } from "../../lib/calc";
import { formatDays, formatMoney } from "../../lib/currency";
import { createId } from "../../lib/id";
import type { WizardScreenProps } from "../wizardProps";
import { breadcrumbLabelFor, windowTitleFor } from "../wizardProps";
import styles from "./TimeMaterialsScreen.module.css";

export function TimeMaterialsScreen({
  estimate,
  onChange,
  onGoToList,
  onGoToSettings,
  onNewEstimate,
  onStepClick,
  savedLabel,
  onBack,
  onNext,
}: WizardScreenProps) {
  const totals = calcTimeMaterials(estimate.timeMaterials.workPackages, estimate.rateEffort, estimate.overheadRisk);
  const currency = estimate.projectDetails.currency;

  const updateRow = (id: string, patch: Partial<{ name: string; optimisticDays: number; likelyDays: number; pessimisticDays: number }>) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        workPackages: e.timeMaterials.workPackages.map((r) =>
          r.id === id ? normalizeWorkPackageDays({ ...r, ...patch }) : r,
        ),
      },
    }));
  };

  return (
    <WizardLayout
      windowTitle={windowTitleFor(estimate)}
      breadcrumbLabel={breadcrumbLabelFor(estimate)}
      currentStep={2}
      savedLabel={savedLabel}
      onGoToList={onGoToList}
      onNewEstimate={onNewEstimate}
      onGoToSettings={onGoToSettings}
      onStepClick={onStepClick}
      footer={
        <FooterBar
          left={
            <Button variant="ghost" onClick={onBack}>
              ← Back
            </Button>
          }
          right={
            <>
              <span className={styles.stepText}>Step 2 of 4</span>
              <Button variant="primary" onClick={onNext}>
                Continue to Summary →
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Break down the work</h1>
            <p className={styles.pageSubtitle}>Split the project into deliverables. Three numbers per row is all PERT needs.</p>
          </div>

          <Card
            title="Work breakdown"
            description="Enter Optimistic / Most likely / Pessimistic days per package. Expected and σ calculate automatically (PERT)."
            info="Three-point (PERT) estimation turns a range into one defensible number per deliverable. It matters because a single-guess estimate hides your uncertainty, and this makes it explicit, combining it mathematically into one confidence interval for the whole project."
          >
            <div className={styles.table}>
              <div className={styles.headerRow}>
                <span className={styles.colNum}>#</span>
                <span className={styles.colName}>WORK PACKAGE</span>
                <span className={styles.colNum}>OPT.</span>
                <span className={styles.colNum}>LIKELY</span>
                <span className={styles.colNum}>PESS.</span>
                <span className={styles.colNum}>EXPECTED</span>
                <span className={styles.colNum}>σ</span>
                <span className={styles.colCost}>COST</span>
                <span className={styles.colDel} />
              </div>
              {totals.rows.map((row, i) => (
                <div className={styles.row} key={row.id}>
                  <span className={styles.colNum}>{i + 1}</span>
                  <input
                    className={styles.nameInput}
                    value={row.name}
                    placeholder="Deliverable name"
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  />
                  <input
                    className={styles.numInput}
                    type="number"
                    min={0}
                    value={row.optimisticDays}
                    onChange={(e) => updateRow(row.id, { optimisticDays: Number(e.target.value) })}
                  />
                  <input
                    className={styles.numInput}
                    type="number"
                    min={0}
                    value={row.likelyDays}
                    onChange={(e) => updateRow(row.id, { likelyDays: Number(e.target.value) })}
                  />
                  <input
                    className={styles.numInput}
                    type="number"
                    min={0}
                    value={row.pessimisticDays}
                    onChange={(e) => updateRow(row.id, { pessimisticDays: Number(e.target.value) })}
                  />
                  <span className={styles.colNum}>{formatDays(row.expectedDays)}</span>
                  <span className={styles.colNum}>±{formatDays(row.sigmaDays, 2)}</span>
                  <span className={styles.colCost}>{formatMoney(row.cost, currency)}</span>
                  <button
                    type="button"
                    className={styles.colDel}
                    aria-label="Remove row"
                    onClick={() =>
                      onChange((e) => ({
                        ...e,
                        timeMaterials: { workPackages: e.timeMaterials.workPackages.filter((r) => r.id !== row.id) },
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className={styles.totalRow}>
                <span />
                <span>Total</span>
                <span className={styles.colNum}>{totals.totalOptimisticDays}</span>
                <span className={styles.colNum}>{totals.totalLikelyDays}</span>
                <span className={styles.colNum}>{totals.totalPessimisticDays}</span>
                <span className={styles.colNum}>{formatDays(totals.expectedDays)} d</span>
                <span className={styles.colNum}>±{formatDays(totals.sigmaDays, 2)}</span>
                <span className={styles.colCost}>{formatMoney(totals.baseCost, currency)}</span>
                <span />
              </div>
            </div>
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={() =>
                onChange((e) => ({
                  ...e,
                  timeMaterials: {
                    workPackages: [
                      ...e.timeMaterials.workPackages,
                      { id: createId(), name: "", optimisticDays: 1, likelyDays: 2, pessimisticDays: 4 },
                    ],
                  },
                }))
              }
            >
              + Add work package
            </button>
          </Card>
        </div>

        <div className={styles.rightPanel}>
          <Card title="Estimate summary">
            <div className={styles.bigNumber}>
              <span className={styles.bigNumberValue}>{formatDays(totals.expectedDays)}</span>
              <span className={styles.bigNumberLabel}>expected days</span>
            </div>
            <p className={styles.sigmaNote}>
              ± {formatDays(totals.sigmaDays, 2)} days (1σ), combined across all {totals.rows.length} packages
            </p>
            <div className={styles.divider} />
            <div className={styles.summaryRow}>
              <span>Base cost (expected)</span>
              <span>{formatMoney(totals.baseCost, currency)}</span>
            </div>
            <div className={styles.summaryRowBig}>
              <span>Recommended budget</span>
              <span>{formatMoney(totals.recommendedBudget, currency)}</span>
            </div>
            <div className={styles.divider} />
            <p className={styles.footnote}>
              Uncertainty is combined with root-sum-of-squares across packages, not simple addition, so total risk isn't
              overstated.
            </p>
          </Card>
        </div>
      </div>
    </WizardLayout>
  );
}
