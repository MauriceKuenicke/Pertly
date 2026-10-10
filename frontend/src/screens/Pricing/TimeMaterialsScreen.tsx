import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card, Slider } from "../../components/ui";
import { calcRoleBreakdown, calcTimeMaterials, normalizeWorkPackageDays } from "../../lib/calc";
import { formatDays, formatDeduction, formatMoney } from "../../lib/currency";
import { createId } from "../../lib/id";
import { dropIndex, moveItem, type DropPosition } from "../../lib/reorder";
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
  const { timeMaterials } = estimate;
  const useRoleBasedPricing = timeMaterials.useRoleBasedPricing;
  const totals = calcTimeMaterials(timeMaterials, estimate.rateEffort, estimate.overheadRisk);
  const roleBreakdown = calcRoleBreakdown(timeMaterials, estimate.rateEffort);
  const currency = estimate.projectDetails.currency;
  const canContinue = totals.baseCost > 0;
  const quoteLabel = timeMaterials.isFixedPrice ? "Fixed Price" : "Recommended Budget";

  // Reordering work packages: drag a row by its handle, or focus the handle and use ↑/↓.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const handleRefs = useRef(new Map<string, HTMLButtonElement>());
  const [refocusId, setRefocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!refocusId) return;
    handleRefs.current.get(refocusId)?.focus();
    setRefocusId(null);
  }, [refocusId, timeMaterials.workPackages]);

  const moveWorkPackage = (id: string, targetIndex: (fromIndex: number) => number) => {
    onChange((e) => {
      const packages = e.timeMaterials.workPackages;
      const fromIndex = packages.findIndex((p) => p.id === id);
      if (fromIndex === -1) return e;
      const toIndex = targetIndex(fromIndex);
      if (toIndex === fromIndex) return e;
      return { ...e, timeMaterials: { ...e.timeMaterials, workPackages: moveItem(packages, fromIndex, toIndex) } };
    });
  };

  const endDrag = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  const dropOnto = (overId: string, position: DropPosition) => {
    if (!draggedId) return;
    const overIndex = timeMaterials.workPackages.findIndex((p) => p.id === overId);
    if (overIndex !== -1) moveWorkPackage(draggedId, (fromIndex) => dropIndex(fromIndex, overIndex, position));
    endDrag();
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    moveWorkPackage(id, (fromIndex) => fromIndex + step);
    setRefocusId(id);
  };

  const updateRow = (
    id: string,
    patch: Partial<{ name: string; optimisticDays: number; likelyDays: number; pessimisticDays: number; roleId: string | undefined }>,
  ) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        ...e.timeMaterials,
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
      furthestStep={estimate.furthestStep}
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
              {!canContinue && (
                <span className={styles.warnText}>Add at least one priced work package to continue</span>
              )}
              <span className={styles.stepText}>Step 2 of 4</span>
              <Button variant="primary" disabled={!canContinue} onClick={onNext}>
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
            <h1 className={styles.pageTitle}>Break Down the Work</h1>
            <p className={styles.pageSubtitle}>Split the project into deliverables. Three numbers per row is all PERT needs.</p>
          </div>

          <Card
            title="Work Breakdown"
            description="Enter Optimistic / Most likely / Pessimistic days per package. Expected and σ calculate automatically (PERT)."
            info="Three-point (PERT) estimation turns a range into one defensible number per deliverable. It matters because a single-guess estimate hides your uncertainty, and this makes it explicit, combining it mathematically into one confidence interval for the whole project."
          >
            <div className={styles.table}>
              <div className={`${styles.headerRow} ${useRoleBasedPricing ? styles.roleColsOn : ""}`}>
                <span className={styles.colNum}>#</span>
                <span className={styles.colName}>WORK PACKAGE</span>
                {useRoleBasedPricing && <span className={styles.colName}>ROLE</span>}
                <span className={styles.colNum}>OPT.</span>
                <span className={styles.colNum}>LIKELY</span>
                <span className={styles.colNum}>PESS.</span>
                <span className={styles.colNum}>EXPECTED</span>
                <span className={styles.colNum}>σ</span>
                <span className={styles.colCost}>COST</span>
                <span className={styles.colDel} />
              </div>
              {totals.rows.map((row, i) => (
                <div
                  className={[
                    styles.row,
                    useRoleBasedPricing ? styles.roleColsOn : "",
                    draggedId === row.id ? styles.rowDragging : "",
                    dropTarget?.id === row.id ? (dropTarget.position === "before" ? styles.dropBefore : styles.dropAfter) : "",
                  ].join(" ")}
                  key={row.id}
                  onDragOver={(e) => {
                    if (!draggedId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = e.currentTarget.getBoundingClientRect();
                    const position: DropPosition = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    if (dropTarget?.id !== row.id || dropTarget.position !== position) setDropTarget({ id: row.id, position });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dropTarget) dropOnto(dropTarget.id, dropTarget.position);
                  }}
                >
                  <button
                    type="button"
                    className={styles.dragHandle}
                    draggable
                    ref={(el) => {
                      if (el) handleRefs.current.set(row.id, el);
                      else handleRefs.current.delete(row.id);
                    }}
                    aria-label={`Move work package ${i + 1}: drag, or use the arrow keys`}
                    title="Drag to reorder (or focus and press ↑/↓)"
                    onKeyDown={(e) => onHandleKeyDown(e, row.id)}
                    onDragStart={(e) => {
                      setDraggedId(row.id);
                      e.dataTransfer.effectAllowed = "move";
                      // Firefox only starts a drag when some data is set.
                      e.dataTransfer.setData("text/plain", row.id);
                      const rowElement = e.currentTarget.parentElement;
                      if (rowElement) e.dataTransfer.setDragImage(rowElement, 16, rowElement.offsetHeight / 2);
                    }}
                    onDragEnd={endDrag}
                  >
                    <span className={styles.grip} aria-hidden="true">
                      ⠿
                    </span>
                    {i + 1}
                  </button>
                  <input
                    className={styles.nameInput}
                    value={row.name}
                    placeholder="Deliverable name"
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  />
                  {useRoleBasedPricing && (
                    <select
                      className={`${styles.roleSelect} ${!row.roleId || !timeMaterials.roles.some((r) => r.id === row.roleId) ? styles.roleSelectUnassigned : ""}`}
                      value={row.roleId ?? ""}
                      onChange={(e) => updateRow(row.id, { roleId: e.target.value || undefined })}
                    >
                      <option value="">Unassigned (blended)</option>
                      {timeMaterials.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name || "Untitled role"} ({formatMoney(role.dayRate, currency)}/day)
                        </option>
                      ))}
                    </select>
                  )}
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
                        timeMaterials: {
                          ...e.timeMaterials,
                          workPackages: e.timeMaterials.workPackages.filter((r) => r.id !== row.id),
                        },
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className={`${styles.totalRow} ${useRoleBasedPricing ? styles.roleColsOn : ""}`}>
                <span />
                <span>Total</span>
                {useRoleBasedPricing && <span />}
                <span className={styles.colNum}>{formatDays(totals.totalOptimisticDays)}</span>
                <span className={styles.colNum}>{formatDays(totals.totalLikelyDays)}</span>
                <span className={styles.colNum}>{formatDays(totals.totalPessimisticDays)}</span>
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
                    ...e.timeMaterials,
                    workPackages: [
                      ...e.timeMaterials.workPackages,
                      {
                        id: createId(),
                        name: "",
                        optimisticDays: 1,
                        likelyDays: 2,
                        pessimisticDays: 4,
                        roleId: e.timeMaterials.useRoleBasedPricing ? e.timeMaterials.roles[0]?.id : undefined,
                      },
                    ],
                  },
                }))
              }
            >
              + Add Work Package
            </button>
          </Card>
        </div>

        <div className={styles.rightPanel}>
          <Card title="Estimate Summary" description="How the recommended budget is calculated, step by step.">
            <div className={styles.bigNumber}>
              <span className={styles.bigNumberValue}>{formatDays(totals.expectedDays)}</span>
              <span className={styles.bigNumberLabel}>expected days</span>
            </div>
            <p className={styles.sigmaNote}>
              ± {formatDays(totals.sigmaDays, 2)} days (1σ), combined across all {totals.rows.length} packages
            </p>
            <div className={styles.divider} />
            <div className={styles.summaryRow}>
              <span>Base Cost (Expected)</span>
              <span>{formatMoney(totals.baseCost, currency)}</span>
            </div>
            {timeMaterials.isFixedPrice && (
              <>
                <div className={styles.summaryRow}>
                  <span>
                    + Risk Coverage ({timeMaterials.fixedPriceRiskCoveragePct}% of {formatMoney(totals.baseCost, currency)}–
                    {formatMoney(totals.pessimisticCost, currency)})
                  </span>
                  <span>{formatMoney(totals.riskCoverageAmount, currency)}</span>
                </div>
                <div className={styles.summaryRowSub}>
                  <span>Risk-Adjusted Cost</span>
                  <span>{formatMoney(totals.riskAdjustedCost, currency)}</span>
                </div>
              </>
            )}
            <div className={styles.summaryRow}>
              <span>+ Overhead ({estimate.overheadRisk.overheadPct}%)</span>
              <span>
                {formatMoney(timeMaterials.isFixedPrice ? totals.riskAdjustedOverheadAmount : totals.overheadAmount, currency)}
              </span>
            </div>
            <div className={styles.summaryRowSub}>
              <span>Delivery Subtotal</span>
              <span>
                {formatMoney(timeMaterials.isFixedPrice ? totals.riskAdjustedSubtotal : totals.deliverySubtotal, currency)}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span>+ Contingency ({estimate.overheadRisk.contingencyPct}%)</span>
              <span>
                {formatMoney(
                  timeMaterials.isFixedPrice ? totals.riskAdjustedContingencyAmount : totals.contingencyAmount,
                  currency,
                )}
              </span>
            </div>
            {totals.discountAmount > 0 && (
              <>
                <div className={styles.summaryRowSub}>
                  <span>{quoteLabel} Before Discount</span>
                  <span>{formatMoney(totals.listPrice, currency)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>− Discount ({totals.discountPct}% of Delivery Subtotal)</span>
                  <span>{formatDeduction(totals.discountAmount, currency)}</span>
                </div>
              </>
            )}
            <div className={styles.divider} />
            <div className={styles.summaryRowBig}>
              <span>{quoteLabel}</span>
              <span className={styles.summaryRowBigValue}>{formatMoney(totals.quotedPrice, currency)}</span>
            </div>
            {timeMaterials.isFixedPrice && (
              <div className={styles.summaryRow}>
                <span>Expected Cost (without risk)</span>
                <span>{formatMoney(totals.recommendedBudget, currency)}</span>
              </div>
            )}
            <div className={styles.divider} />
            <p className={styles.footnote}>
              {timeMaterials.isFixedPrice
                ? `Risk coverage picks a point between the expected cost and the full pessimistic-case cost, before overhead and contingency are applied to that adjusted base — it's not a percentage of the expected cost itself.`
                : "Uncertainty is combined with root-sum-of-squares across packages, not simple addition, so total risk isn't overstated. Overhead covers non-billable effort; contingency buffers estimation uncertainty. Both are set on the Assumptions step."}
            </p>
          </Card>

          <Card
            title="Discount"
            description={`Optional, shown to the client. Worth a share of the Delivery Subtotal (${formatMoney(totals.discountBase, currency)}) and taken off after contingency, so your risk buffer stays intact.`}
          >
            <Slider
              label="Discount"
              value={timeMaterials.discountPct}
              min={0}
              max={100}
              step={1}
              formatValue={(v) =>
                v === 0 ? "0%" : `${v}% · ${formatDeduction((totals.discountBase * v) / 100, currency)}`
              }
              formatBound={(v) => `${v}%`}
              onChange={(v) => onChange((e) => ({ ...e, timeMaterials: { ...e.timeMaterials, discountPct: v } }))}
            />
          </Card>

          {roleBreakdown.length > 0 && (
            <Card title="Rate Split by Role" description="Where the base cost above comes from.">
              <div className={styles.roleBreakdownList}>
                {roleBreakdown.map((row) => (
                  <div className={styles.roleBreakdownRow} key={row.roleId}>
                    <div className={styles.roleBreakdownHead}>
                      <span className={styles.roleBreakdownName}>{row.roleName || "Untitled role"}</span>
                      <span className={styles.roleBreakdownCost}>{formatMoney(row.cost, currency)}</span>
                    </div>
                    <div className={styles.roleBreakdownBar}>
                      <div className={styles.roleBreakdownBarFill} style={{ width: `${Math.min(100, row.pctOfCost)}%` }} />
                    </div>
                    <span className={styles.roleBreakdownMeta}>
                      {formatDays(row.days)} d at {formatMoney(row.dayRate, currency)}/day · {Math.round(row.pctOfCost)}% of cost
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </WizardLayout>
  );
}
