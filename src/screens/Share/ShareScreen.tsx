import { useState } from "react";
import { WizardLayout, FooterBar } from "../../components/layout";
import { Button, Modal } from "../../components/ui";
import type { WizardScreenProps } from "../wizardProps";
import { breadcrumbLabelFor, windowTitleFor } from "../wizardProps";
import { ClientOverviewTM } from "./ClientOverviewTM";
import { InternalDetailTM } from "./InternalDetailTM";
import { ClientOverviewVBP } from "./ClientOverviewVBP";
import { InternalDetailVBP } from "./InternalDetailVBP";
import { buildProposalHtml } from "../../lib/proposalHtml";
import { estimateToShareCode } from "../../lib/newEstimate";
import styles from "./ShareScreen.module.css";

type Tab = "client" | "internal";

export function ShareScreen({
  estimate,
  onGoToList,
  onGoToSettings,
  onNewEstimate,
  onStepClick,
  savedLabel,
  onBack,
  onMarkDone,
}: WizardScreenProps) {
  const [tab, setTab] = useState<Tab>("client");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isVBP = estimate.pricingMethod === "value-based";
  const clientName = estimate.projectDetails.clientName || "your client";

  const filenameBase = (estimate.projectDetails.estimateName || "Estimate").replace(/[^a-z0-9]+/gi, "-");
  const docFilename =
    tab === "client"
      ? `${filenameBase}${isVBP ? "-Value-Proposal" : "-Estimate"}.pdf`
      : `${filenameBase}-Internal${isVBP ? "-Fee" : ""}.pdf`;

  const handleExport = async () => {
    const { html, suggestedName } = buildProposalHtml(estimate, tab);
    await window.pertly.exportPdf({ html, suggestedName: suggestedName ?? docFilename });
  };

  const handleShare = () => {
    setCopied(false);
    setShareCode(estimateToShareCode(estimate));
  };

  const handleCopyShareCode = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
    } catch {
      // Clipboard API can fail (permissions, non-secure context); the
      // read-only textarea is still right there for a manual copy.
    }
  };

  return (
    <WizardLayout
      windowTitle={windowTitleFor(estimate)}
      breadcrumbLabel={breadcrumbLabelFor(estimate)}
      currentStep={4}
      savedLabel={savedLabel}
      onGoToList={onGoToList}
      onNewEstimate={onNewEstimate}
      onGoToSettings={onGoToSettings}
      onStepClick={onStepClick}
      footer={
        <FooterBar
          left={
            <Button variant="ghost" onClick={onBack}>
              ← Back to Summary
            </Button>
          }
          right={
            <>
              <span className={styles.stepText}>Step 4 of 4: Estimate complete</span>
              <Button variant="primary" disabled={estimate.status === "done"} onClick={onMarkDone}>
                {estimate.status === "done" ? "Marked as done ✓" : "Mark as done"}
              </Button>
            </>
          }
        />
      }
    >
      <div className={styles.content}>
        <div className={styles.topRow}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>
              {tab === "client" ? `Ready to share with ${clientName}` : isVBP ? "Internal fee breakdown" : "Internal cost breakdown"}
            </h1>
            <p className={styles.pageSubtitle}>
              {tab === "client"
                ? isVBP
                  ? "Shows the value story and tiered pricing. Attribution and value capture rate stay internal."
                  : "Rates and internal buffers are hidden automatically. Only the price shows."
                : "Share with teammates: includes rates, margins, and the full build-up."}
            </p>
          </div>
          <div className={styles.topRowActions}>
            <Button variant="secondary" onClick={handleShare}>
              Share estimate
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Export PDF
            </Button>
          </div>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "client" ? styles.tabActive : ""}`} onClick={() => setTab("client")}>
            <span className={styles.tabTitle}>Client overview</span>
            <span className={styles.tabSub}>External · no {isVBP ? "formulas" : "rates"}</span>
          </button>
          <button className={`${styles.tab} ${tab === "internal" ? styles.tabActive : ""}`} onClick={() => setTab("internal")}>
            <span className={styles.tabTitle}>Internal detail</span>
            <span className={styles.tabSub}>Team · full build-up</span>
          </button>
        </div>

        <div className={styles.chromeWrap}>
          <div className={styles.browserChrome}>
            <div className={styles.docToolbar}>
              <span>📄 {docFilename}</span>
              <span className={styles.toolbarMeta}>Page 1 of 1 · 100%</span>
            </div>
            <div className={styles.docBody}>
              {tab === "client" ? (
                isVBP ? (
                  <ClientOverviewVBP estimate={estimate} />
                ) : (
                  <ClientOverviewTM estimate={estimate} />
                )
              ) : isVBP ? (
                <InternalDetailVBP estimate={estimate} />
              ) : (
                <InternalDetailTM estimate={estimate} />
              )}
            </div>
          </div>
        </div>
      </div>

      {shareCode && (
        <Modal
          title="Share this estimate"
          description="Copy this code and send it to anyone with Pertly. Pasting it in via Import on the Estimates list recreates a full, editable copy: rates, work breakdown, tiers, everything."
          onClose={() => setShareCode(null)}
        >
          <textarea
            className={styles.shareTextarea}
            readOnly
            value={shareCode}
            onFocus={(e) => e.target.select()}
          />
          <div className={styles.shareActions}>
            <Button variant="primary" onClick={handleCopyShareCode}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>
          </div>
        </Modal>
      )}
    </WizardLayout>
  );
}
