import { useEffect } from "react";
import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card, Slider } from "../../components/ui";
import { calcValueBased } from "../../lib/calc";
import { currencySymbol, formatMoney } from "../../lib/currency";
import type { WizardScreenProps } from "../wizardProps";
import { breadcrumbLabelFor, windowTitleFor } from "../wizardProps";
import styles from "./ValueBasedScreen.module.css";

// Starting-point tier prices, scaled off the derived fee (Tier B = the fee
// itself). Matches the internal tier-economics reference (0.55x / 1x / 1.65x).
const TIER_FEE_MULTIPLIERS = [0.55, 1, 1.65];

const ROI_TARGET_MIN = 5;
const ROI_TARGET_MAX = 10;

export function ValueBasedScreen({
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
  const { valueBased } = estimate;
  const totals = calcValueBased(valueBased);
  const currency = estimate.projectDetails.currency;

  // Tier prices always track the derived fee. They're recalculated every
  // time it changes, so the tiers never drift out of sync with Step 3 above.
  useEffect(() => {
    if (totals.recommendedFee <= 0) return;
    let changed = false;
    const nextTiers = valueBased.tiers.map((t, i) => {
      const suggested = Math.round(totals.recommendedFee * (TIER_FEE_MULTIPLIERS[i] ?? 1));
      if (t.price === suggested) return t;
      changed = true;
      return { ...t, price: suggested };
    });
    if (!changed) return;
    onChange((e) => ({ ...e, valueBased: { ...e.valueBased, tiers: nextTiers } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.recommendedFee]);

  const updateDriver = (id: string, amount: number) => {
    onChange((e) => ({
      ...e,
      valueBased: {
        ...e.valueBased,
        valueDrivers: e.valueBased.valueDrivers.map((d) => (d.id === id ? { ...d, annualAmount: amount } : d)),
      },
    }));
  };

  const updateTier = (
    id: string,
    patch: Partial<{ name: string; durationMinWeeks: number; durationMaxWeeks: number; price: number; description: string }>,
  ) => {
    onChange((e) => ({
      ...e,
      valueBased: {
        ...e.valueBased,
        tiers: e.valueBased.tiers.map((t) => {
          if (t.id !== id) return t;
          const merged = { ...t, ...patch };
          if (patch.durationMinWeeks !== undefined || patch.durationMaxWeeks !== undefined) {
            // Weeks can never be blank, zero, or NaN (e.g. from clearing the
            // field) - a tier always needs a real, at-least-one-week duration.
            merged.durationMinWeeks = Number.isFinite(merged.durationMinWeeks) ? Math.max(1, merged.durationMinWeeks) : 1;
            merged.durationMaxWeeks = Number.isFinite(merged.durationMaxWeeks)
              ? Math.max(merged.durationMinWeeks, merged.durationMaxWeeks)
              : merged.durationMinWeeks;
          }
          return merged;
        }),
      },
    }));
  };

  const roiOnTarget = totals.clientRoi >= ROI_TARGET_MIN && totals.clientRoi <= ROI_TARGET_MAX;

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
              <span className={styles.stepText}>Step 2 of 4: Value-Based Pricing</span>
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
            <h1 className={styles.pageTitle}>Price by the Value You Create</h1>
            <p className={styles.pageSubtitle}>
              For projects where the business impact is quantifiable, the fee is a share of value delivered, not hours spent.
            </p>
          </div>

          <Card
            title="Step 1: Quantify the Problem"
            description="What does this problem cost the client per year?"
            info="This is the foundation of the whole value-based fee. Everything downstream is a percentage of this number, so under-count it here and every later number is quietly too small."
          >
            <div className={styles.hintCard}>
              <span className={styles.hintTitle}>💡 Ask the Client These 3 Questions</span>
              <ol className={styles.hintList}>
                <li>What does it cost you to NOT solve this in the next 12 months?</li>
                <li>What would even a 10% improvement mean for your business?</li>
                <li>If we solve this, which number in your business changes?</li>
              </ol>
            </div>

            <div className={styles.driverGrid}>
              {valueBased.valueDrivers.map((driver) => (
                <label className={styles.driverField} key={driver.id}>
                  <span className={styles.driverLabel}>{driver.label}</span>
                  <div className={styles.driverInputWrap}>
                    <span className={styles.affix}>{currencySymbol(currency)}</span>
                    <input
                      type="number"
                      min={0}
                      className={styles.driverInput}
                      value={driver.annualAmount}
                      onChange={(e) => updateDriver(driver.id, Number(e.target.value))}
                    />
                  </div>
                  <span className={styles.driverHint}>{driver.hint}</span>
                </label>
              ))}
            </div>

            <div className={styles.problemTotal}>
              <span>Annual Problem Cost</span>
              <span className={styles.problemTotalValue}>{formatMoney(totals.annualProblemCost, currency)}</span>
            </div>
          </Card>

          <Card
            title="Step 2: Estimate Value Potential"
            description="Drag to set a conservative improvement estimate. Moderate and aggressive scale automatically."
            info="Translates the raw problem cost into a realistic range of what your work could recover. The conservative case is what you'll quote from; moderate and aggressive exist to show the upside without overselling the ask."
          >
            <Slider
              label="Conservative Improvement"
              helpText="20–40% is a defensible starting point for most engagements. Go lower if the client is skeptical, higher only with strong proof."
              value={valueBased.conservativePct}
              min={5}
              max={80}
              formatValue={(v) => `${v}%`}
              onChange={(v) => onChange((e) => ({ ...e, valueBased: { ...e.valueBased, conservativePct: v } }))}
            />
            <div className={styles.scenarioRow}>
              <div className={styles.scenario}>
                <span className={styles.scenarioLabel}>CONSERVATIVE</span>
                <span className={styles.scenarioValue}>{formatMoney(totals.conservativeValue, currency)}</span>
                <span className={styles.scenarioPct}>{Math.round(totals.conservativePct)}%</span>
              </div>
              <div className={styles.scenario}>
                <span className={styles.scenarioLabel}>MODERATE</span>
                <span className={styles.scenarioValue}>{formatMoney(totals.moderateValue, currency)}</span>
                <span className={styles.scenarioPct}>{Math.round(totals.moderatePct)}%</span>
              </div>
              <div className={styles.scenario}>
                <span className={styles.scenarioLabel}>AGGRESSIVE</span>
                <span className={styles.scenarioValue}>{formatMoney(totals.aggressiveValue, currency)}</span>
                <span className={styles.scenarioPct}>{Math.round(totals.aggressivePct)}%</span>
              </div>
            </div>
          </Card>

          <Card
            title="Step 3: Derive the Fee"
            description="Fee = Conservative value × Attribution × Value Capture Rate"
            info="Attribution and value capture rate stop you claiming the full value as your fee. They account for what the client's own team, tools, or timing contributed, and what a fair outside-partner slice looks like."
          >
            <Slider
              label="Attribution"
              helpText="Typically 60–100%. Lower it when other teams, tools, or timing share credit for the outcome."
              value={valueBased.attributionPct}
              min={10}
              max={100}
              formatValue={(v) => `${v}%`}
              onChange={(v) => onChange((e) => ({ ...e, valueBased: { ...e.valueBased, attributionPct: v } }))}
            />
            <Slider
              label="Value Capture Rate"
              helpText="5–10% for simple or commoditized work (e.g. a routine audit). 15% is typical. 20–25% for rare, highly specialized expertise."
              value={valueBased.valueCaptureRatePct}
              min={5}
              max={25}
              formatValue={(v) => `${v}%`}
              onChange={(v) => onChange((e) => ({ ...e, valueBased: { ...e.valueBased, valueCaptureRatePct: v } }))}
            />
          </Card>

          <Card
            title="Step 4: Scope the Engagement"
            description="Package it as a tiered proposal. Prices start from the derived fee above."
            info="Packaging the same fee into tiers gives the client a choice instead of a single yes/no, which measurably increases close rates. Tier pricing starts from the derived fee so the numbers stay internally consistent."
          >
            <div className={styles.tiersRow}>
              {valueBased.tiers.map((tier) => (
                <div className={`${styles.tierCard} ${tier.id === valueBased.recommendedTierId ? styles.tierRecommended : ""}`} key={tier.id}>
                  <div className={styles.tierHead}>
                    <input
                      className={styles.tierName}
                      value={tier.name}
                      onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                    />
                    {tier.id === valueBased.recommendedTierId && <span className={styles.tierBadge}>RECOMMENDED</span>}
                  </div>
                  <div className={styles.tierDurationRow}>
                    <input
                      type="number"
                      min={1}
                      className={`${styles.tierDurationInput} ${styles.tierDurationInputMin}`}
                      value={tier.durationMinWeeks}
                      onChange={(e) => updateTier(tier.id, { durationMinWeeks: Number(e.target.value) })}
                    />
                    <span className={styles.tierDurationSep}>–</span>
                    <input
                      type="number"
                      min={1}
                      className={`${styles.tierDurationInput} ${styles.tierDurationInputMax}`}
                      value={tier.durationMaxWeeks}
                      onChange={(e) => updateTier(tier.id, { durationMaxWeeks: Number(e.target.value) })}
                    />
                    <span className={styles.tierDurationUnit}>weeks</span>
                  </div>
                  <div className={styles.tierPriceWrap}>
                    <span className={styles.affix}>{currencySymbol(currency)}</span>
                    <input
                      type="number"
                      min={0}
                      className={styles.tierPrice}
                      value={tier.price}
                      onChange={(e) => updateTier(tier.id, { price: Number(e.target.value) })}
                    />
                  </div>
                  <span className={styles.tierDescLabel}>Client-facing description</span>
                  <textarea
                    className={styles.tierDesc}
                    rows={2}
                    value={tier.description}
                    onChange={(e) => updateTier(tier.id, { description: e.target.value })}
                  />
                  <button
                    type="button"
                    className={styles.setRecommended}
                    onClick={() => onChange((e) => ({ ...e, valueBased: { ...e.valueBased, recommendedTierId: tier.id } }))}
                  >
                    {tier.id === valueBased.recommendedTierId ? "Recommended" : "Make Recommended"}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className={styles.rightPanel}>
          <Card title="Fee Derivation">
            <div className={styles.feeRow}>
              <span>Conservative Annual Value</span>
              <span>{formatMoney(totals.conservativeValue, currency)}</span>
            </div>
            <div className={styles.feeRow}>
              <span>× Attribution ({valueBased.attributionPct}%)</span>
              <span>{formatMoney(totals.attributionValue, currency)}</span>
            </div>
            <div className={styles.feeRow}>
              <span>× Value Capture Rate</span>
              <span>{valueBased.valueCaptureRatePct}%</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.feeTotalRow}>
              <span>Recommended Fee</span>
              <span className={styles.feeTotalValue}>{formatMoney(totals.recommendedFee, currency)}</span>
            </div>
            <div className={`${styles.roiBadge} ${roiOnTarget ? styles.roiBadgeGood : styles.roiBadgeWarn}`}>
              Client ROI: {totals.clientRoi.toFixed(1)}×
            </div>
            <p className={styles.roiTarget}>
              Company target: {ROI_TARGET_MIN}–{ROI_TARGET_MAX}×. Below it, the fee is underpriced; above it, revisit
              attribution or value capture rate.
            </p>
          </Card>
        </div>
      </div>
    </WizardLayout>
  );
}
