import { describe, expect, it } from "vitest";
import { buildProposalHtml } from "./proposalHtml";
import { createEstimate } from "./newEstimate";
import { defaultSettings } from "./settings";
import type { Estimate } from "../types/estimate";

// This HTML is loaded into an Electron BrowserWindow and printed to PDF
// (electron/main.ts, pdf:export). Unescaped user text here can execute
// script or load a remote URL in that window, see proposalHtml.ts's `esc`
// helper. These tests lock in that every free-text field is escaped.

const SCRIPT_PAYLOAD = "<script>alert(1)</script>";
const IMG_PAYLOAD = '<img src=x onerror="alert(1)">';

function maliciousEstimate(pricingMethod: Estimate["pricingMethod"]): Estimate {
  const estimate = createEstimate(defaultSettings());
  estimate.pricingMethod = pricingMethod;
  estimate.projectDetails = {
    ...estimate.projectDetails,
    estimateName: SCRIPT_PAYLOAD,
    clientName: IMG_PAYLOAD,
    preparerName: SCRIPT_PAYLOAD,
  };
  estimate.assumptions = [IMG_PAYLOAD];
  estimate.exclusions = [SCRIPT_PAYLOAD];
  estimate.expenses = [{ id: "x1", label: IMG_PAYLOAD, amount: 100 }];
  estimate.timeMaterials = {
    workPackages: [{ id: "w1", name: IMG_PAYLOAD, optimisticDays: 1, likelyDays: 2, pessimisticDays: 4 }],
  };
  estimate.valueBased = {
    ...estimate.valueBased,
    tiers: estimate.valueBased.tiers.map((t, i) =>
      i === 0 ? { ...t, name: SCRIPT_PAYLOAD, description: SCRIPT_PAYLOAD } : t,
    ),
  };
  return estimate;
}

describe("buildProposalHtml", () => {
  const cases: Array<["time-materials" | "value-based", "client" | "internal"]> = [
    ["time-materials", "client"],
    ["time-materials", "internal"],
    ["value-based", "client"],
    ["value-based", "internal"],
  ];

  it.each(cases)("escapes malicious %s/%s input instead of emitting raw HTML", (pricingMethod, tab) => {
    const estimate = maliciousEstimate(pricingMethod);
    const { html } = buildProposalHtml(estimate, tab);

    expect(html).not.toContain(SCRIPT_PAYLOAD);
    expect(html).not.toContain(IMG_PAYLOAD);
    expect(html.toLowerCase()).not.toContain("<script>alert");
    expect(html.toLowerCase()).not.toContain("<img src=x");

    // The escaped form should still be present somewhere in the document.
    expect(html).toContain("&lt;script&gt;");
  });

  it("still renders normal text unescaped-looking (no double-escaping)", () => {
    const estimate = createEstimate(defaultSettings());
    estimate.projectDetails.estimateName = "Acme & Co";
    const { html } = buildProposalHtml(estimate, "client");
    expect(html).toContain("Acme &amp; Co");
    expect(html).not.toContain("Acme &amp;amp; Co");
  });
});
