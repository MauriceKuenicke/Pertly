import { useEffect, useState } from "react";
import { WindowTitleBar, Sidebar } from "../../components/layout";
import { Badge, Button, Modal } from "../../components/ui";
import { useEstimates } from "../../state/EstimatesContext";
import type { Estimate } from "../../types/estimate";
import { calcTimeMaterials, calcValueBased } from "../../lib/calc";
import { formatMoney } from "../../lib/currency";
import { importEstimateFromShareCode } from "../../lib/newEstimate";
import styles from "./AllEstimatesScreen.module.css";

function estimateHeadline(estimate: Estimate): number {
  if (estimate.pricingMethod === "time-materials") {
    return calcTimeMaterials(estimate.timeMaterials, estimate.rateEffort, estimate.overheadRisk).recommendedBudget;
  }
  return calcValueBased(estimate.valueBased).recommendedFee;
}

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AllEstimatesScreen() {
  const {
    estimates,
    goToList,
    goToSettings,
    createAndOpenEstimate,
    duplicateEstimate,
    addImportedEstimate,
    openEstimate,
    deleteEstimate,
  } = useEstimates();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const closeMenu = () => setOpenMenuId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenuId]);

  const closeImportModal = () => {
    setImportOpen(false);
    setImportText("");
    setImportError(null);
  };

  const handleImport = () => {
    try {
      const estimate = importEstimateFromShareCode(importText);
      addImportedEstimate(estimate);
      closeImportModal();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "That code doesn't look right.");
    }
  };

  return (
    <div className={styles.window}>
      <WindowTitleBar title="Pertly" />
      <div className={styles.contentRow}>
        <Sidebar activeView="list" onGoToList={goToList} onNewEstimate={createAndOpenEstimate} onGoToSettings={goToSettings} />
        <div className={styles.main}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Estimates</h1>
              <p className={styles.subtitle}>Every quote you've built, saved locally on this machine.</p>
            </div>
            <div className={styles.headerActions}>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                Import
              </Button>
              <Button variant="primary" onClick={createAndOpenEstimate}>
                + New estimate
              </Button>
            </div>
          </div>

          <div className={styles.body}>
            {estimates.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No estimates yet</p>
                <p className={styles.emptyText}>Create your first estimate to start pricing a project.</p>
                <Button variant="primary" onClick={createAndOpenEstimate}>
                  + New estimate
                </Button>
              </div>
            ) : (
              <div className={styles.grid}>
                {estimates.map((estimate) => (
                  <div
                    key={estimate.id}
                    className={styles.card}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEstimate(estimate.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openEstimate(estimate.id);
                    }}
                  >
                    <div className={styles.cardHead}>
                      <span className={styles.cardName}>{estimate.projectDetails.estimateName || "Untitled estimate"}</span>
                      <div className={styles.cardHeadActions}>
                        <Badge type={estimate.status === "done" ? "success" : "neutral"} />
                        <div className={styles.menuWrap}>
                          <button
                            type="button"
                            className={styles.optionsBtn}
                            aria-label="Estimate options"
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === estimate.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((id) => (id === estimate.id ? null : estimate.id));
                            }}
                          >
                            ⋮
                          </button>
                          {openMenuId === estimate.id && (
                            <div className={styles.menu} role="menu">
                              <button
                                type="button"
                                className={styles.menuItem}
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  duplicateEstimate(estimate.id);
                                }}
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  const name = estimate.projectDetails.estimateName || "this estimate";
                                  if (window.confirm(`Delete "${name}"? This can't be undone.`)) {
                                    deleteEstimate(estimate.id);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={styles.cardClient}>{estimate.projectDetails.clientName || "No client set"}</span>
                    <div className={styles.cardFooter}>
                      <span className={styles.cardAmount}>
                        {formatMoney(estimateHeadline(estimate), estimate.projectDetails.currency)}
                      </span>
                      <span className={styles.cardMeta}>{relativeDate(estimate.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {importOpen && (
        <Modal
          title="Import an estimate"
          description="Paste a share code from another Pertly estimate. It's imported as a new, editable estimate; nothing about the original is changed."
          onClose={closeImportModal}
        >
          <textarea
            className={styles.importTextarea}
            placeholder="Paste the share code here…"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
          />
          {importError && <p className={styles.importError}>{importError}</p>}
          <div className={styles.importActions}>
            <Button variant="primary" disabled={!importText.trim()} onClick={handleImport}>
              Import estimate
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
