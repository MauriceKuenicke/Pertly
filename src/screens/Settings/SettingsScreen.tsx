import { WindowTitleBar, Sidebar } from "../../components/layout";
import { Card, Field } from "../../components/ui";
import { useEstimates } from "../../state/EstimatesContext";
import { CURRENCY_CODES, currencySymbol } from "../../lib/currency";
import { createId } from "../../lib/id";
import styles from "./SettingsScreen.module.css";

export function SettingsScreen() {
  const { settings, updateSettings, goToList, goToSettings, createAndOpenEstimate } = useEstimates();

  return (
    <div className={styles.window}>
      <WindowTitleBar title="Pertly - Settings" />
      <div className={styles.contentRow}>
        <Sidebar
          activeView="settings"
          onGoToList={goToList}
          onNewEstimate={createAndOpenEstimate}
          onGoToSettings={goToSettings}
        />
        <div className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Settings</h1>
            <p className={styles.subtitle}>
              Defaults applied whenever you create a new estimate. Existing estimates aren't affected.
            </p>
          </div>

          <div className={styles.body}>
            <div className={styles.formColumn}>
              <Card title="Project defaults">
                <Field
                  label="Your name"
                  value={settings.preparerName}
                  placeholder="e.g. Jane Doe"
                  helpText="Pre-fills the preparer name on every new estimate."
                  onChange={(e) => updateSettings((s) => ({ ...s, preparerName: e.target.value }))}
                />
                <label className={styles.selectField}>
                  <span className={styles.selectLabel}>Currency</span>
                  <select
                    className={styles.select}
                    value={settings.currency}
                    onChange={(e) => updateSettings((s) => ({ ...s, currency: e.target.value }))}
                  >
                    {CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code} ({currencySymbol(code)})
                      </option>
                    ))}
                  </select>
                </label>
              </Card>

              <Card title="Rate & effort" description="Your default billing rate and effort unit.">
                <div className={styles.row2}>
                  <Field
                    label="Day rate"
                    type="number"
                    min={0}
                    prefix={currencySymbol(settings.currency)}
                    value={settings.dayRate}
                    onChange={(e) => updateSettings((s) => ({ ...s, dayRate: Number(e.target.value) }))}
                  />
                  <Field
                    label="Working hours / day"
                    type="number"
                    min={1}
                    max={24}
                    value={settings.workingHoursPerDay}
                    onChange={(e) => updateSettings((s) => ({ ...s, workingHoursPerDay: Number(e.target.value) }))}
                  />
                </div>
              </Card>

              <Card title="Overhead & risk" description="Non-billable effort and buffer for estimation uncertainty.">
                <div className={styles.row2}>
                  <Field
                    label="Overhead uplift"
                    type="number"
                    min={0}
                    max={100}
                    suffix="%"
                    value={settings.overheadPct}
                    onChange={(e) => updateSettings((s) => ({ ...s, overheadPct: Number(e.target.value) }))}
                  />
                  <Field
                    label="Contingency buffer"
                    type="number"
                    min={0}
                    max={100}
                    suffix="%"
                    value={settings.contingencyPct}
                    onChange={(e) => updateSettings((s) => ({ ...s, contingencyPct: Number(e.target.value) }))}
                  />
                </div>
              </Card>

              <Card
                title="Time & Materials rates"
                description="Bill every work package the same, or set up roles with their own day rate. Applies to new estimates; existing ones keep their own roster."
              >
                <div className={styles.rateModeRow}>
                  <button
                    type="button"
                    className={`${styles.rateModeOption} ${!settings.useRoleBasedPricing ? styles.rateModeOptionActive : ""}`}
                    onClick={() => updateSettings((s) => ({ ...s, useRoleBasedPricing: false }))}
                  >
                    <div className={styles.rateModeHead}>
                      <span className={`${styles.radio} ${!settings.useRoleBasedPricing ? styles.radioActive : ""}`} />
                      <span className={styles.rateModeName}>Blended rate</span>
                    </div>
                    <p className={styles.rateModeDesc}>New estimates start with one day rate for every work package.</p>
                  </button>
                  <button
                    type="button"
                    className={`${styles.rateModeOption} ${settings.useRoleBasedPricing ? styles.rateModeOptionActive : ""}`}
                    onClick={() => updateSettings((s) => ({ ...s, useRoleBasedPricing: true }))}
                  >
                    <div className={styles.rateModeHead}>
                      <span className={`${styles.radio} ${settings.useRoleBasedPricing ? styles.radioActive : ""}`} />
                      <span className={styles.rateModeName}>Role-based rates</span>
                    </div>
                    <p className={styles.rateModeDesc}>New estimates start with the roster below, assignable per package.</p>
                  </button>
                </div>

                <div className={styles.roleList}>
                  {settings.roles.map((role) => (
                    <div className={styles.roleRow} key={role.id}>
                      <input
                        className={styles.roleNameInput}
                        value={role.name}
                        placeholder="Role name"
                        onChange={(e) =>
                          updateSettings((s) => ({
                            ...s,
                            roles: s.roles.map((r) => (r.id === role.id ? { ...r, name: e.target.value } : r)),
                          }))
                        }
                      />
                      <span className={styles.roleRateAffix}>{currencySymbol(settings.currency)}</span>
                      <input
                        type="number"
                        min={0}
                        className={styles.roleRateInput}
                        value={role.dayRate}
                        onChange={(e) =>
                          updateSettings((s) => ({
                            ...s,
                            roles: s.roles.map((r) => (r.id === role.id ? { ...r, dayRate: Number(e.target.value) } : r)),
                          }))
                        }
                      />
                      <span className={styles.roleRateUnit}>/ day</span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label="Remove role"
                        onClick={() => updateSettings((s) => ({ ...s, roles: s.roles.filter((r) => r.id !== role.id) }))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addRow}
                    onClick={() =>
                      updateSettings((s) => ({ ...s, roles: [...s.roles, { id: createId(), name: "", dayRate: 0 }] }))
                    }
                  >
                    <span className={styles.addPlus}>+</span>
                    Add role
                  </button>
                </div>
              </Card>

              <Card
                title="Value-based pricing defaults"
                description="Starting point for the sliders in Step 2 of a new value-based estimate."
              >
                <div className={styles.row3}>
                  <Field
                    label="Conservative improvement"
                    type="number"
                    min={5}
                    max={80}
                    suffix="%"
                    value={settings.conservativePct}
                    onChange={(e) => updateSettings((s) => ({ ...s, conservativePct: Number(e.target.value) }))}
                  />
                  <Field
                    label="Attribution"
                    type="number"
                    min={10}
                    max={100}
                    suffix="%"
                    value={settings.attributionPct}
                    onChange={(e) => updateSettings((s) => ({ ...s, attributionPct: Number(e.target.value) }))}
                  />
                  <Field
                    label="Value capture rate"
                    type="number"
                    min={5}
                    max={25}
                    suffix="%"
                    value={settings.valueCaptureRatePct}
                    onChange={(e) => updateSettings((s) => ({ ...s, valueCaptureRatePct: Number(e.target.value) }))}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
