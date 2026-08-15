import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Card, Field, Slider } from "../../components/ui";
import { DEFAULT_PAYMENT_SPLIT, TM_DEFAULT_PAYMENT_SPLIT } from "../../lib/calc";
import { CURRENCY_CODES, currencySymbol } from "../../lib/currency";
import { createId } from "../../lib/id";
import type { ExpenseItem } from "../../types/estimate";
import type { WizardScreenProps } from "../wizardProps";
import { breadcrumbLabelFor, windowTitleFor } from "../wizardProps";
import styles from "./AssumptionsScreen.module.css";

function EditableList({
  items,
  onChange,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
}) {
  return (
    <div className={styles.list}>
      {items.map((item, i) => (
        <div className={styles.listRow} key={i}>
          <span className={styles.bullet} />
          <input
            className={styles.listInput}
            value={item}
            onChange={(e) => onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))}
            placeholder="Describe this…"
          />
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className={styles.addRow} onClick={() => onChange([...items, ""])}>
        <span className={styles.addPlus}>+</span>
        {addLabel}
      </button>
    </div>
  );
}

function EditableExpenseList({
  items,
  onChange,
  currency,
}: {
  items: ExpenseItem[];
  onChange: (items: ExpenseItem[]) => void;
  currency: string;
}) {
  return (
    <div className={styles.list}>
      {items.map((item, i) => (
        <div className={styles.expenseRow} key={item.id}>
          <input
            className={styles.listInput}
            value={item.label}
            placeholder="e.g. Laptop hardware"
            onChange={(e) => onChange(items.map((v, idx) => (idx === i ? { ...v, label: e.target.value } : v)))}
          />
          <span className={styles.expenseAffix}>{currencySymbol(currency)}</span>
          <input
            type="number"
            min={0}
            className={styles.expenseAmountInput}
            value={item.amount}
            onChange={(e) =>
              onChange(items.map((v, idx) => (idx === i ? { ...v, amount: Number(e.target.value) } : v)))
            }
          />
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Remove expense"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addRow}
        onClick={() => onChange([...items, { id: createId(), label: "", amount: 0 }])}
      >
        <span className={styles.addPlus}>+</span>
        Add Expense
      </button>
    </div>
  );
}

export function AssumptionsScreen({
  estimate,
  onChange,
  onGoToList,
  onGoToSettings,
  onNewEstimate,
  onStepClick,
  savedLabel,
  onNext,
  onSaveDraft,
}: WizardScreenProps) {
  const { projectDetails, rateEffort, overheadRisk, pricingMethod, timeMaterials } = estimate;

  const canContinue = projectDetails.estimateName.trim().length > 0;

  const setRateMode = (nextUseRoleBasedPricing: boolean) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        ...e.timeMaterials,
        useRoleBasedPricing: nextUseRoleBasedPricing,
        // Give unassigned packages a sane default the moment role-based
        // pricing is turned on, instead of leaving every row unassigned.
        workPackages: nextUseRoleBasedPricing
          ? e.timeMaterials.workPackages.map((pkg) =>
              pkg.roleId ? pkg : { ...pkg, roleId: e.timeMaterials.roles[0]?.id },
            )
          : e.timeMaterials.workPackages,
      },
    }));
  };

  const setPricingStructure = (nextIsFixedPrice: boolean) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        ...e.timeMaterials,
        isFixedPrice: nextIsFixedPrice,
        // The two modes draw from different preset lists (see calc.ts), so
        // a split picked under the old mode won't match anything in the
        // new one. Reset to that mode's default rather than leaving a
        // stale, unhighlighted split behind.
        paymentSplit: (nextIsFixedPrice ? DEFAULT_PAYMENT_SPLIT : TM_DEFAULT_PAYMENT_SPLIT).map((entry) => ({ ...entry })),
      },
    }));
  };

  const addRole = () => {
    onChange((e) => ({
      ...e,
      timeMaterials: { ...e.timeMaterials, roles: [...e.timeMaterials.roles, { id: createId(), name: "", dayRate: 0 }] },
    }));
  };

  const updateRole = (id: string, patch: Partial<{ name: string; dayRate: number }>) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        ...e.timeMaterials,
        roles: e.timeMaterials.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    }));
  };

  const removeRole = (id: string) => {
    onChange((e) => ({
      ...e,
      timeMaterials: {
        ...e.timeMaterials,
        roles: e.timeMaterials.roles.filter((r) => r.id !== id),
        // A package pointing at a deleted role falls back to the blended
        // rate; clearing roleId keeps that visible instead of leaving a
        // dangling reference.
        workPackages: e.timeMaterials.workPackages.map((pkg) => (pkg.roleId === id ? { ...pkg, roleId: undefined } : pkg)),
      },
    }));
  };

  return (
    <WizardLayout
      windowTitle={windowTitleFor(estimate)}
      breadcrumbLabel={breadcrumbLabelFor(estimate)}
      currentStep={1}
      furthestStep={estimate.furthestStep}
      savedLabel={savedLabel}
      onGoToList={onGoToList}
      onNewEstimate={onNewEstimate}
      onGoToSettings={onGoToSettings}
      onStepClick={onStepClick}
      footer={
        <FooterBar
          left={
            <Button variant="ghost" onClick={onSaveDraft}>
              Save As Draft
            </Button>
          }
          right={
            <>
              <span className={styles.stepText}>Step 1 of 4</span>
              <Button variant="primary" disabled={!canContinue} onClick={onNext}>
                Continue to {pricingMethod === "value-based" ? "Value-Based Pricing" : "Time & Materials"} →
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Let's Set Up Your Estimate</h1>
            <p className={styles.pageSubtitle}>These numbers drive every calculation below, and you can revisit them any time.</p>
          </div>

          <Card
            title="Pricing Method"
            description="Rule of thumb: measurable business impact → value-based. Exploratory or time-boxed work → time & materials."
          >
            <div className={styles.methodRow}>
              <button
                type="button"
                className={`${styles.methodOption} ${pricingMethod === "value-based" ? styles.methodOptionActive : ""}`}
                onClick={() => onChange((e) => ({ ...e, pricingMethod: "value-based" }))}
              >
                <div className={styles.methodHead}>
                  <span className={`${styles.radio} ${pricingMethod === "value-based" ? styles.radioActive : ""}`} />
                  <span className={styles.methodName}>Value-Based Pricing</span>
                </div>
                <span className={styles.methodTag}>DEFAULT</span>
                <p className={styles.methodDesc}>
                  Fee as 10–20% of the annual value you create. Use whenever business impact is quantifiable, which should be
                  most engagements.
                </p>
              </button>

              <button
                type="button"
                className={`${styles.methodOption} ${pricingMethod === "time-materials" ? styles.methodOptionActive : ""}`}
                onClick={() => onChange((e) => ({ ...e, pricingMethod: "time-materials" }))}
              >
                <div className={styles.methodHead}>
                  <span className={`${styles.radio} ${pricingMethod === "time-materials" ? styles.radioActive : ""}`} />
                  <span className={styles.methodName}>Time & Materials</span>
                </div>
                <span className={styles.methodTagNeutral}>FALLBACK</span>
                <p className={styles.methodDesc}>
                  Effort × day rate + risk buffer. Use when scope is exploratory, time-boxed, or value can't be cleanly
                  established.
                </p>
              </button>
            </div>
          </Card>

          <Card title="Project Details">
            <Field
              label="Estimate Name"
              value={projectDetails.estimateName}
              placeholder="Acme Corp Website Redesign"
              onChange={(e) => onChange((est) => ({ ...est, projectDetails: { ...est.projectDetails, estimateName: e.target.value } }))}
            />
            <div className={styles.row2}>
              <Field
                label="Client Name"
                value={projectDetails.clientName}
                placeholder="Acme Corporation"
                onChange={(e) => onChange((est) => ({ ...est, projectDetails: { ...est.projectDetails, clientName: e.target.value } }))}
              />
              <label className={styles.selectField}>
                <span className={styles.selectLabel}>Currency</span>
                <select
                  className={styles.select}
                  value={projectDetails.currency}
                  onChange={(e) => onChange((est) => ({ ...est, projectDetails: { ...est.projectDetails, currency: e.target.value } }))}
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code} ({currencySymbol(code)})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Field
              label="Your Name"
              value={projectDetails.preparerName}
              placeholder="e.g. Jane Doe"
              helpText="Shown as the preparer on the proposal document."
              onChange={(e) => onChange((est) => ({ ...est, projectDetails: { ...est.projectDetails, preparerName: e.target.value } }))}
            />
          </Card>

          {pricingMethod === "value-based" ? (
            <Card
              title="Rate & Effort"
              description="Your billing rate and the effort unit used across this estimate."
            >
              <div className={styles.row2}>
                <Field
                  label="Day Rate"
                  type="number"
                  min={0}
                  prefix={currencySymbol(projectDetails.currency)}
                  value={rateEffort.dayRate}
                  helpText="Your single daily rate. It drives the work package's cost."
                  onChange={(e) => onChange((est) => ({ ...est, rateEffort: { ...est.rateEffort, dayRate: Number(e.target.value) } }))}
                />
                <Field
                  label="Working Hours / Day"
                  type="number"
                  min={1}
                  max={24}
                  value={rateEffort.workingHoursPerDay}
                  helpText="For converting between hours and days."
                  onChange={(e) =>
                    onChange((est) => ({ ...est, rateEffort: { ...est.rateEffort, workingHoursPerDay: Number(e.target.value) } }))
                  }
                />
              </div>
            </Card>
          ) : (
            <Card title="Billing Rate" description="Bill every work package the same, or assign a day rate per role.">
              <div className={styles.methodRow}>
                <button
                  type="button"
                  className={`${styles.methodOption} ${!timeMaterials.useRoleBasedPricing ? styles.methodOptionActive : ""}`}
                  onClick={() => setRateMode(false)}
                >
                  <div className={styles.methodHead}>
                    <span className={`${styles.radio} ${!timeMaterials.useRoleBasedPricing ? styles.radioActive : ""}`} />
                    <span className={styles.methodName}>Blended Rate</span>
                  </div>
                  <p className={styles.methodDesc}>Every work package bills at the same day rate.</p>
                </button>

                <button
                  type="button"
                  className={`${styles.methodOption} ${timeMaterials.useRoleBasedPricing ? styles.methodOptionActive : ""}`}
                  onClick={() => setRateMode(true)}
                >
                  <div className={styles.methodHead}>
                    <span className={`${styles.radio} ${timeMaterials.useRoleBasedPricing ? styles.radioActive : ""}`} />
                    <span className={styles.methodName}>Role-Based Rates</span>
                  </div>
                  <p className={styles.methodDesc}>Assign each work package to a role with its own day rate.</p>
                </button>
              </div>

              {!timeMaterials.useRoleBasedPricing ? (
                <Field
                  label="Day Rate"
                  type="number"
                  min={0}
                  prefix={currencySymbol(projectDetails.currency)}
                  value={rateEffort.dayRate}
                  helpText="Your single daily rate. It drives the work package's cost."
                  onChange={(e) => onChange((est) => ({ ...est, rateEffort: { ...est.rateEffort, dayRate: Number(e.target.value) } }))}
                />
              ) : (
                <div className={styles.list}>
                  {timeMaterials.roles.map((role) => (
                    <div className={styles.expenseRow} key={role.id}>
                      <input
                        className={styles.listInput}
                        value={role.name}
                        placeholder="Role name"
                        onChange={(e) => updateRole(role.id, { name: e.target.value })}
                      />
                      <span className={styles.expenseAffix}>{currencySymbol(projectDetails.currency)}</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.expenseAmountInput}
                        value={role.dayRate}
                        onChange={(e) => updateRole(role.id, { dayRate: Number(e.target.value) })}
                      />
                      <span className={styles.expenseAffix}>/ day</span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label="Remove role"
                        onClick={() => removeRole(role.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.addRow} onClick={addRole}>
                    <span className={styles.addPlus}>+</span>
                    Add Role
                  </button>
                </div>
              )}

              <Field
                label="Working Hours / Day"
                type="number"
                min={1}
                max={24}
                value={rateEffort.workingHoursPerDay}
                helpText="For converting between hours and days."
                onChange={(e) =>
                  onChange((est) => ({ ...est, rateEffort: { ...est.rateEffort, workingHoursPerDay: Number(e.target.value) } }))
                }
              />
            </Card>
          )}

          {pricingMethod === "time-materials" && (
            <Card title="Pricing Structure" description="How this engagement gets billed.">
              <div className={styles.methodRow}>
                <button
                  type="button"
                  className={`${styles.methodOption} ${!timeMaterials.isFixedPrice ? styles.methodOptionActive : ""}`}
                  onClick={() => setPricingStructure(false)}
                >
                  <div className={styles.methodHead}>
                    <span className={`${styles.radio} ${!timeMaterials.isFixedPrice ? styles.radioActive : ""}`} />
                    <span className={styles.methodName}>Variable</span>
                  </div>
                  <p className={styles.methodDesc}>Bill for actual time worked. The quote is an estimate, not a promise.</p>
                </button>

                <button
                  type="button"
                  className={`${styles.methodOption} ${timeMaterials.isFixedPrice ? styles.methodOptionActive : ""}`}
                  onClick={() => setPricingStructure(true)}
                >
                  <div className={styles.methodHead}>
                    <span className={`${styles.radio} ${timeMaterials.isFixedPrice ? styles.radioActive : ""}`} />
                    <span className={styles.methodName}>Fixed Price</span>
                  </div>
                  <p className={styles.methodDesc}>
                    Agree a single price upfront, built from your risk coverage below. You absorb any overrun.
                  </p>
                </button>
              </div>
              {timeMaterials.isFixedPrice && (
                <Slider
                  label="Risk Coverage"
                  helpText="How much of the optimistic–pessimistic range to price in. 0% quotes the likely-case budget; 100% quotes the full pessimistic-case ceiling. 25–40% is a conservative default that leans toward the likely case while still absorbing some of the risk."
                  value={timeMaterials.fixedPriceRiskCoveragePct}
                  min={0}
                  max={100}
                  step={5}
                  formatValue={(v) => `${v}%`}
                  onChange={(v) =>
                    onChange((e) => ({ ...e, timeMaterials: { ...e.timeMaterials, fixedPriceRiskCoveragePct: v } }))
                  }
                />
              )}
            </Card>
          )}

          <Card
            title="Overhead & Risk"
            description="Non-billable effort and buffer for estimation uncertainty."
          >
            <div className={styles.row2}>
              <Field
                label="Overhead Uplift"
                type="number"
                min={0}
                max={100}
                suffix="%"
                value={overheadRisk.overheadPct}
                helpText="PM, comms, ramp-up. 10–20% is typical."
                onChange={(e) => onChange((est) => ({ ...est, overheadRisk: { ...est.overheadRisk, overheadPct: Number(e.target.value) } }))}
              />
              <Field
                label="Contingency Buffer"
                type="number"
                min={0}
                max={100}
                suffix="%"
                value={overheadRisk.contingencyPct}
                helpText="Covers estimation uncertainty. 10–20% is typical, raise it for fuzzy scope."
                onChange={(e) =>
                  onChange((est) => ({ ...est, overheadRisk: { ...est.overheadRisk, contingencyPct: Number(e.target.value) } }))
                }
              />
            </div>
          </Card>

          <Card
            title="Assumptions & Exclusions"
            description="What this quote assumes and what's out of scope. Shown to the client automatically."
          >
            <div className={styles.section}>
              <span className={styles.sectionLabel}>ASSUMPTIONS</span>
              <EditableList
                items={estimate.assumptions}
                onChange={(items) => onChange((est) => ({ ...est, assumptions: items }))}
                addLabel="Add Assumption"
              />
            </div>
            <div className={styles.section}>
              <span className={styles.sectionLabel}>EXCLUSIONS</span>
              <EditableList
                items={estimate.exclusions}
                onChange={(items) => onChange((est) => ({ ...est, exclusions: items }))}
                addLabel="Add Exclusion"
              />
            </div>
          </Card>

          <Card
            title="Pass-Through Expenses"
            description="Hardware, licenses, travel, or other costs billed at cost, shown separately from your fee."
          >
            <EditableExpenseList
              items={estimate.expenses}
              onChange={(items) => onChange((est) => ({ ...est, expenses: items }))}
              currency={projectDetails.currency}
            />
          </Card>
        </div>
      </div>
    </WizardLayout>
  );
}
